import { describe, expect, it } from 'vitest'
import { serializeTranscript } from '../src/main/exporters'
import { segment } from './fixtures'

describe('transcript exports', () => {
  it('preserves Vietnamese diacritics in text and locale-neutral JSON', () => {
    const item = segment({
      texts: {
        'en-US': 'Wishing you a lifetime of happiness.',
        'vi-VN': 'Chúc hai bạn trăm năm hạnh phúc.'
      }
    })
    expect(serializeTranscript([item], 'txt')).toContain('Chúc hai bạn trăm năm hạnh phúc.')
    expect(JSON.parse(serializeTranscript([item], 'json')).segments[0].texts['vi-VN']).toBe(
      'Chúc hai bạn trăm năm hạnh phúc.'
    )
  })

  it('writes bilingual WebVTT cues with monotonic timings', () => {
    const output = serializeTranscript(
      [
        segment({ id: 'one', startedAt: 1_000, emittedAt: 2_000 }),
        segment({ id: 'two', sequence: 2, startedAt: 4_000, emittedAt: 5_000 })
      ],
      'vtt'
    )
    expect(output).toContain('00:00:00.000 --> 00:00:03.000')
    expect(output).toContain('Welcome to the wedding.\nChào mừng đến với lễ cưới.')
  })
})
