import { useState, useMemo, useEffect } from 'react'
import { Play, AlertCircle, FileText, Upload, X, Camera as CameraIcon, ImagePlus, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebateStore } from '@/stores/debateStore'
import { useHistoryStore } from '@/stores/historyStore'
import { cn } from '@/lib/utils'
import { generateId } from '@/lib/utils'
import { isCameraAvailable, capturePhoto, pickFromGallery } from '@/lib/camera'
import {
  PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  ROLE_OPTIONS,
  ROLE_GROUPS,
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
  battle: '⚔️ 결전모드',
}

const MODE_DESCRIPTIONS: Record<DiscussionMode, string> = {
  roundRobin: 'AI들이 순서대로 돌아가며 발언합니다',
  freeDiscussion: 'AI들이 자유롭게 서로의 의견에 반박/동의합니다',
  roleAssignment: '각 AI에 캐릭터/역할을 부여하여 토론합니다',
  battle: 'AI 2명이 대결하고 1명이 심판으로 채점합니다',
}

const DELAY_OPTIONS = [5, 10, 15, 30] as const

const REF_MAX_LENGTH = 10_000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf'

// Build grouped options lookup for role select
const ROLE_LABEL_MAP = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]))

// ── Topic Suggestions ──

const DEFAULT_SUGGESTIONS = [
  'AI가 인간의 창의성을 대체할 수 있는가?',
  '원격 근무가 사무실 근무보다 생산적인가?',
  '소셜 미디어는 민주주의에 도움이 되는가?',
  '우주 개발에 국가 예산을 투자해야 하는가?',
]

