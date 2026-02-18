# AI 토론 (Multi-AI Debate) 기능 구현 계획

## Context

Onion Editor에 이미 OpenAI, Anthropic, Gemini, Llama 4개 프로바이더가 통합되어 있고, Triple Mode로 병렬 응답 비교가 가능하다. 하지만 현재는 AI들이 **서로의 의견을 참고하며 대화**하는 기능이 없다. 이 기능을 추가하여 유저가 주제를 던지면 여러 AI가 순차적으로 토론하며 다양한 관점의 조언을 제공하도록 한다.

---

## 구현 개요

**새로 생성할 파일 (3개):**
- `src/stores/debateStore.ts` — 토론 상태 관리 (Zustand)
- `src/ai/debateEngine.ts` — 토론 엔진 (라운드/턴 관리, API 호출 오케스트레이션)
- `src/components/panels/DebatePanel.tsx` — 토론 UI 패널

**수정할 파일 (4개):**
- `src/types/index.ts` — 타입 추가 + RightPanelTab 확장
- `src/components/layout/RightPanel.tsx` — 패널 라우팅 추가
- `src/components/layout/TopBar.tsx` — AI 그룹에 토론 버튼 추가
- `src/i18n.ts` — 한국어/영어 번역 추가

---

## Step 1: 타입 정의 추가

**파일:** `src/types/index.ts`

AIConversation 인터페이스 뒤 (line 234 이후)에 추가:

```typescript
// ── AI Debate / Discussion ──

export type DiscussionMode = 'roundRobin' | 'freeDiscussion' | 'roleAssignment'
export type DiscussionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface DiscussionRoleConfig {
  provider: AIProvider
  role: string              // "찬성", "반대", "중립" 등
  systemPrompt?: string     // 자동 생성되지만 유저가 오버라이드 가능
}

export interface DiscussionConfig {
  mode: DiscussionMode
  topic: string
  maxRounds: number         // default 3
  participants: AIProvider[]
  roles: DiscussionRoleConfig[]  // roleAssignment 모드에서만 사용
  projectContext: boolean
}

export interface DiscussionMessage {
  id: string
  provider: AIProvider | 'user'
  role: 'participant' | 'user'
  content: string
  round: number
  timestamp: number
  error?: string
}

export interface Discussion {
  id: string
  projectId: string
  config: DiscussionConfig
  messages: DiscussionMessage[]
  status: DiscussionStatus
  currentRound: number
  currentTurnIndex: number
  createdAt: number
  updatedAt: number
}
```

RightPanelTab에 `'debate'` 추가 (line 243):
```typescript
export type RightPanelTab = '...' | 'debate' | null
```

---

## Step 2: 토론 엔진 생성

**파일:** `src/ai/debateEngine.ts` (~200줄)

핵심 로직:
- `runDebateEngine(discussion, providerConfigs, callbacks)` — 메인 엔진 함수
- `buildDebateApiMessages(discussion, currentProvider, systemPrompt)` — 프로바이더별 메시지 변환

**메시지 포매팅 전략:**
현재 AI(provider X)의 관점에서 대화 내역을 구성:
- provider X의 이전 발언 → `role: 'assistant'`
- 다른 AI의 발언 → `role: 'user'`, `"[Claude]: 내용..."` 형식으로 라벨 붙임
- 유저 개입 → `role: 'user'`, `"[User]: 내용..."` 형식

**라운드 관리:**
```
for (round = 1 to maxRounds):
  for (participant in participants):
    1. 시스템 프롬프트 구성 (모드별)
    2. 전체 대화 내역을 API 메시지 형식으로 변환
    3. callWithTools(config, messages, false) 호출 (도구 없이)
    4. 응답을 DiscussionMessage로 추가
    5. pause/stop 상태 확인
```

**토론 모드별 시스템 프롬프트:**
- Round Robin: "순서대로 이전 발언에 이어서 의견을 제시하세요"
- Free Discussion: "자유롭게 다른 참여자의 의견에 반박/동의하세요"
- Role Assignment: "당신의 역할은 {역할}입니다. 이 관점에서 논의하세요"

기존 `callWithTools()` (providers.ts:142)를 그대로 재사용. `useTools: false`로 호출하여 텍스트 전용 응답만 받음.

**AbortController:** `callWithTools`에 optional `signal` 파라미터 추가하여 토론 중단 시 진행 중인 API 호출을 취소할 수 있게 함.

---

## Step 3: Zustand 스토어 생성

**파일:** `src/stores/debateStore.ts` (~250줄)

```typescript
interface DebateState {
  currentDiscussion: Discussion | null
  discussions: Discussion[]         // 프로젝트별 히스토리

  startDiscussion(config, projectId): Promise<void>
  pauseDiscussion(): void
  resumeDiscussion(): void
  stopDiscussion(): void
  userIntervene(message: string): Promise<void>

  loadDiscussions(projectId): void
  selectDiscussion(id): void
  deleteDiscussion(id): void
}
```

