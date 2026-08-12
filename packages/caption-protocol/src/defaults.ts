import type { CaptionSnapshotV1, LanShareState } from './index'

export const DISPLAY_PORT = 43_117
export const LAN_DISPLAY_PORT = 43_118
export const MAX_LAN_RECEIVERS = 50
export const LAN_WARNING =
  'Local receiver traffic is authenticated but not encrypted. Use only on a trusted venue network.'

export function createInitialSnapshot(): CaptionSnapshotV1 {
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

export function createInactiveLanShareState(): LanShareState {
  return {
    active: false,
    port: LAN_DISPLAY_PORT,
    connectedClients: 0,
    warning: LAN_WARNING
  }
}
