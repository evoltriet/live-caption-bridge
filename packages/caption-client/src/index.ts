import {
  CAPTION_PROTOCOL_VERSION,
  captionText,
  isReceiverProfile,
  type CaptionEnvelopeV1,
  type CaptionSegmentV1,
  type ReceiverPreferences,
  type ReceiverProfile
} from '@live-caption-bridge/caption-protocol'

export interface ReceiverAuthMessage {
  type: 'auth'
  token: string
}

export function createReceiverAuthMessage(token: string): ReceiverAuthMessage {
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    throw new Error('Invalid receiver token.')
  }
  return { type: 'auth', token }
}

export function parseCaptionEnvelope(value: string | unknown): CaptionEnvelopeV1 {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Caption event must be an object.')
  }
  const envelope = parsed as Partial<CaptionEnvelopeV1>
  if (
    envelope.version !== CAPTION_PROTOCOL_VERSION ||
    (envelope.type !== 'snapshot' && envelope.type !== 'status') ||
    typeof envelope.sessionId !== 'string' ||
    typeof envelope.sequence !== 'number' ||
    typeof envelope.sentAt !== 'number' ||
    !envelope.payload
  ) {
    throw new Error('Unsupported or malformed caption event.')
  }
  return envelope as CaptionEnvelopeV1
}

export function tokenFromFragment(fragment: string): string | undefined {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token')?.trim()
  return token && /^[a-f0-9]{32}$/i.test(token) ? token : undefined
}

export function normalizeReceiverPreferences(
  value: Partial<ReceiverPreferences> = {}
): ReceiverPreferences {
  const profile: ReceiverProfile = isReceiverProfile(value.profile)
    ? value.profile
    : 'bilingual'
  return {
    profile,
    preferredLocale: value.preferredLocale?.trim() || 'en-US'
  }
}

export function receiverText(
  segment: CaptionSegmentV1 | undefined,
  preferences: ReceiverPreferences
): string[] {
  if (!segment) {
    return []
  }
  if (preferences.profile === 'english') {
    return [captionText(segment, 'en-US')]
  }
  if (preferences.profile === 'vietnamese') {
    return [captionText(segment, 'vi-VN')]
  }
  if (preferences.profile === 'glance') {
    return [captionText(segment, preferences.preferredLocale ?? segment.sourceLocale)]
  }
  return [captionText(segment, 'en-US'), captionText(segment, 'vi-VN')]
}
