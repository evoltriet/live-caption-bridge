import type {
  LanguageMode,
  ProviderEvent,
  SessionConfig,
  SpeechProvider,
  SupportedLocale
} from '../../shared/contracts'

/** Development-only provider used by deterministic Electron fixture tests. */
export class FixtureSpeechProvider implements SpeechProvider {
  readonly kind = 'azure' as const
  private byteCount = 0
  private emittedPartial = false
  private emittedFinal = false
  private startedAt = 0
  private mode: LanguageMode = 'auto'

  constructor(private readonly emit: (event: ProviderEvent) => void) {}

  async start(config: SessionConfig): Promise<void> {
    this.mode = config.languageMode
    this.startedAt = Date.now()
    this.emit({ type: 'status', status: { phase: 'listening', message: undefined } })
  }

  pushAudio(chunk: ArrayBuffer): void {
    this.byteCount += chunk.byteLength
    if (!this.emittedPartial && this.byteCount >= 3_200) {
      this.emittedPartial = true
      this.emit({ type: 'segment', segment: this.segment(false) })
    }
    if (!this.emittedFinal && this.byteCount >= 12_800) {
      this.emittedFinal = true
      this.emit({ type: 'segment', segment: this.segment(true) })
    }
  }

  async setLanguageMode(mode: LanguageMode): Promise<void> {
    this.mode = mode
  }

  async stop(): Promise<void> {}

  private segment(isFinal: boolean) {
    const sourceLocale: SupportedLocale = this.mode === 'vi-VN' ? 'vi-VN' : 'en-US'
    return {
      id: isFinal ? 'fixture-final-1' : 'fixture-active',
      sequence: 1,
      sourceLocale,
      sourceText: sourceLocale === 'en-US' ? 'Welcome, family and friends.' : 'Chào mừng gia đình và bạn bè.',
      englishText: 'Welcome, family and friends.',
      vietnameseText: 'Chào mừng gia đình và bạn bè.',
      isFinal,
      startedAt: this.startedAt,
      emittedAt: Date.now()
    }
  }
}
