import { EventEmitter } from 'node:events'
import type {
  CaptionSegment,
  CaptionSnapshot,
  ProviderStatus
} from '../shared/contracts'
import { createInitialSnapshot } from '../shared/defaults'

const MAX_BROADCAST_SEGMENTS = 2

export class CaptionStore extends EventEmitter {
  private finalized: CaptionSegment[] = []
  private partial?: CaptionSegment
  private status: ProviderStatus = createInitialSnapshot().status

  upsert(segment: CaptionSegment): void {
    if (segment.isFinal) {
      const existingIndex = this.finalized.findIndex((item) => item.id === segment.id)
      if (existingIndex >= 0) {
        this.finalized[existingIndex] = segment
      } else {
        this.finalized.push(segment)
      }
      this.partial = undefined
    } else {
      this.partial = segment
    }
    this.emitChange()
  }

  updateStatus(patch: Partial<ProviderStatus>): void {
    this.status = {
      ...this.status,
      ...patch,
      updatedAt: Date.now()
    }
    this.emitChange()
  }

  clear(): void {
    this.finalized = []
    this.partial = undefined
    this.emitChange()
  }

  getSnapshot(): CaptionSnapshot {
    return {
      finalized: this.finalized.slice(-MAX_BROADCAST_SEGMENTS).map(cloneSegment),
      partial: this.partial ? cloneSegment(this.partial) : undefined,
      status: { ...this.status }
    }
  }

  getTranscript(): CaptionSegment[] {
    return this.finalized.map(cloneSegment)
  }

  private emitChange(): void {
    this.emit('change', this.getSnapshot())
  }
}

function cloneSegment(segment: CaptionSegment): CaptionSegment {
  return { ...segment }
}
