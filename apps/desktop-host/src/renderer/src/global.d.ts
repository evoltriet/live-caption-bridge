import type { LiveCaptionBridgeApi } from '@live-caption-bridge/caption-protocol'

declare global {
  interface Window {
    liveCaptionBridge: LiveCaptionBridgeApi
  }
}

export {}
