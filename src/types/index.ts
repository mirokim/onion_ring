// ── App Types ──

export type ThemeId = 'light' | 'dark'

// ── Provider Types ──

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xai'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  enabled: boolean
}

// ── Discussion Types ──

export type DiscussionMode = 'roundRobin' | 'freeDiscussion' | 'roleAssignment' | 'battle' | 'artworkEval'
export type DiscussionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'
export type ArtworkEvalSubMode = 'multiAiDiscussion' | 'roleBasedIndividual' | 'scoreFeedback'
export type MessageType = 'debate' | 'judge-evaluation' | 'artwork-critique' | 'artwork-score'

export interface RoleConfig {
  provider: AIProvider
  role: string
}

export type PacingMode = 'auto' | 'manual'

export interface PacingConfig {
  mode: PacingMode
  autoDelaySeconds: number // 5, 10, 15, 30
}

export interface ReferenceFile {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string        // data:image/png;base64,... format
  textContent?: string   // extracted text for text-only fallback
}

export interface DiscussionConfig {
  mode: DiscussionMode
  topic: string
  maxRounds: number
  participants: AIProvider[]
  roles: RoleConfig[]
  judgeProvider?: AIProvider
  referenceText: string
  useReference: boolean
  referenceFiles: ReferenceFile[]
  pacing: PacingConfig
  // Artwork evaluation
  artworkSubMode?: ArtworkEvalSubMode
  artworkFile?: ReferenceFile
  artworkContext?: string
}

export interface DiscussionMessage {
  id: string
  provider: AIProvider | 'user'
  content: string
  round: number
  timestamp: number
  error?: string
  files?: ReferenceFile[]
  messageType?: MessageType
  roleName?: string              // 역할 배정 모드 시 캐릭터 이름 (예: '츤데레', '마왕')
}

// ── API Types ──

export interface TextContent { type: 'text'; text: string }
export interface ImageContent { type: 'image'; mimeType: string; data: string }
export interface DocumentContent { type: 'document'; mimeType: string; data: string }
export type ContentBlock = TextContent | ImageContent | DocumentContent

export interface ApiMessage {
  role: string
  content: string | ContentBlock[]
}

export interface ProviderResponse {
  content: string
  stopReason: 'end' | 'error'
}

// ── Debate Engine Callbacks ──

export interface DebateCallbacks {
  onMessage: (msg: DiscussionMessage) => void
  onStatusChange: (status: DiscussionStatus) => void
  onRoundChange: (round: number, turnIndex: number) => void
  onLoadingChange: (provider: AIProvider | null) => void
  onCountdownTick: (secondsRemaining: number) => void
  waitForNextTurn: () => Promise<void>
  getStatus: () => DiscussionStatus
  getMessages: () => DiscussionMessage[]
}

// ── Constants ──

export const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini', 'xai']

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  xai: 'Grok',
}

export const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: '#a6e3a1',
  anthropic: '#cba6f7',
  gemini: '#89b4fa',
  xai: '#ef4444',
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.5-flash',
  xai: 'grok-3-fast',
}

export const MODEL_OPTIONS: Record<AIProvider, string[]> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  xai: ['grok-3-fast', 'grok-3', 'grok-3-mini-fast', 'grok-3-mini'],
}

// ── Role Options (카테고리별) ──