- Zustand persist 미들웨어로 localStorage 저장 (DB 변경 불필요)
- `aiStore`에서 프로바이더 설정(configs, activeProviders) 읽기
- 앱 재시작 시 `running` 상태 → `paused`로 복구

---

## Step 4: UI 패널 컴포넌트

**파일:** `src/components/panels/DebatePanel.tsx` (~550줄)

**3개 뷰:**

### SetupView (토론 설정)
- 주제 입력 textarea
- 모드 선택 탭 (라운드 로빈 / 자유 토론 / 역할 배정)
- 참여자 선택 (활성화된 프로바이더 중 체크박스)
- 역할 배정 UI (roleAssignment 모드일 때만 표시)
  - 프로바이더별 역할 드롭다운: 찬성, 반대, 중립, 낙관론자, 현실론자, 악마의 변호인
- 라운드 수 슬라이더 (1~10, 기본값 3)
- 프로젝트 컨텍스트 포함 토글
- "토론 시작" 버튼

### DiscussionView (토론 진행/완료)
- 상단 컨트롤: 라운드 X/Y 표시, 일시정지/재개/종료 버튼
- 메시지 스크롤 영역
  - 각 메시지: 프로바이더 색상 바 (PROVIDER_COLORS 재사용) + 라벨 + 라운드 번호 + 내용
  - 로딩 중인 AI: 타이핑 인디케이터
- 하단 유저 개입 입력: textarea + 전송 버튼

### HistoryView (토론 히스토리)
- 과거 토론 목록 (ConversationsPanel과 유사)
- 각 항목: 주제, 날짜, 참여자, 라운드 수

**기존 코드 재사용:**
- `PROVIDER_COLORS` / `PROVIDER_LABELS` — AIPanel.tsx에서 동일 상수 사용
- 스크롤 패턴 — AIPanel의 `scrollRef` 동일 패턴
- 스타일링 — `bg-bg-surface border border-border rounded-lg` 등 기존 패턴

---

## Step 5: 패널 시스템 통합

### `src/components/layout/TopBar.tsx`
- `Scale` 아이콘 import 추가 (lucide-react)
- AI 그룹에 `{ tab: 'debate', icon: Scale }` 추가 (line 42, references 앞)

### `src/components/layout/RightPanel.tsx`
- `DebatePanel` import 추가
- `{tab === 'debate' && <DebatePanel />}` 라우팅 추가 (line 52 뒤)

---

## Step 6: 번역 추가

**파일:** `src/i18n.ts`

panel 섹션에 추가:
```
debate: 'AI Debate' / 'AI 토론'
```

ai 섹션에 debate 하위 키 추가:
```
debate.title / debate.topic / debate.topicPlaceholder
debate.roundRobin / debate.freeDiscussion / debate.roleAssignment
debate.start / debate.pause / debate.resume / debate.stop
debate.roundIndicator / debate.intervene
debate.rolePro / debate.roleCon / debate.roleNeutral 등
```

---

## Step 7: providers.ts 수정

**파일:** `src/ai/providers.ts` (line 142)

`callWithTools` 함수에 optional `signal?: AbortSignal` 파라미터 추가:
```typescript
export async function callWithTools(
  config: AIConfig,
  messages: ApiMessage[],
  useTools: boolean = true,
  attachments?: AIAttachment[],
  signal?: AbortSignal,          // 추가
): Promise<ProviderResponse> {
```
각 프로바이더의 `fetch()` 호출에 `signal` 전달.

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| API 실패 | 에러 메시지 표시 후 다음 참여자로 넘어감, 연속 2회 이상 실패 시 자동 일시정지 |
| Rate limit (429) | 10초 대기 후 1회 재시도, 실패 시 일시정지 |
| 유저 개입 | DiscussionMessage로 삽입, 다음 AI가 이를 참고하여 응답 |
| 프로바이더 비활성화 | 턴 전 체크, 2개 미만이면 자동 종료 |
| 앱 재시작 | running → paused 복구, Resume 버튼 표시 |
| 긴 대화 컨텍스트 | 최근 15개 메시지만 API에 전달, 나머지는 저장만 |

---

## 검증 계획

1. **기본 동작**: 2개 프로바이더로 라운드 로빈 1라운드 토론 실행 → 각 AI가 순서대로 응답하는지 확인
2. **3개 프로바이더**: OpenAI + Claude + Gemini 3개로 3라운드 실행 → 대화 맥락 유지 확인
3. **모드 전환**: 라운드 로빈 → 자유 토론 → 역할 배정 각각 테스트
4. **일시정지/재개**: 토론 중 일시정지 → 재개 시 이어서 진행되는지 확인
5. **유저 개입**: 토론 중 유저가 메시지를 보내면 다음 AI가 이를 참고하는지 확인
6. **에러 처리**: 잘못된 API 키로 1개 프로바이더 실패 시 나머지가 계속 진행하는지 확인
7. **패널 통합**: TopBar에서 AI 토론 버튼 클릭 → 패널 열림/닫힘 확인
