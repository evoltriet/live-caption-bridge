import { randomUUID } from 'node:crypto'
import {
  CAPTION_PROTOCOL_VERSION,
  type CaptionEnvelopeV1,
  type CaptionSnapshotV1,
  type ProviderStatus
} from '@live-caption-bridge/caption-protocol'

export class CaptionEnvelopeFactory {
  private sessionId = randomUUID()
  private sequence = 0

  beginSession(): void {
    this.sessionId = randomUUID()
    this.sequence = 0
  }

  snapshot(payload: CaptionSnapshotV1): CaptionEnvelopeV1 {
    return {
      version: CAPTION_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      sequence: ++this.sequence,
      sentAt: Date.now(),
      type: 'snapshot',
      payload
    }
  }

  status(payload: ProviderStatus): CaptionEnvelopeV1 {
    return {
      version: CAPTION_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      sequence: ++this.sequence,
      sentAt: Date.now(),
      type: 'status',
      payload
    }
  }
}
