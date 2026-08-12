import { describe, expect, it } from 'vitest'
import {
  createReceiverAuthMessage,
  normalizeReceiverPreferences,
  parseCaptionEnvelope,
  receiverText,
  tokenFromFragment
} from '@live-caption-bridge/caption-client'
import { CaptionEnvelopeFactory } from '../src/main/caption-events'
import { createInitialSnapshot } from '@live-caption-bridge/caption-protocol'
import { segment } from './fixtures'

describe('public caption protocol and client', () => {
  it('parses version 1 envelopes and rejects unknown versions', () => {
    const envelope = new CaptionEnvelopeFactory().snapshot(createInitialSnapshot())
    expect(parseCaptionEnvelope(JSON.stringify(envelope))).toMatchObject({ version: 1 })
    expect(() => parseCaptionEnvelope({ ...envelope, version: 2 })).toThrow(
      'Unsupported or malformed caption event'
    )
  })

  it('keeps locale selection in the receiver instead of the provider transport', () => {
    const item = segment()
    expect(receiverText(item, normalizeReceiverPreferences({ profile: 'english' }))).toEqual([
      'Welcome to the wedding.'
    ])
    expect(
      receiverText(
        item,
        normalizeReceiverPreferences({ profile: 'glance', preferredLocale: 'vi-VN' })
      )
    ).toEqual(['Chào mừng đến với lễ cưới.'])
  })

  it('reads pairing secrets only from URL fragments and validates auth messages', () => {
    const token = '0123456789abcdef0123456789abcdef'
    expect(tokenFromFragment(`#token=${token}`)).toBe(token)
    expect(tokenFromFragment('?token=not-a-token')).toBeUndefined()
    expect(createReceiverAuthMessage(token)).toEqual({ type: 'auth', token })
    expect(() => createReceiverAuthMessage('short')).toThrow('Invalid receiver token')
  })
})
