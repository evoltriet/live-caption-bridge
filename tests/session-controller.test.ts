import { describe, expect, it, vi } from 'vitest'
import type {
  ProviderEvent,
  SpeechProvider
} from '../src/shared/contracts'
import { CaptionStore } from '../src/main/caption-store'
import { SessionController } from '../src/main/session-controller'
import { segment } from './fixtures'

class FakeProvider implements SpeechProvider {
  readonly kind = 'azure' as const
  started = false
  stopped = false
  chunks = 0
  constructor(private readonly emit: (event: ProviderEvent) => void) {}
  async start(): Promise<void> {
    this.started = true
    this.emit({ type: 'status', status: { phase: 'listening' } })
  }
  pushAudio(): void {
    this.chunks += 1
  }
  async setLanguageMode(): Promise<void> {}
  async stop(): Promise<void> {
    this.stopped = true
  }
  send(event: ProviderEvent): void {
    this.emit(event)
  }
}

describe('SessionController', () => {
  it('normalizes provider events into store state and supports pause recovery', async () => {
    const store = new CaptionStore()
    let provider: FakeProvider | undefined
    const controller = new SessionController(store, (emit) => {
      provider = new FakeProvider(emit)
      return provider
    })
    await controller.start({ provider: 'azure', languageMode: 'auto' })
    provider?.send({ type: 'segment', segment: segment() })
    expect(store.getTranscript()).toHaveLength(1)
    expect(store.getSnapshot().status.phase).toBe('listening')

    await controller.pause('Interface removed.')
    expect(provider?.stopped).toBe(true)
    expect(store.getSnapshot().status).toMatchObject({ phase: 'paused', message: 'Interface removed.' })
  })

  it('enters reconnecting state and retries a fatal provider loss', async () => {
    vi.useFakeTimers()
    const store = new CaptionStore()
    const providers: FakeProvider[] = []
    const controller = new SessionController(store, (emit) => {
      const provider = new FakeProvider(emit)
      providers.push(provider)
      return provider
    })
    await controller.start({ provider: 'azure', languageMode: 'auto' })
    providers[0]?.send({ type: 'fatal', message: 'Network lost.' })
    expect(store.getSnapshot().status.phase).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(1_000)
    expect(providers).toHaveLength(2)
    expect(store.getSnapshot().status.phase).toBe('listening')
    await controller.end()
    vi.useRealTimers()
  })
})
