import { describe, expect, it, vi } from 'vitest'
import { CaptionStore } from '../src/main/caption-store'
import { segment } from './fixtures'

describe('CaptionStore', () => {
  it('replaces the active partial and appends a finalized segment once', () => {
    const store = new CaptionStore()
    const listener = vi.fn()
    store.on('change', listener)

    store.upsert(segment({ id: 'active', isFinal: false, sourceText: 'Welcome' }))
    store.upsert(segment({ id: 'active', isFinal: false, sourceText: 'Welcome everyone' }))
    expect(store.getSnapshot().partial?.sourceText).toBe('Welcome everyone')
    expect(store.getTranscript()).toHaveLength(0)

    store.upsert(segment({ id: 'final-1', sourceText: 'Welcome everyone.' }))
    store.upsert(segment({ id: 'final-1', sourceText: 'Welcome, everyone.' }))
    expect(store.getSnapshot().partial).toBeUndefined()
    expect(store.getTranscript()).toEqual([
      expect.objectContaining({ id: 'final-1', sourceText: 'Welcome, everyone.' })
    ])
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('broadcasts only the two latest finalized segments while retaining the export transcript', () => {
    const store = new CaptionStore()
    store.upsert(segment({ id: 'one', sequence: 1 }))
    store.upsert(segment({ id: 'two', sequence: 2 }))
    store.upsert(segment({ id: 'three', sequence: 3 }))

    expect(store.getSnapshot().finalized.map(({ id }) => id)).toEqual(['two', 'three'])
    expect(store.getTranscript()).toHaveLength(3)
  })
})
