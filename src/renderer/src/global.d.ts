import type { WeddingCaptionsApi } from '../../shared/contracts'

declare global {
  interface Window {
    weddingCaptions: WeddingCaptionsApi
  }
}

export {}
