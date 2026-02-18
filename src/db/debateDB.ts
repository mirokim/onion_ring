/**
 * SQLite-based debate history storage using sql.js (WASM).
 * Persists the database to IndexedDB automatically.
 * Pattern adapted from Onion Editor's sqliteStorageAdapter.ts (simplified: web-only, no Electron).
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import type { AIProvider, DiscussionMode } from '@/types'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

// ── Stored Types ──

export interface StoredDebate {
  id: string
  topic: string
  mode: DiscussionMode
  status: 'completed' | 'stopped'
  participants: AIProvider[]
  maxRounds: number
  actualRounds: number
  messageCount: number
  createdAt: number
  completedAt: number
}

export interface StoredMessage {
  id: string
  debateId: string
  provider: AIProvider | 'user'
  content: string
  round: number
  timestamp: number
  error?: string
}

export interface StoredReferenceFile {
  id: string
  filename: string
  mimeType: string
  size: number
  data: Uint8Array
  textContent?: string
  uploadedAt: number
}

// ── Load sql.js with dynamic import (CJS/ESM interop) ──

async function loadSqlJs(): Promise<SqlJsStatic> {
  const sqlPromise = await import('sql.js')
  const initSqlJs = sqlPromise.default || sqlPromise

  const wasmUrl = (() => {
    if (import.meta.env.DEV) {
      return '/sql-wasm.wasm'
    }
    return new URL('./sql-wasm.wasm', window.location.href).href
  })()

  return initSqlJs({
    locateFile: () => wasmUrl,
  })
}

// ── IndexedDB persistence helpers ──

const IDB_NAME = 'OnionRingDebateStore'
const IDB_STORE = 'databases'
const IDB_KEY = 'debate-main-db'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error('Failed to open IndexedDB'))
  })
}

async function loadDatabaseFromIDB(): Promise<Uint8Array | null> {
  try {
    const db = await openIDB()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const getReq = store.get(IDB_KEY)
      getReq.onsuccess = () => resolve(getReq.result || null)
      getReq.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function saveDatabaseToIDB(data: Uint8Array): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(data, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new Error('IndexedDB transaction failed'))
  })
}

// ── DebateDB Singleton ──

class DebateDB {
  private static instance: DebateDB
  private db: Database | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private readonly DEBOUNCE_MS = 500
  private initPromise: Promise<void> | null = null

  static getInstance(): DebateDB {
    if (!DebateDB.instance) {
      DebateDB.instance = new DebateDB()
    }
    return DebateDB.instance
  }

  // ── Initialization ──

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this._doInit()
    return this.initPromise
  }

  private async _doInit(): Promise<void> {
    const SQL = await loadSqlJs()

    const savedData = await loadDatabaseFromIDB()
    if (savedData) {
      try {
        this.db = new SQL.Database(savedData)
        console.log('[SQLite] Loaded existing database from IndexedDB')
      } catch (err) {
        console.warn('[SQLite] Failed to load saved database, creating new one:', err)
        this.db = new SQL.Database()
      }
    } else {
      this.db = new SQL.Database()
      console.log('[SQLite] Created new database')
    }

    this._createTables()
    await this._persist()

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && this.dirty && this.db) {
          void this._persist()
        }
      })
    } else {
      window.addEventListener('beforeunload', () => {
        if (this.dirty && this.db) {
          this._persistSync()
        }
      })
    }
  }

  // ── Schema ──

  private _createTables(): void {
    if (!this.db) return

    this.db.run(`
      CREATE TABLE IF NOT EXISTS debates (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        participants TEXT NOT NULL,
        max_rounds INTEGER NOT NULL,
        actual_rounds INTEGER NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER NOT NULL
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        debate_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        content TEXT NOT NULL,
        round INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        error TEXT
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS reference_files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        data BLOB NOT NULL,
        text_content TEXT,
        uploaded_at INTEGER NOT NULL
      )
    `)

    this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_debate ON messages(debate_id)')
    this.db.run('CREATE INDEX IF NOT EXISTS idx_debates_created ON debates(created_at)')
  }

  // ── Query Helpers (Onion Editor pattern) ──

  private _queryAll<T>(sql: string, params: SqlValue[] = []): T[] {
    if (!this.db) return []
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return results
  }

  // @ts-expect-error -- reserved for future use
  private _queryOne<T>(sql: string, params: SqlValue[] = []): T | null {
    const results = this._queryAll<T>(sql, params)
    return results[0] ?? null
  }

  private _run(sql: string, params: SqlValue[] = []): void {
    if (!this.db) throw new Error('Database not initialized')
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    stmt.step()
    stmt.free()
    this._markDirty()
  }

  // ── Persistence ──

  private _markDirty(): void {
    this.dirty = true
    this._scheduleSave()
  }

  private _scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this._persist(), this.DEBOUNCE_MS)
  }

  private async _persist(): Promise<void> {
    if (!this.db) return
    this.dirty = false
    const data = this.db.export()
    try {
      await saveDatabaseToIDB(data)
    } catch (err) {
      this.dirty = true
      console.error('[SQLite] Persist failed, will retry:', err)
      this._scheduleSave()
    }
  }

  private _persistSync(): void {
    if (!this.db) return
    this.dirty = false
    const data = this.db.export()
    void saveDatabaseToIDB(data)
  }

  // ── Row Mapping ──

  private _rowToDebate(r: Record<string, unknown>): StoredDebate {
    return {
      id: r.id as string,
      topic: r.topic as string,
      mode: r.mode as DiscussionMode,
      status: r.status as 'completed' | 'stopped',
      participants: JSON.parse(r.participants as string) as AIProvider[],
      maxRounds: r.max_rounds as number,
      actualRounds: r.actual_rounds as number,
      messageCount: r.message_count as number,
      createdAt: r.created_at as number,
      completedAt: r.completed_at as number,
    }
  }

  private _rowToMessage(r: Record<string, unknown>): StoredMessage {
    return {
      id: r.id as string,
      debateId: r.debate_id as string,
      provider: r.provider as AIProvider | 'user',
      content: r.content as string,
      round: r.round as number,
      timestamp: r.timestamp as number,
      error: (r.error as string) || undefined,
    }
  }

  // ── Typed CRUD ──

  getAllDebates(): StoredDebate[] {
    return this._queryAll<Record<string, unknown>>(
      'SELECT * FROM debates ORDER BY created_at DESC',
    ).map((r) => this._rowToDebate(r))
  }

  getMessagesByDebateId(debateId: string): StoredMessage[] {
    return this._queryAll<Record<string, unknown>>(
      'SELECT * FROM messages WHERE debate_id = ? ORDER BY timestamp',
      [debateId],
    ).map((r) => this._rowToMessage(r))
  }

  insertDebate(debate: StoredDebate): void {
    this._run(
      `INSERT INTO debates (id, topic, mode, status, participants, max_rounds, actual_rounds, message_count, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        debate.id,
        debate.topic,
        debate.mode,
        debate.status,
        JSON.stringify(debate.participants),
        debate.maxRounds,
        debate.actualRounds,
        debate.messageCount,
        debate.createdAt,
        debate.completedAt,
      ],
    )
  }

  insertMessages(messages: StoredMessage[]): void {
    if (!this.db || messages.length === 0) return
    this.db.run('BEGIN TRANSACTION')
    try {
      for (const msg of messages) {
        const stmt = this.db.prepare(
          `INSERT INTO messages (id, debate_id, provider, content, round, timestamp, error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        stmt.bind([
          msg.id,
          msg.debateId,
          msg.provider,
          msg.content,
          msg.round,
          msg.timestamp,
          msg.error ?? null,
        ])
        stmt.step()
        stmt.free()
      }
      this.db.run('COMMIT')
      this._markDirty()
    } catch (err) {
      this.db.run('ROLLBACK')
      throw err
    }
  }

  deleteDebate(id: string): void {
    if (!this.db) return
    this.db.run('BEGIN TRANSACTION')
    try {
      const stmt1 = this.db.prepare('DELETE FROM messages WHERE debate_id = ?')
      stmt1.bind([id])
      stmt1.step()
      stmt1.free()

      const stmt2 = this.db.prepare('DELETE FROM debates WHERE id = ?')
      stmt2.bind([id])
      stmt2.step()
      stmt2.free()

      this.db.run('COMMIT')
      this._markDirty()
    } catch (err) {
      this.db.run('ROLLBACK')
      throw err
    }
  }

  insertReferenceFile(file: StoredReferenceFile): void {
    this._run(
      `INSERT INTO reference_files (id, filename, mime_type, size, data, text_content, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        file.id,
        file.filename,
        file.mimeType,
        file.size,
        file.data,
        file.textContent ?? null,
        file.uploadedAt,
      ],
    )
  }
}

export const debateDB = DebateDB.getInstance()
