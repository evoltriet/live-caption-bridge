export const CAPTION_PROTOCOL_VERSION = 1 as const

export type ProviderKind = 'azure' | 'offline'
export type QualifiedLocale = 'en-US' | 'vi-VN'
export type SupportedLocale = QualifiedLocale
export type LanguageMode = 'auto' | QualifiedLocale
export type ReceiverProfile = 'bilingual' | 'english' | 'vietnamese' | 'glance'
export type OverlayPlacement = 'top' | 'center' | 'bottom'
export type OverlayBackground = 'transparent' | 'gradient' | 'solid'
export type SessionPhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'paused'
  | 'reconnecting'
  | 'error'

export interface CaptionSegmentV1 {
  id: string
  sequence: number
  sourceLocale: string
  sourceText: string
  texts: Record<string, string>
  isFinal: boolean
  startedAt: number
  emittedAt: number
}

export type CaptionSegment = CaptionSegmentV1

export interface ProviderStatus {
  phase: SessionPhase
  provider: ProviderKind
  languageMode: LanguageMode
  detectedLocale?: string
  latencyMs?: number
  networkOnline: boolean
  message?: string
  updatedAt: number
}

export interface CaptionSnapshotV1 {
  finalized: CaptionSegmentV1[]
  partial?: CaptionSegmentV1
  status: ProviderStatus
}

export type CaptionSnapshot = CaptionSnapshotV1

interface CaptionEnvelopeBaseV1 {
  version: typeof CAPTION_PROTOCOL_VERSION
  sessionId: string
  sequence: number
  sentAt: number
}

export type CaptionEnvelopeV1 =
  | (CaptionEnvelopeBaseV1 & {
      type: 'snapshot'
      payload: CaptionSnapshotV1
    })
  | (CaptionEnvelopeBaseV1 & {
      type: 'status'
      payload: ProviderStatus
    })

export interface ReceiverPreferences {
  profile: ReceiverProfile
  preferredLocale?: string
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

export interface LanInterfaceInfo {
  address: string
  label: string
}

export interface LanShareState {
  active: boolean
  address?: string
  port: number
  receiverUrl?: string
  connectedClients: number
  warning: string
}

export interface NativeOverlayOptions {
  displayId: number
  placement: OverlayPlacement
  widthPercent: number
  scale: number
  opacity: number
  background: OverlayBackground
  profile: ReceiverProfile
}

export interface BootstrapState {
  displays: DisplayInfo[]
  overlayUrl: string
  screenUrl: string
  lanInterfaces: LanInterfaceInfo[]
  lanShare: LanShareState
  hasSavedCredentials: boolean
  savedRegion?: string
  snapshot: CaptionSnapshotV1
}

export interface ExportResult {
  canceled: boolean
  path?: string
}

export type ExportFormat = 'txt' | 'json' | 'vtt'

export type ProviderEvent =
  | { type: 'segment'; segment: CaptionSegmentV1 }
  | { type: 'status'; status: Partial<ProviderStatus> }
  | { type: 'fatal'; message: string }

export interface SpeechProvider {
  readonly kind: ProviderKind
  start(config: SessionConfig): Promise<void>
  pushAudio(chunk: ArrayBuffer): void
  setLanguageMode(mode: LanguageMode): Promise<void>
  stop(): Promise<void>
}

export interface LiveCaptionBridgeApi {
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
  openNativeOverlay(options: NativeOverlayOptions): Promise<void>
  closeNativeOverlay(): Promise<void>
  startLanSharing(address: string): Promise<LanShareState>
  stopLanSharing(): Promise<LanShareState>
  exportTranscript(format: ExportFormat): Promise<ExportResult>
  clearSavedCredentials(): Promise<void>
  onSnapshot(callback: (snapshot: CaptionSnapshotV1) => void): () => void
  onLanShare(callback: (state: LanShareState) => void): () => void
}

export function isQualifiedLocale(value: string | undefined): value is QualifiedLocale {
  return value === 'en-US' || value === 'vi-VN'
}

export const isSupportedLocale = isQualifiedLocale

export function isLanguageMode(value: unknown): value is LanguageMode {
  return value === 'auto' || value === 'en-US' || value === 'vi-VN'
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return value === 'azure' || value === 'offline'
}

export function isReceiverProfile(value: unknown): value is ReceiverProfile {
  return (
    value === 'bilingual' ||
    value === 'english' ||
    value === 'vietnamese' ||
    value === 'glance'
  )
}

export function isOverlayPlacement(value: unknown): value is OverlayPlacement {
  return value === 'top' || value === 'center' || value === 'bottom'
}

export function isOverlayBackground(value: unknown): value is OverlayBackground {
  return value === 'transparent' || value === 'gradient' || value === 'solid'
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

export function assertNativeOverlayOptions(
  value: unknown
): asserts value is NativeOverlayOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Overlay options are required.')
  }
  const options = value as Partial<NativeOverlayOptions>
  if (
    typeof options.displayId !== 'number' ||
    !isOverlayPlacement(options.placement) ||
    !isOverlayBackground(options.background) ||
    !isReceiverProfile(options.profile) ||
    typeof options.widthPercent !== 'number' ||
    options.widthPercent < 40 ||
    options.widthPercent > 100 ||
    typeof options.scale !== 'number' ||
    options.scale < 0.7 ||
    options.scale > 1.6 ||
    typeof options.opacity !== 'number' ||
    options.opacity < 0.2 ||
    options.opacity > 1
  ) {
    throw new Error('Invalid native overlay options.')
  }
}

export function captionText(segment: CaptionSegmentV1 | undefined, locale: string): string {
  if (!segment) {
    return ''
  }
  return segment.texts[locale] ?? (segment.sourceLocale === locale ? segment.sourceText : '')
}

export {
  DISPLAY_PORT,
  LAN_DISPLAY_PORT,
  LAN_WARNING,
  MAX_LAN_RECEIVERS,
  createInactiveLanShareState,
  createInitialSnapshot
} from './defaults'
