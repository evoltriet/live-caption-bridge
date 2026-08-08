import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { DisplayServer, renderOverlayPage } from '../src/main/display-server'
import { createInitialSnapshot } from '../src/shared/defaults'
import { segment } from './fixtures'

let server: DisplayServer | undefined

afterEach(async () => {
  await server?.stop()
  server = undefined
})

describe('local display service', () => {
  it('renders fixed bilingual lanes and an OBS-transparent page', () => {
    const page = renderOverlayPage('obs')
    expect(page).toContain('background: transparent')
    expect(page.indexOf('id="english-lane"')).toBeLessThan(page.indexOf('id="vietnamese-lane"'))
    expect(page).toContain('Tiếng Việt')
  })

  it('binds on loopback and emits snapshots over WebSocket without leaking captions in health', async () => {
    server = new DisplayServer({ port: 0, initialSnapshot: createInitialSnapshot() })
    const port = await server.start()
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.text())
    expect(health).not.toContain('captions')
    expect(JSON.parse(health)).toMatchObject({ ok: true, phase: 'idle' })

    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`)
    const firstMessage = new Promise<string>((resolve) => {
      socket.once('message', (data) => resolve(data.toString()))
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve())
      socket.once('error', reject)
    })
    expect(JSON.parse(await firstMessage)).toMatchObject({ finalized: [] })
    const updateMessage = new Promise<string>((resolve) => {
      socket.once('message', (data) => resolve(data.toString()))
    })
    server.broadcast({ finalized: [segment()], status: createInitialSnapshot().status })
    expect(JSON.parse(await updateMessage)).toMatchObject({
      finalized: [expect.objectContaining({ id: 'segment-1' })]
    })
    socket.close()
  })
})
