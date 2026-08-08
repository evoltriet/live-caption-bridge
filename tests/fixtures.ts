import type { CaptionSegment } from '../src/shared/contracts'

export function segment(overrides: Partial<CaptionSegment> = {}): CaptionSegment {
  return {
    id: 'segment-1',
    sequence: 1,
    sourceLocale: 'en-US',
    sourceText: 'Welcome to the wedding.',
    englishText: 'Welcome to the wedding.',
    vietnameseText: 'Chào mừng đến với lễ cưới.',
    isFinal: true,
    startedAt: 1_000,
    emittedAt: 2_000,
    ...overrides
  }
}
