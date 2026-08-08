export type ProviderKind = 'azure' | 'offline'
export type SupportedLocale = 'en-US' | 'vi-VN'
export type LanguageMode = 'auto' | SupportedLocale
export type SessionPhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'paused'
  | 'reconnecting'
  | 'error'

export interface CaptionSegment {
  id: string
  sequence: number
  sourceLocale: SupportedLocale
  sourceText: string
  englishText: string
  vietnameseText: string
  isFinal: boolean
  startedAt: number
  emittedAt: number
}

export interface ProviderStatus {
  phase: SessionPhase
  provider: ProviderKind
  languageMode: LanguageMode
  detectedLocale?: SupportedLocale
  latencyMs?: number
  networkOnline: boolean
  message?: string
  updatedAt: number
}

export interface CaptionSnapshot {
  finalized: CaptionSegment[]
  partial?: CaptionSegment
  status: ProviderStatus
}

export interface SessionConfig {
  provider: ProviderKind
  languageMode: LanguageMode
  azureRegion?: string
  azureKey?: string
  rememberCredentials?: boolean
  warmOfflineFallback?: boolean
}

export interface DisplayInfo {
  id: number
  label: string
  primary: boolean
  width: number
  height: number
}

export interface BootstrapState {
  displays: DisplayInfo[]
  overlayUrl: string
  screenUrl: string
  hasSavedCredentials: boolean
  savedRegion?: string
  snapshot: CaptionSnapshot
}

export interface ExportResult {
  canceled: boolean
  path?: string
}

export type ExportFormat = 'txt' | 'json' | 'vtt'

export type ProviderEvent =
  | { type: 'segment'; segment: CaptionSegment }
  | { type: 'status'; status: Partial<ProviderStatus> }
  | { type: 'fatal'; message: string }

export interface SpeechProvider {
  readonly kind: ProviderKind
  start(config: SessionConfig): Promise<void>
  pushAudio(chunk: ArrayBuffer): void
  setLanguageMode(mode: LanguageMode): Promise<void>
  stop(): Promise<void>
}

export interface WeddingCaptionsApi {
  getBootstrap(): Promise<BootstrapState>
  startSession(config: SessionConfig): Promise<void>
  pauseSession(): Promise<void>
  endSession(): Promise<void>
  clearCaptions(): Promise<void>
  setLanguageMode(mode: LanguageMode): Promise<void>
  reportDeviceLost(): Promise<void>
  updateNetworkState(online: boolean): void
  pushAudio(chunk: ArrayBuffer): void
  openDisplay(displayId: number): Promise<void>
  closeDisplay(): Promise<void>
  exportTranscript(format: ExportFormat): Promise<ExportResult>
  clearSavedCredentials(): Promise<void>
  onSnapshot(callback: (snapshot: CaptionSnapshot) => void): () => void
}

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return value === 'en-US' || value === 'vi-VN'
}

export function isLanguageMode(value: unknown): value is LanguageMode {
  return value === 'auto' || value === 'en-US' || value === 'vi-VN'
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return value === 'azure' || value === 'offline'
}

export function assertSessionConfig(value: unknown): asserts value is SessionConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('Session configuration is required.')
  }

  const config = value as Partial<SessionConfig>
  if (!isProviderKind(config.provider) || !isLanguageMode(config.languageMode)) {
    throw new Error('Unsupported provider or language mode.')
  }

  if (config.provider === 'azure') {
    if (config.azureRegion !== undefined && typeof config.azureRegion !== 'string') {
      throw new Error('Azure region must be text.')
    }
    if (config.azureKey !== undefined && typeof config.azureKey !== 'string') {
      throw new Error('Azure key must be text.')
    }
  }
}
