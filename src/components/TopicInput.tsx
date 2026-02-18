import { useState, useMemo } from 'react'
import { Play, AlertCircle, FileText, Upload, X, Camera as CameraIcon, ImagePlus } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebateStore } from '@/stores/debateStore'
import { cn } from '@/lib/utils'
import { generateId } from '@/lib/utils'
import { isCameraAvailable, capturePhoto, pickFromGallery } from '@/lib/camera'
import {
  PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  ROLE_OPTIONS,
  type AIProvider,
  type DiscussionMode,
  type PacingMode,
  type RoleConfig,
  type ReferenceFile,
} from '@/types'

const MODE_LABELS: Record<DiscussionMode, string> = {
  roundRobin: '라운드 로빈',
  freeDiscussion: '자유 토론',
  roleAssignment: '역할 배정',
}

const MODE_DESCRIPTIONS: Record<DiscussionMode, string> = {
  roundRobin: 'AI들이 순서대로 돌아가며 발언합니다',
  freeDiscussion: 'AI들이 자유롭게 서로의 의견에 반박/동의합니다',
  roleAssignment: '각 AI에 역할(찬성/반대 등)을 부여하여 토론합니다',
}

const DELAY_OPTIONS = [5, 10, 15, 30] as const

const REF_MAX_LENGTH = 10_000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function TopicInput() {
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<DiscussionMode>('roundRobin')
  const [maxRounds, setMaxRounds] = useState(3)
  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>([])
  const [roles, setRoles] = useState<RoleConfig[]>([])

  // Reference data state
  const [useReference, setUseReference] = useState(false)
  const [referenceText, setReferenceText] = useState('')
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])

  // Pacing state
  const [pacingMode, setPacingMode] = useState<PacingMode>('auto')
  const [autoDelay, setAutoDelay] = useState(5)

  const configs = useSettingsStore((s) => s.configs)
  const startDebate = useDebateStore((s) => s.startDebate)

  const enabledProviders = useMemo(
    () => PROVIDERS.filter((p) => configs[p].enabled && configs[p].apiKey.trim().length > 0),
    [configs],
  )

  const canStart = topic.trim().length > 0 && selectedProviders.length >= 2

  // Sync role configs when providers change
  const toggleProvider = (provider: AIProvider) => {
    setSelectedProviders((prev) => {
      const next = prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
      setRoles((prevRoles) => {
        const existing = new Map(prevRoles.map((r) => [r.provider, r]))
        return next.map((p) => existing.get(p) || { provider: p, role: '중립' })
      })
      return next
    })
  }

  const updateRole = (provider: AIProvider, role: string) => {
    setRoles((prev) =>
      prev.map((r) => (r.provider === provider ? { ...r, role } : r)),
    )
  }

  // File upload handlers
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return
    const newFiles: ReferenceFile[] = []

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      if (referenceFiles.length + newFiles.length >= MAX_FILES) break

      const dataUrl = await readFileAsDataUrl(file)
      newFiles.push({
        id: generateId(),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl,
      })
    }

    setReferenceFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setReferenceFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleCamera = async () => {
    if (referenceFiles.length >= MAX_FILES) return
    const file = await capturePhoto()
    if (file) setReferenceFiles((prev) => [...prev, file])
  }

  const handleGallery = async () => {
    if (referenceFiles.length >= MAX_FILES) return
    const file = await pickFromGallery()
    if (file) setReferenceFiles((prev) => [...prev, file])
  }

  const handleStart = () => {
    if (!canStart) return
    startDebate({
      mode,
      topic: topic.trim(),
      maxRounds,
      participants: selectedProviders,
      roles: mode === 'roleAssignment' ? roles : [],
      referenceText: useReference ? referenceText : '',
      useReference,
      referenceFiles: useReference ? referenceFiles : [],
      pacing: {
        mode: pacingMode,
        autoDelaySeconds: autoDelay,
      },
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-text-primary">🧅 AI 토론</h2>
          <p className="text-sm text-text-muted">
            주제를 입력하면 여러 AI가 서로 토론하며 다양한 관점을 제시합니다
          </p>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">토론 주제</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 소설에서 주인공의 성장 과정을 1인칭으로 서술하는 것이 3인칭보다 효과적인가?"
            className="w-full px-3 py-2.5 text-sm bg-bg-surface border border-border rounded-lg resize-none focus:outline-none focus:border-accent transition"
            rows={3}
          />
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">토론 모드</label>
          <div className="flex gap-1.5">
            {(Object.keys(MODE_LABELS) as DiscussionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 px-3 py-2 text-xs rounded-lg border transition',
                  mode === m
                    ? 'bg-accent/15 border-accent text-accent font-medium'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted">{MODE_DESCRIPTIONS[mode]}</p>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">참여 AI 선택</label>
          {enabledProviders.length < 2 && (
            <div className="flex items-center gap-1.5 text-warning text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>사이드바에서 2개 이상의 AI를 활성화하고 API 키를 입력하세요</span>
            </div>
          )}
          <div className="flex gap-2">
            {enabledProviders.map((p) => {
              const selected = selectedProviders.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition',
                    selected
                      ? 'border-transparent font-medium'
                      : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                  )}
                  style={
                    selected
                      ? {
                          backgroundColor: `${PROVIDER_COLORS[p]}15`,
                          borderColor: PROVIDER_COLORS[p],
                          color: PROVIDER_COLORS[p],
                        }
                      : undefined
                  }
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PROVIDER_COLORS[p] }}
                  />
                  {PROVIDER_LABELS[p]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Role Assignment */}
        {mode === 'roleAssignment' && selectedProviders.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">역할 배정</label>
            <div className="space-y-1.5">
              {selectedProviders.map((p) => {
                const role = roles.find((r) => r.provider === p)?.role || '중립'
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: PROVIDER_COLORS[p] }}
                    />
                    <span className="text-xs text-text-secondary w-16">{PROVIDER_LABELS[p]}</span>
                    <select
                      value={role}
                      onChange={(e) => updateRole(p, e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-bg-primary border border-border rounded text-text-primary"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.label}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">
            라운드 수: <span className="text-accent">{maxRounds}</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={maxRounds}
            onChange={(e) => setMaxRounds(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Reference Data */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useReference}
              onChange={(e) => setUseReference(e.target.checked)}
              className="accent-accent"
            />
            <FileText className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">참고 자료 포함</span>
          </label>

          {useReference && (
            <div className="space-y-3">
              {/* Text Reference */}
              <div className="space-y-1.5">
                <textarea
                  value={referenceText}
                  onChange={(e) => {
                    if (e.target.value.length <= REF_MAX_LENGTH) {
                      setReferenceText(e.target.value)
                    }
                  }}
                  placeholder="토론에 참고할 텍스트를 붙여넣으세요."
                  className="w-full px-3 py-2.5 text-sm bg-bg-surface border border-border rounded-lg resize-none focus:outline-none focus:border-accent transition"
                  rows={4}
                />
                <div className="flex justify-end">
                  <span
                    className={cn(
                      'text-[10px]',
                      referenceText.length > REF_MAX_LENGTH * 0.9
                        ? 'text-warning'
                        : 'text-text-muted',
                    )}
                  >
                    {referenceText.length.toLocaleString()} / {REF_MAX_LENGTH.toLocaleString()}자
                  </span>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="space-y-2">
                <label
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition',
                    referenceFiles.length >= MAX_FILES
                      ? 'border-border text-text-muted cursor-not-allowed opacity-50'
                      : 'border-border hover:border-accent/50 text-text-secondary hover:text-accent',
                  )}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (referenceFiles.length < MAX_FILES) {
                      void handleFileUpload(e.dataTransfer.files)
                    }
                  }}
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">
                    이미지 또는 PDF 파일을 드래그하거나 클릭하여 업로드
                  </span>
                  <span className="text-[10px] text-text-muted">
                    PNG, JPG, GIF, WebP, PDF | 최대 10MB | 최대 {MAX_FILES}개
                  </span>
                  <input
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    multiple
                    className="hidden"
                    onChange={(e) => void handleFileUpload(e.target.files)}
                    disabled={referenceFiles.length >= MAX_FILES}
                  />
                </label>

                {/* Camera / Gallery buttons (native only) */}
                {isCameraAvailable() && referenceFiles.length < MAX_FILES && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCamera()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover transition"
                    >
                      <CameraIcon className="w-4 h-4" />
                      <span className="text-xs">카메라</span>
                    </button>
                    <button
                      onClick={() => void handleGallery()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover transition"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-xs">갤러리</span>
                    </button>
                  </div>
                )}

                {/* File List */}
                {referenceFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {referenceFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-2 py-1.5 bg-bg-surface rounded border border-border"
                      >
                        {file.mimeType.startsWith('image/') ? (
                          <img
                            src={file.dataUrl}
                            alt={file.filename}
                            className="w-8 h-8 object-cover rounded shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center bg-bg-hover rounded shrink-0">
                            <FileText className="w-4 h-4 text-text-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-primary truncate">{file.filename}</p>
                          <p className="text-[10px] text-text-muted">
                            {file.size < 1024
                              ? `${file.size} B`
                              : file.size < 1024 * 1024
                                ? `${(file.size / 1024).toFixed(1)} KB`
                                : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1 hover:bg-error/20 rounded text-text-muted hover:text-error transition shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Turn Pacing */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-text-secondary">턴 속도 제어</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPacingMode('auto')}
              className={cn(
                'flex-1 px-3 py-2 text-xs rounded-lg border transition',
                pacingMode === 'auto'
                  ? 'bg-accent/15 border-accent text-accent font-medium'
                  : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              자동
            </button>
            <button
              onClick={() => setPacingMode('manual')}
              className={cn(
                'flex-1 px-3 py-2 text-xs rounded-lg border transition',
                pacingMode === 'manual'
                  ? 'bg-accent/15 border-accent text-accent font-medium'
                  : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              수동
            </button>
          </div>

          {pacingMode === 'auto' ? (
            <div className="flex gap-1.5">
              {DELAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setAutoDelay(d)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded-lg border transition',
                    autoDelay === d
                      ? 'bg-accent/10 border-accent/50 text-accent'
                      : 'bg-bg-surface border-border text-text-muted hover:bg-bg-hover',
                  )}
                >
                  {d}초
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">
              각 AI 응답 후 &apos;다음 턴&apos; 버튼을 눌러야 진행됩니다
            </p>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition',
            canStart
              ? 'bg-accent text-bg-primary hover:bg-accent-hover'
              : 'bg-bg-surface text-text-muted cursor-not-allowed',
          )}
        >
          <Play className="w-4 h-4" />
          토론 시작
        </button>
      </div>
    </div>
  )
}