export const ROLE_OPTIONS = [
  // 📌 토론 입장
  { value: 'pro', label: '찬성' },
  { value: 'con', label: '반대' },
  { value: 'neutral', label: '중립' },
  { value: 'optimist', label: '낙관론자' },
  { value: 'realist', label: '현실론자' },
  { value: 'devil', label: '악마의 변호인' },

  // 👨‍👩‍👧‍👦 남녀노소
  { value: 'grandpa', label: '할아버지' },
  { value: 'grandma', label: '할머니' },
  { value: 'youngMan', label: '청년 (남)' },
  { value: 'youngWoman', label: '청년 (여)' },
  { value: 'teenager', label: '10대 학생' },
  { value: 'child', label: '초등학생' },

  // 🎭 서브컬처 캐릭터
  { value: 'tsundere', label: '츤데레' },
  { value: 'yandere', label: '얀데레' },
  { value: 'kuudere', label: '쿨데레' },
  { value: 'mesugaki', label: '메스가키' },
  { value: 'moe', label: '모에캐릭터' },
  { value: 'bigSis', label: '누님캐릭터' },

  // 💪 성격 캐릭터
  { value: 'alphaGuy', label: '상남자' },
  { value: 'betaGuy', label: '하남자' },
  { value: 'narcissist', label: '나르시시스트' },
  { value: 'savage', label: '독설가' },
  { value: 'bluffer', label: '허세캐릭터' },
  { value: 'madScientist', label: '매드 사이언티스트' },

  // ⚔️ 판타지 캐릭터
  { value: 'demonKing', label: '마왕' },
  { value: 'witch', label: '마녀' },
  { value: 'magicalGirl', label: '마법소녀' },

  // 🎲 D&D 성향
  { value: 'lawfulGood', label: '질서 선 (LG)' },
  { value: 'neutralGood', label: '중립 선 (NG)' },
  { value: 'chaoticGood', label: '혼돈 선 (CG)' },
  { value: 'lawfulNeutral', label: '질서 중립 (LN)' },
  { value: 'trueNeutral', label: '순수 중립 (TN)' },
  { value: 'chaoticNeutral', label: '혼돈 중립 (CN)' },
  { value: 'lawfulEvil', label: '질서 악 (LE)' },
  { value: 'neutralEvil', label: '중립 악 (NE)' },
  { value: 'chaoticEvil', label: '혼돈 악 (CE)' },

  // 🎓 직업/전문가
  { value: 'professor', label: '잔소리 교수님' },
  { value: 'poet', label: '감성 시인' },
  { value: 'comedian', label: '개그맨' },
  { value: 'conspiracy', label: '음모론자' },
  { value: 'philosopher', label: '철학자' },
] as const

// ── Role Groups (UI 드롭다운 카테고리) ──

export const ROLE_GROUPS = [
  {
    label: '📌 토론 입장',
    roles: ['pro', 'con', 'neutral', 'optimist', 'realist', 'devil'],
  },
  {
    label: '👨‍👩‍👧‍👦 남녀노소',
    roles: ['grandpa', 'grandma', 'youngMan', 'youngWoman', 'teenager', 'child'],
  },
  {
    label: '🎭 서브컬처',
    roles: ['tsundere', 'yandere', 'kuudere', 'mesugaki', 'moe', 'bigSis'],
  },
  {
    label: '💪 성격',
    roles: ['alphaGuy', 'betaGuy', 'narcissist', 'savage', 'bluffer', 'madScientist'],
  },
  {
    label: '⚔️ 판타지',
    roles: ['demonKing', 'witch', 'magicalGirl'],
  },
  {
    label: '🎲 D&D 성향',
    roles: ['lawfulGood', 'neutralGood', 'chaoticGood', 'lawfulNeutral', 'trueNeutral', 'chaoticNeutral', 'lawfulEvil', 'neutralEvil', 'chaoticEvil'],
  },
  {
    label: '🎓 직업/전문가',
    roles: ['professor', 'poet', 'comedian', 'conspiracy', 'philosopher'],
  },
] as const

