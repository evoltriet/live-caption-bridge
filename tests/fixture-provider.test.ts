import { describe, expect, it } from 'vitest'
import type { ProviderEvent } from '../src/shared/contracts'
import { FixtureSpeechProvider } from '../src/main/providers/fixture-provider'

describe('development PCM fixture provider', () => {
  it('publishes a bilingual partial and final after PCM is injected', async () => {
    const events: ProviderEvent[] = []
    const provider = new FixtureSpeechProvider((event) => events.push(event))
    await provider.start({ provider: 'azure', languageMode: 'auto' })
    provider.pushAudio(new ArrayBuffer(3_200))
    provider.pushAudio(new ArrayBuffer(9_600))

    const segments = events.filter((event) => event.type === 'segment')
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ segment: { isFinal: false } })
    expect(segments[1]).toMatchObject({
      segment: {
        isFinal: true,
        englishText: 'Welcome, family and friends.',
        vietnameseText: 'Chào mừng gia đình và bạn bè.'
      }
    })
  })
})
