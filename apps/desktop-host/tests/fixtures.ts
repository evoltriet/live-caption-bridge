import type { CaptionSegment } from '@live-caption-bridge/caption-protocol'

export function segment(overrides: Partial<CaptionSegment> = {}): CaptionSegment {
  return {
    id: 'segment-1',
    sequence: 1,
    sourceLocale: 'en-US',
    sourceText: 'Welcome to the wedding.',
    texts: {
      'en-US': 'Welcome to the wedding.',
      'vi-VN': 'Chào mừng đến với lễ cưới.'
    },
    isFinal: true,
    startedAt: 1_000,
    emittedAt: 2_000,
    ...overrides
  }
}