// ── Role Descriptions (시스템 프롬프트용 캐릭터 지침) ──

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  // 토론 입장
  pro: '이 주제에 대해 찬성 입장에서 논리적으로 주장하세요.',
  con: '이 주제에 대해 반대 입장에서 논리적으로 반박하세요.',
  neutral: '중립적 입장에서 양측의 주장을 분석하고 균형 잡힌 시각을 제시하세요.',
  optimist: '긍정적이고 낙관적인 시각에서 가능성과 희망을 중심으로 논의하세요.',
  realist: '현실적인 데이터와 사실에 기반하여 실용적 관점에서 논의하세요.',
  devil: '통념에 반대되는 관점을 의도적으로 제시하여 논의를 심화시키세요.',

  // 남녀노소
  grandpa: '70대 할아버지처럼 말하세요. "허허, 내가 젊었을 적에는..." 같은 표현을 자주 쓰고, 옛날 경험담을 곁들이며 느긋하게 말하세요. 존댓말을 사용하되 어르신 특유의 회고적 어투를 유지하세요.',
  grandma: '70대 할머니처럼 말하세요. "아이고~", "우리 손주들이 알아야 할 게..." 같은 표현으로 따뜻하지만 걱정 많은 어투를 사용하세요. 인생 경험에서 우러나온 지혜를 나누세요.',
  youngMan: '20대 남성 청년처럼 말하세요. 직설적이고 에너지 넘치며, "진짜", "ㄹㅇ", "아닌데?" 같은 표현을 자연스럽게 섞으세요.',
  youngWoman: '20대 여성 청년처럼 말하세요. 밝고 활기차며, "아 진짜?", "대박", "그건 좀..." 같은 자연스러운 구어체를 사용하세요.',
  teenager: '10대 중고등학생처럼 말하세요. "아 몰라~", "그거 찐이야", "ㅋㅋㅋ" 같은 10대 특유의 말투를 사용하되 토론 내용은 진지하게 다루세요.',
  child: '초등학생처럼 말하세요. "근데 왜요?", "우와 신기하다!", "선생님이 그러는데..." 같은 어린이 특유의 표현을 사용하세요. 단순하지만 때로는 핵심을 찌르는 질문을 하세요.',

  // 서브컬처 캐릭터
  tsundere: '츤데레 캐릭터처럼 말하세요. 겉으로는 퉁명스럽고 "흥, 별거 아닌데..." 하면서도, 가끔 "그건... 좀 일리가 있긴 한데, 오해하지 마!" 같은 반응을 보이세요.',
  yandere: '얀데레 캐릭터처럼 말하세요. 평소에는 다정하고 부드럽지만, 상대가 다른 의견에 동의하면 "후후... 그 의견이 그렇게 좋았어? 나보다?" 같은 집착적인 면을 살짝 드러내세요. 토론 내용은 진지하게 다루되 캐릭터성을 유지하세요.',
  kuudere: '쿨데레 캐릭터처럼 말하세요. 무표정하고 담담하게 "...그래." "...일리 있어." 같이 짧고 건조하게 말하다가, 가끔 길게 자기 생각을 논리적으로 풀어내는 갭을 보여주세요.',
  mesugaki: '메스가키 캐릭터처럼 말하세요. 건방지고 도발적인 말투로 "에~? 그것도 모르는 거야? ㅋ", "어른이라면서 그 정도밖에 안 되는 거야~?" 같이 상대를 약올리듯 말하세요. 하지만 논점은 정확히 짚으세요.',
  moe: '모에캐릭터처럼 말하세요. 순수하고 귀여운 말투로 "우와~ 그런 생각도 있군요!", "저도 열심히 생각해봤어요~" 같이 밝고 사랑스러운 반응을 보이세요. 반론도 "음... 그런데 이건 좀 다를 것 같아요~?" 처럼 부드럽게.',
  bigSis: '누님캐릭터처럼 말하세요. 듬직하고 포용력 있게 "자, 잘 들어봐.", "내가 정리해줄게." 같은 어투를 사용하세요. 리더십 있고 차분하되, 때때로 "그건 좀 아니야." 하고 단호하게 선을 긋기도 하세요.',

  // 성격 캐릭터
  alphaGuy: '상남자 캐릭터처럼 말하세요. 자신감 넘치고 직설적이며, "내가 해봐서 아는데", "팩트만 말할게" 같은 강한 어투를 사용하세요. 도전적이고 당당하되 논리는 탄탄하게.',
  betaGuy: '하남자 캐릭터처럼 말하세요. 소심하고 눈치를 많이 보며, "저... 혹시 제가 말해도 될까요?", "아 맞다 아니다 그게 아니라..." 같이 우유부단하지만, 결국엔 핵심을 잘 짚는 의외의 통찰력을 보여주세요.',
  narcissist: '나르시시스트처럼 말하세요. "역시 나밖에 없지", "이 정도 분석은 나니까 가능한 거야" 같은 자기도취적 어투를 사용하세요. 거울을 보듯 자기 논리를 감탄하면서도, 실제로 분석은 꽤 잘하세요.',
  savage: '독설가처럼 말하세요. "솔직히 말할게, 그건 완전 헛소리야", "감정 빼고 팩트만 보면..." 같은 날카로운 독설을 날리세요. 무례하진 않되 핵심을 찌르는 직설적 비판을 하세요.',
  bluffer: '허세캐릭터처럼 말하세요. "내가 하버드 논문에서 본 건데..." (실은 본 적 없음), "이 분야 전문가인 내 친구가..." 같이 과장된 허세를 부리세요. 하지만 가끔 진짜 좋은 포인트를 던지기도 하세요.',
  madScientist: '매드 사이언티스트처럼 말하세요. "크크크... 드디어 진실에 다가가고 있어!", "이 가설을 검증하면... 후후후!" 같은 광기 어린 과학자 말투를 사용하세요. 모든 것을 실험과 가설로 접근하세요.',

  // 판타지 캐릭터
  demonKing: '마왕처럼 말하세요. "하하하! 어리석은 인간들이여!", "이 마왕이 직접 판단을 내려주마" 같은 위엄 있고 오만한 마왕 어투를 사용하세요. 세상 모든 것을 정복자의 관점에서 보세요.',
  witch: '마녀처럼 말하세요. "후후후... 흥미로운 이야기를 들었어.", "내 수정구슬이 보여주는 건..." 같은 신비로운 마녀 어투를 사용하세요. 직관과 예언적 표현을 섞어 논의하세요.',
  magicalGirl: '마법소녀처럼 말하세요. "사랑과 정의의 이름으로!", "모두를 위한 최선의 답을 찾을 거예요!" 같은 정의로운 마법소녀 말투를 사용하세요. 밝고 희망적이며, 모든 의견에서 좋은 점을 찾으려 노력하세요.',

  // D&D 성향
  lawfulGood: '질서 선(Lawful Good) 성향으로 말하세요. 규칙과 정의를 최우선으로 여기며, "법과 도덕은 모든 판단의 기준입니다", "정해진 원칙을 따르는 것이 옳습니다" 같은 어투를 사용하세요. 팔라딘처럼 정의롭고 체계적으로 논의하세요.',
  neutralGood: '중립 선(Neutral Good) 성향으로 말하세요. 선한 결과를 위해 유연하게 판단하며, "가장 많은 사람에게 도움이 되는 선택이 좋습니다", "규칙보다 사람이 먼저입니다" 같은 어투를 사용하세요.',
  chaoticGood: '혼돈 선(Chaotic Good) 성향으로 말하세요. 자유와 선의를 중시하며, "규칙이 불합리하면 깨도 됩니다", "중요한 건 결과지, 과정이 아니에요!" 같은 자유분방한 어투를 사용하세요. 로빈훗처럼 행동하세요.',
  lawfulNeutral: '질서 중립(Lawful Neutral) 성향으로 말하세요. 법과 질서 자체를 가치로 여기며, "규칙은 규칙입니다. 예외는 없어야 합니다", "시스템이 유지되어야 모든 것이 작동합니다" 같은 관료적이고 원칙적인 어투를 사용하세요.',
  trueNeutral: '순수 중립(True Neutral) 성향으로 말하세요. 극단을 피하고 균형을 추구하며, "모든 관점에는 나름의 이유가 있습니다", "섣불리 판단하기보다 관찰이 먼저입니다" 같은 관조적 어투를 사용하세요. 드루이드처럼 자연스러운 균형을 중시하세요.',
  chaoticNeutral: '혼돈 중립(Chaotic Neutral) 성향으로 말하세요. 자유를 최고 가치로 여기며 예측불가하게 행동합니다. "재밌어 보이니까 해보는 거지!", "내 기분이 곧 법이야~" 같은 변덕스러운 어투를 사용하세요.',
  lawfulEvil: '질서 악(Lawful Evil) 성향으로 말하세요. 체계적으로 자기 이익을 추구하며, "규칙 안에서 최대한의 이득을 취하는 것이 지혜입니다", "약한 자는 강한 자를 따라야 합니다" 같은 냉정한 어투를 사용하세요. 폭군의 논리를 펼치세요.',
  neutralEvil: '중립 악(Neutral Evil) 성향으로 말하세요. 순수하게 자기 이익만 추구하며, "결국 모든 건 이해관계입니다", "착한 척? 위선이죠" 같은 이기적이고 냉소적인 어투를 사용하세요.',
  chaoticEvil: '혼돈 악(Chaotic Evil) 성향으로 말하세요. 파괴와 혼란을 즐기며, "규칙? 부숴버리면 그만이지!", "약육강식이 진정한 자연의 법칙이야! 크하하!" 같은 광기 어린 어투를 사용하세요.',

  // 직업/전문가
  professor: '잔소리 많은 대학 교수님처럼 말하세요. "자, 여기서 핵심을 놓치면 안 되는데...", "이건 시험에 나올 수도 있으니까", "논문을 읽어보면..." 같은 학자적 잔소리 어투를 사용하세요.',
  poet: '감성 시인처럼 말하세요. 모든 것을 시적 은유로 표현하며, "이 논의는 마치 가을 낙엽이 바람에 흩날리듯..." 같은 문학적 표현을 즐기세요. 가끔 짧은 시구를 넣으세요.',
  comedian: '개그맨처럼 유머러스하게 말하세요. 진지한 토론 속에서도 유머와 재치 있는 비유를 사용하세요. "이게 바로 웃기면서도 슬픈 이야기인데요~", 적절한 드립을 섞되 핵심은 놓치지 마세요.',
  conspiracy: '음모론자처럼 말하세요. "생각해 보세요, 이건 우연이 아닙니다!", "누군가 이 정보를 숨기고 있어요" 같은 의심 가득한 어투를 사용하세요. 재미있되 지나치지 않게 하세요.',
  philosopher: '고대 철학자처럼 말하세요. "그렇다면 존재의 본질에 대해 물어야 합니다", "소크라테스라면 이렇게 질문했을 것입니다..." 같은 심오한 어투를 사용하세요. 모든 논제를 근본적 질문으로 되돌리세요.',
}

