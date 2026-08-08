import { describe, expect, it } from 'vitest'
import { redactLogValue } from '../src/main/redaction'

describe('operational log redaction', () => {
  it('removes credentials, caption content, transcript content, and arbitrary strings', () => {
    expect(
      redactLogValue({
        phase: 2,
        azureKey: 'super-secret',
        captionText: 'private toast',
        nested: { transcript: ['also private'] }
      })
    ).toEqual({
      phase: 2,
      azureKey: '[REDACTED]',
      captionText: '[REDACTED]',
      nested: { transcript: '[REDACTED]' }
    })
  })
})