// Generate topic suggestions inspired by recent debate history
function buildSuggestions(recentTopics: string[]): string[] {
  if (recentTopics.length === 0) return DEFAULT_SUGGESTIONS

  // Category-based spin-off templates keyed by rough keyword matching
  const spinOffs: Record<string, string[]> = {
    AI: [
      'AI 규제는 혁신을 방해하는가?',
      'AI 창작물에 저작권을 부여해야 하는가?',
      'AI 면접관이 인간보다 공정할 수 있는가?',
      'AI가 교사를 대체할 수 있는가?',
    ],
    교육: [
      '대학 교육은 여전히 필수인가?',
      '코딩 교육을 초등학교부터 의무화해야 하는가?',
      '시험 없는 교육이 가능한가?',
      '온라인 학위가 오프라인 학위와 동등한 가치를 갖는가?',
    ],
    경제: [
      '기본 소득제가 경제에 긍정적인가?',
      '암호화폐가 법정화폐를 대체할 수 있는가?',
      '부유세 도입은 정당한가?',
      '4일 근무제는 경제적으로 실현 가능한가?',
    ],
    환경: [
      '원자력 에너지는 친환경적인가?',
      '탄소세가 기후변화 해결에 효과적인가?',
      '전기차 보조금 정책은 지속되어야 하는가?',
      '선진국이 개발도상국의 환경 비용을 부담해야 하는가?',
    ],
    사회: [
      '익명 인터넷은 허용되어야 하는가?',
      '동물 실험은 윤리적으로 정당화될 수 있는가?',
      '사형 제도는 폐지되어야 하는가?',
      '의무 투표제가 민주주의에 도움이 되는가?',
    ],
    기술: [
      '자율주행차 사고의 법적 책임은 누구에게 있는가?',
      '메타버스가 현실 사회를 대체할 수 있는가?',
      '양자 컴퓨터가 현재 암호 체계를 무력화할 것인가?',
      '뇌-컴퓨터 인터페이스의 상용화는 윤리적인가?',
    ],
  }

  // Match topics to categories by keyword
  const matchedCategories = new Set<string>()
  for (const topic of recentTopics) {
    for (const [keyword] of Object.entries(spinOffs)) {
      if (topic.includes(keyword)) {
        matchedCategories.add(keyword)
      }
    }
  }

  // Collect candidate suggestions from matched and fallback categories
  const candidates: string[] = []

  // Add from matched categories first
  for (const cat of matchedCategories) {
    const items = spinOffs[cat]
    if (items) candidates.push(...items)
  }

  // Fill with suggestions from other categories
  for (const [cat, topics] of Object.entries(spinOffs)) {
    if (!matchedCategories.has(cat)) {
      candidates.push(...topics)
    }
  }

  // Filter out topics already debated
  const filtered = candidates.filter(
    (s) => !recentTopics.some((t) => t === s),
  )

  // Shuffle and pick 4
  const shuffled = filtered.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 4)
}

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
  const [judgeProvider, setJudgeProvider] = useState<AIProvider | null>(null)

  // Reference data state
  const [useReference, setUseReference] = useState(false)
  const [referenceText, setReferenceText] = useState('')
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])

  // Pacing state
  const [pacingMode, setPacingMode] = useState<PacingMode>('auto')
  const [autoDelay, setAutoDelay] = useState(5)

  const configs = useSettingsStore((s) => s.configs)
  const startDebate = useDebateStore((s) => s.startDebate)
  const debates = useHistoryStore((s) => s.debates)
  const loadDebates = useHistoryStore((s) => s.loadDebates)

  // Load debates on mount for suggestions
  useEffect(() => {
    void loadDebates()
  }, [loadDebates])

  // Build topic suggestions from recent history
  const suggestions = useMemo(() => {
    const recentTopics = debates.slice(0, 10).map((d) => d.topic)
    return buildSuggestions(recentTopics)
  }, [debates])

  const enabledProviders = useMemo(
    () => PROVIDERS.filter((p) => configs[p].enabled && configs[p].apiKey.trim().length > 0),
    [configs],
  )

  const canStart = topic.trim().length > 0
    && selectedProviders.length >= 2
    && (mode !== 'battle' || (selectedProviders.length >= 3 && judgeProvider !== null))

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
      // Clear judge if no longer in selected
      if (judgeProvider && !next.includes(judgeProvider)) {
        setJudgeProvider(null)
      }
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
      roles: (mode === 'roleAssignment' || mode === 'battle') ? roles : [],
      judgeProvider: mode === 'battle' ? judgeProvider ?? undefined : undefined,
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
      <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
        {/* Topic Suggestions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">추천 주제</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setTopic(s)}
                className={cn(
                  'text-left px-4 py-2.5 text-xs rounded-xl border transition-all leading-relaxed',
                  topic === s
                    ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover hover:border-border',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">토론 주제</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 소설에서 주인공의 성장 과정을 1인칭으로 서술하는 것이 3인칭보다 효과적인가?"
            className="w-full px-4 py-3 text-sm bg-bg-surface border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition placeholder:text-text-muted/60"
            rows={3}
          />
        </div>

        {/* Mode Selection */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">토론 모드</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODE_LABELS) as DiscussionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-2.5 text-xs rounded-xl border transition-all',
                  mode === m
                    ? 'bg-accent/10 border-accent/40 text-accent font-semibold shadow-sm'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover hover:border-border',
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted pl-1">{MODE_DESCRIPTIONS[mode]}</p>
        </div>

        {/* Participants */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">참여 AI 선택</label>
          {enabledProviders.length < 2 && (
            <div className="flex items-center gap-2 text-warning text-xs bg-warning/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>사이드바에서 2개 이상의 AI를 활성화하고 API 키를 입력하세요</span>
            </div>
          )}
          {mode === 'battle' && selectedProviders.length < 3 && selectedProviders.length >= 2 && (
            <div className="flex items-center gap-2 text-warning text-xs bg-warning/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>결전모드는 3개의 AI가 필요합니다 (토론자 2 + 심판 1)</span>
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
                    'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm transition-all',
                    selected
                      ? 'border-transparent font-semibold shadow-sm'
                      : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                  )}
                  style={
                    selected
                      ? {
                          backgroundColor: `${PROVIDER_COLORS[p]}12`,
                          borderColor: `${PROVIDER_COLORS[p]}60`,
                          color: PROVIDER_COLORS[p],
                        }
                      : undefined
                  }
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PROVIDER_COLORS[p] }}
                  />
                  {PROVIDER_LABELS[p]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Judge Selection (Battle Mode) */}
        {mode === 'battle' && selectedProviders.length >= 3 && (
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              ⚖️ 심판 AI 선택
            </label>
            <div className="flex gap-2">
              {selectedProviders.map((p) => {
                const isJudge = judgeProvider === p
                return (
                  <button
                    key={p}
                    onClick={() => setJudgeProvider(p)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all',
                      isJudge
                        ? 'bg-warning/10 border-warning/40 text-warning font-semibold shadow-sm'
                        : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PROVIDER_COLORS[p] }}
                    />
                    {PROVIDER_LABELS[p]}
                    {isJudge && <span className="text-[10px]">⚖️</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-text-muted pl-1">
              심판 AI는 토론에 참여하지 않고 각 라운드를 채점합니다
            </p>
          </div>
        )}

        {/* Role Assignment (역할 배정 모드 + 결전모드) */}
        {(mode === 'roleAssignment' || mode === 'battle') && selectedProviders.length > 0 && (
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              {mode === 'battle' ? '⚔️ 캐릭터 배정 (선택)' : '역할 배정'}
            </label>
            <div className="space-y-2 bg-bg-surface rounded-xl p-3 border border-border">
              {selectedProviders.map((p) => {
                const isJudgeAI = mode === 'battle' && judgeProvider === p
                const role = roles.find((r) => r.provider === p)?.role || '중립'
                return (
                  <div key={p} className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PROVIDER_COLORS[p] }}
                    />
                    <span className="text-xs text-text-secondary w-16 font-medium">{PROVIDER_LABELS[p]}</span>
                    {isJudgeAI ? (
                      <span className="flex-1 px-2.5 py-1.5 text-xs text-warning font-semibold">
                        ⚖️ 심판
                      </span>
                    ) : (
                      <select
                        value={role}
                        onChange={(e) => updateRole(p, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30"
                      >
                        {ROLE_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.roles.map((roleValue) => {
                              const roleLabel = ROLE_LABEL_MAP.get(roleValue)
                              if (!roleLabel) return null
                              return (
                                <option key={roleValue} value={roleLabel}>
                                  {roleLabel}
                                </option>
                              )
                            })}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-2.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            라운드 수: <span className="text-accent font-bold text-xs">{maxRounds}</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={maxRounds}
            onChange={(e) => setMaxRounds(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted px-0.5">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Reference Data */}
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div className={cn(
              'relative w-8 h-[18px] rounded-full transition-colors cursor-pointer',
              useReference ? 'bg-accent' : 'bg-bg-hover',
            )}
              onClick={() => setUseReference(!useReference)}
            >
              <div className={cn(
                'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
                useReference ? 'translate-x-[16px]' : 'translate-x-[2px]',
              )} />
            </div>
            <FileText className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">참고 자료 포함</span>
          </label>

          {useReference && (
            <div className="space-y-3 pl-0">
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
                  className="w-full px-4 py-3 text-sm bg-bg-surface border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition placeholder:text-text-muted/60"
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
                    'flex flex-col items-center justify-center gap-2.5 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                    referenceFiles.length >= MAX_FILES
                      ? 'border-border text-text-muted cursor-not-allowed opacity-40'
                      : 'border-border hover:border-accent/40 text-text-secondary hover:text-accent hover:bg-accent/5',
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
                  <span className="text-xs font-medium">
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
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-bg-surface border border-border rounded-xl text-text-secondary hover:bg-bg-hover transition"
                    >
                      <CameraIcon className="w-4 h-4" />
                      <span className="text-xs">카메라</span>
                    </button>
                    <button
                      onClick={() => void handleGallery()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-bg-surface border border-border rounded-xl text-text-secondary hover:bg-bg-hover transition"
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
                        className="flex items-center gap-3 px-3 py-2 bg-bg-surface rounded-xl border border-border"
                      >
                        {file.mimeType.startsWith('image/') ? (
                          <img
                            src={file.dataUrl}
                            alt={file.filename}
                            className="w-9 h-9 object-cover rounded-lg shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 flex items-center justify-center bg-bg-hover rounded-lg shrink-0">
                            <FileText className="w-4 h-4 text-text-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-primary truncate font-medium">{file.filename}</p>
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
                          className="p-1.5 hover:bg-error/15 rounded-lg text-text-muted hover:text-error transition shrink-0"
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
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">턴 속도 제어</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPacingMode('auto')}
              className={cn(
                'px-3 py-2.5 text-xs rounded-xl border transition-all',
                pacingMode === 'auto'
                  ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                  : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              자동
            </button>
            <button
              onClick={() => setPacingMode('manual')}
              className={cn(
                'px-3 py-2.5 text-xs rounded-xl border transition-all',
                pacingMode === 'manual'
                  ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                  : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              수동
            </button>
          </div>

          {pacingMode === 'auto' ? (
            <div className="grid grid-cols-4 gap-1.5">
              {DELAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setAutoDelay(d)}
                  className={cn(
                    'px-2 py-2 text-xs rounded-xl border transition-all',
                    autoDelay === d
                      ? 'bg-accent/10 border-accent/30 text-accent font-medium'
                      : 'bg-bg-surface border-border text-text-muted hover:bg-bg-hover',
                  )}
                >
                  {d}초
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted pl-1">
              각 AI 응답 후 &apos;다음 턴&apos; 버튼을 눌러야 진행됩니다
            </p>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all',
            canStart
              ? 'bg-accent text-white hover:bg-accent-dim shadow-lg shadow-accent/20 active:scale-[0.98]'
              : 'bg-bg-surface text-text-muted cursor-not-allowed',
          )}
        >
          <Play className="w-4 h-4" />
          {mode === 'battle' ? '결전 시작' : '토론 시작'}
        </button>
      </div>
    </div>
  )
}
