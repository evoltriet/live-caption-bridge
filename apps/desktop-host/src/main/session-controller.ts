import type {
  LanguageMode,
  ProviderEvent,
  SessionConfig,
  SpeechProvider
} from '@live-caption-bridge/caption-protocol'
import { CaptionStore } from './caption-store'
import { AzureSpeechProvider, type ProviderEventHandler } from './providers/azure-provider'

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const

export type ProviderFactory = (emit: ProviderEventHandler) => SpeechProvider

export class SessionController {
  private readonly store: CaptionStore
  private readonly providerFactory: ProviderFactory
  private provider?: SpeechProvider
  private config?: SessionConfig
  private active = false
  private retryAttempt = 0
  private retryTimer?: NodeJS.Timeout
  private generation = 0

  constructor(
    store: CaptionStore,
    providerFactory: ProviderFactory = (emit) => new AzureSpeechProvider(emit)
  ) {
    this.store = store
    this.providerFactory = providerFactory
  }

  async start(config: SessionConfig): Promise<void> {
    await this.stopProvider()
    this.config = { ...config }
    this.active = true
    this.retryAttempt = 0
    await this.startProvider()
  }

  pushAudio(chunk: ArrayBuffer): void {
    this.provider?.pushAudio(chunk)
  }

  async pause(message = 'Captions paused.'): Promise<void> {
    this.active = false
    this.cancelRetry()
    await this.stopProvider()
    this.store.updateStatus({ phase: 'paused', message })
  }

  async end(): Promise<void> {
    this.active = false
    this.config = undefined
    this.cancelRetry()
    await this.stopProvider()
    this.store.updateStatus({ phase: 'idle', message: undefined })
  }

  async setLanguageMode(mode: LanguageMode): Promise<void> {
    if (!this.config) {
      this.store.updateStatus({ languageMode: mode })
      return
    }
    this.config = { ...this.config, languageMode: mode }
    if (this.active) {
      await this.start(this.config)
    }
  }

  private async startProvider(): Promise<void> {
    if (!this.active || !this.config) {
      return
    }
    const currentGeneration = ++this.generation
    const emit = (event: ProviderEvent): void => {
      if (currentGeneration !== this.generation) {
        return
      }
      this.handleProviderEvent(event)
    }
    this.provider = this.providerFactory(emit)
    this.store.updateStatus({
      phase: 'connecting',
      provider: this.provider.kind,
      languageMode: this.config.languageMode,
      message: undefined
    })
    try {
      await this.provider.start(this.config)
      this.retryAttempt = 0
    } catch (error) {
      this.handleProviderFailure(safeErrorMessage(error))
      throw error
    }
  }

  private handleProviderEvent(event: ProviderEvent): void {
    if (event.type === 'segment') {
      this.store.upsert(event.segment)
      this.store.updateStatus({
        detectedLocale: event.segment.sourceLocale,
        latencyMs: Math.max(0, event.segment.emittedAt - event.segment.startedAt)
      })
      return
    }
    if (event.type === 'status') {
      this.store.updateStatus(event.status)
      return
    }
    this.handleProviderFailure(event.message)
  }

  private handleProviderFailure(message: string): void {
    if (!this.active) {
      return
    }
    this.store.updateStatus({ phase: 'reconnecting', message })
    this.cancelRetry()
    const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)]
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => {
      void this.restartAfterFailure()
    }, delay)
  }

  private async restartAfterFailure(): Promise<void> {
    if (!this.active) {
      return
    }
    try {
      await this.stopProvider()
      await this.startProvider()
    } catch {
      // startProvider schedules the next bounded retry.
    }
  }

  private async stopProvider(): Promise<void> {
    this.generation += 1
    const provider = this.provider
    this.provider = undefined
    if (provider) {
      await provider.stop()
    }
  }

  private cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Speech provider failed.'
}