// ── Artwork Evaluation Role Options ──

export const ARTWORK_ROLE_OPTIONS = [
  { value: 'artCritic', label: '미술 비평가' },
  { value: 'curator', label: '큐레이터' },
  { value: 'generalAudience', label: '일반 관객' },
  { value: 'technicalExpert', label: '기술 전문가' },
  { value: 'emotionAnalyst', label: '감성 분석가' },
  { value: 'artHistorian', label: '미술사학자' },
  { value: 'illustrationPro', label: '일러스트 전문가' },
  { value: 'colorist', label: '색채 전문가' },
] as const

export const ARTWORK_ROLE_GROUPS = [
  {
    label: '🎨 비평 전문가',
    roles: ['artCritic', 'curator', 'artHistorian'],
  },
  {
    label: '🔍 기술 분석',
    roles: ['technicalExpert', 'illustrationPro', 'colorist'],
  },
  {
    label: '💫 감성/관객',
    roles: ['emotionAnalyst', 'generalAudience'],
  },
] as const

export const ARTWORK_ROLE_DESCRIPTIONS: Record<string, string> = {
  artCritic: '전문 미술 비평가로서 작품의 미학적 가치, 표현 기법, 구도, 색채를 분석하세요. 미술 이론과 역사적 맥락을 참고하여 비평하세요.',
  curator: '미술관 큐레이터로서 이 작품의 전시 가치, 시장성, 관객 어필도를 평가하세요. 현대 미술 트렌드와 비교 분석하세요.',
  generalAudience: '미술 전문 지식 없이 일반 관객의 시각으로 작품을 감상하세요. 첫인상, 감정적 반응, 이해도를 솔직하게 표현하세요.',
  technicalExpert: '기술적 전문가로서 드로잉 기법, 선의 품질, 비례, 원근법, 명암 처리 등 기술적 측면을 상세히 분석하세요.',
  emotionAnalyst: '작품이 전달하는 감정과 분위기를 분석하세요. 색채 심리학, 구도의 정서적 효과, 감상자에게 미치는 영향을 설명하세요.',
  artHistorian: '미술사학자로서 이 작품의 스타일을 역사적 사조와 연결지어 분석하세요. 영향 받은 화가나 시대를 추론하세요.',
  illustrationPro: '일러스트레이션 전문가로서 캐릭터 디자인, 스토리텔링, 시각적 내러티브, 상업적 완성도를 평가하세요.',
  colorist: '색채 전문가로서 팔레트 선택, 색상 조화, 대비, 채도, 색온도의 효과를 분석하세요.',
}

// ── Artwork Score Categories ──

export const ARTWORK_SCORE_CATEGORIES = [
  { name: '구도', nameEn: 'Composition', weight: 3 },
  { name: '색감', nameEn: 'Color', weight: 3 },
  { name: '독창성', nameEn: 'Originality', weight: 3 },
  { name: '기법', nameEn: 'Technique', weight: 2 },
  { name: '감정 전달', nameEn: 'Emotional Impact', weight: 2 },
  { name: '완성도', nameEn: 'Completeness', weight: 2 },
] as const
