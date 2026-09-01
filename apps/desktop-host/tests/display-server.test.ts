import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createInitialSnapshot } from '@live-caption-bridge/caption-protocol'
import { CaptionEnvelopeFactory } from '../src/main/caption-events'
import { DisplayServer, renderOverlayPage } from '../src/main/display-server'
import { segment } from './fixtures'

let server: DisplayServer | undefined

afterEach(async () => {
  await server?.stop()
  server = undefined
})

describe('local display service', () => {
  it('renders fixed bilingual lanes and transparent OBS/native pages', () => {
    const obsPage = renderOverlayPage('obs')
    const nativePage = renderOverlayPage('native', 43_117, {
      profile: 'vietnamese',
      background: 'transparent',
      opacity: 0.8,
      scale: 1.2
    })
    expect(obsPage).toContain('background: transparent')
    expect(obsPage).toContain('--surface-opacity: 0.65')
    expect(obsPage.indexOf('id="english-lane"')).toBeLessThan(
      obsPage.indexOf('id="vietnamese-lane"')
    )
    expect(obsPage).toContain('Tiếng Việt')
    expect(nativePage).toContain('data-profile="vietnamese"')
    expect(nativePage).toContain('data-background="transparent"')
    expect(nativePage).toContain('--surface-opacity: 0.8')
  })

  it('binds on loopback and emits versioned snapshots without leaking captions in health', async () => {
    const factory = new CaptionEnvelopeFactory()
    const initial = factory.snapshot(createInitialSnapshot())
    server = new DisplayServer({ port: 0, initialEnvelope: initial })
    const port = await server.start()
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.text())
    expect(health).not.toContain('captions')
    expect(JSON.parse(health)).toMatchObject({ ok: true, phase: 'idle' })

    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`)
    const firstMessage = nextMessage(socket)
    await opened(socket)
    expect(JSON.parse(await firstMessage)).toMatchObject({
      version: 1,
      type: 'snapshot',
      payload: { finalized: [] }
    })

    const updateMessage = nextMessage(socket)
    server.broadcast(
      factory.snapshot({ finalized: [segment()], status: createInitialSnapshot().status })
    )
    expect(JSON.parse(await updateMessage)).toMatchObject({
      version: 1,
      payload: { finalized: [expect.objectContaining({ id: 'segment-1' })] }
    })
    socket.close()
  })
})

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', reject)
  })
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    socket.once('message', (data) => resolve(data.toString()))
  })
}
