import { useState, useRef } from 'react'
import { Send, Paperclip, X, FileText, Camera as CameraIcon, ImagePlus } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { generateId } from '@/lib/utils'
import { isCameraAvailable, capturePhoto, pickFromGallery } from '@/lib/camera'
import type { ReferenceFile } from '@/types'

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

export function UserIntervention() {
  const status = useDebateStore((s) => s.status)
  const userIntervene = useDebateStore((s) => s.userIntervene)
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<ReferenceFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const disabled = status !== 'running' && status !== 'paused'
  const canSend = !disabled && (input.trim().length > 0 || files.length > 0)

  const handleSend = () => {
    if (!canSend) return
    userIntervene(input.trim(), files.length > 0 ? files : undefined)
    setInput('')
    setFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList) return
    const newFiles: ReferenceFile[] = []

    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      if (files.length + newFiles.length >= MAX_FILES) break

      const dataUrl = await readFileAsDataUrl(file)
      newFiles.push({
        id: generateId(),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl,
      })
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleCamera = async () => {
    if (files.length >= MAX_FILES) return
    const file = await capturePhoto()
    if (file) setFiles((prev) => [...prev, file])
  }

  const handleGallery = async () => {
    if (files.length >= MAX_FILES) return
    const file = await pickFromGallery()
    if (file) setFiles((prev) => [...prev, file])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && files.length < MAX_FILES) {
      void handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className="border-t border-border p-3 shrink-0 bg-bg-secondary/80 backdrop-blur-sm"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* File Preview Area */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2.5 overflow-x-auto pb-1">
          {files.map((file) => (
            <div key={file.id} className="relative shrink-0 group">
              {file.mimeType.startsWith('image/') ? (
                <img
                  src={file.dataUrl}
                  alt={file.filename}
                  className="w-14 h-14 object-cover rounded-xl border border-border"
                />
              ) : (
                <div className="w-14 h-14 flex flex-col items-center justify-center bg-bg-surface rounded-xl border border-border">
                  <FileText className="w-5 h-5 text-text-muted" />
                  <span className="text-[7px] text-text-muted mt-0.5">PDF</span>
                </div>
              )}
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex gap-2 items-end">
        {/* Attach Button */}
        <button
          onClick={() => {
            if (disabled || files.length >= MAX_FILES) return
            fileInputRef.current?.click()
          }}
          disabled={disabled || files.length >= MAX_FILES}
          className="p-2 text-text-muted hover:text-accent rounded-xl hover:bg-bg-hover disabled:opacity-25 disabled:cursor-not-allowed transition shrink-0"
          title="파일 첨부 (이미지, PDF)"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Native Camera/Gallery */}
        {isCameraAvailable() && !disabled && files.length < MAX_FILES && (
          <>
            <button
              onClick={() => void handleCamera()}
              className="p-2 text-text-muted hover:text-accent rounded-xl hover:bg-bg-hover transition shrink-0"
              title="카메라"
            >
              <CameraIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => void handleGallery()}
              className="p-2 text-text-muted hover:text-accent rounded-xl hover:bg-bg-hover transition shrink-0"
              title="갤러리"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
          </>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? status === 'completed'
                ? '토론이 완료되었습니다'
                : '토론이 시작되면 개입할 수 있습니다'
              : files.length > 0
                ? '파일과 함께 보낼 메시지 입력 (Enter)'
                : '토론에 개입하기... (Enter 전송, 파일 드래그 가능)'
          }
          disabled={disabled}
          className="flex-1 px-3.5 py-2 text-sm bg-bg-surface border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-text-muted/60"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-2 bg-accent text-white rounded-xl hover:bg-accent-dim disabled:opacity-20 disabled:cursor-not-allowed transition shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFileUpload(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Safe area spacer for home bar */}
      <div className="safe-area-bottom" />
    </div>
  )
}
