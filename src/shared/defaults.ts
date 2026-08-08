import type { CaptionSnapshot } from './contracts'

export const DISPLAY_PORT = 43_117

export function createInitialSnapshot(): CaptionSnapshot {
  return {
    finalized: [],
    status: {
      phase: 'idle',
      provider: 'azure',
      languageMode: 'auto',
      networkOnline: true,
      updatedAt: Date.now()
    }
  }
}
