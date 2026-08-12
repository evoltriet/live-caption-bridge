import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createInitialSnapshot, MAX_LAN_RECEIVERS } from '@live-caption-bridge/caption-protocol'
import { CaptionEnvelopeFactory } from '../src/main/caption-events'
import { LanDisplayServer } from '../src/main/lan-display-server'

let server: LanDisplayServer | undefined

afterEach(async () => {
  await server?.stop()
  server = undefined
})

describe('authenticated LAN receiver service', () => {
  it('serves no caption content before first-message authentication', async () => {
    server = createServer()
    const state = await server.start()
    const page = await fetch(`http://127.0.0.1:${state.port}/`).then((response) => response.text())
    expect(page).toContain('Live Caption Bridge Receiver')
    const health = await fetch(`http://127.0.0.1:${state.port}/health`).then((response) => response.text())
    expect(health).not.toContain('finalized')

    const socket = new WebSocket(`ws://127.0.0.1:${state.port}/events`)
    await opened(socket)
    socket.send(JSON.stringify({ type: 'auth', token: 'wrong' }))
    expect(await closed(socket)).toBe(1008)
  })

  it('accepts the fragment token, publishes a versioned snapshot, and expires pairing on stop', async () => {
    server = createServer()
    const state = await server.start()
    const token = new URL(state.receiverUrl as string).hash.replace('#token=', '')
    const socket = new WebSocket(`ws://127.0.0.1:${state.port}/events`)
    await opened(socket)
    const message = nextMessage(socket)
    socket.send(JSON.stringify({ type: 'auth', token }))
    expect(JSON.parse(await message)).toMatchObject({ version: 1, type: 'snapshot' })
    expect(server.getState().connectedClients).toBe(1)
    const close = closed(socket)
    await server.stop()
    server = undefined
    expect(await close).toBe(1008)
  })

  it('supports fifty simultaneous authenticated read-only receivers', async () => {
    server = createServer()
    const state = await server.start()
    const token = new URL(state.receiverUrl as string).hash.replace('#token=', '')
    const sockets: WebSocket[] = []
    for (let index = 0; index < MAX_LAN_RECEIVERS; index += 1) {
      const socket = new WebSocket(`ws://127.0.0.1:${state.port}/events`)
      sockets.push(socket)
      await opened(socket)
      const message = nextMessage(socket)
      socket.send(JSON.stringify({ type: 'auth', token }))
      await message
    }
    expect(server.getState().connectedClients).toBe(MAX_LAN_RECEIVERS)
    const excess = new WebSocket(`ws://127.0.0.1:${state.port}/events`)
    await opened(excess)
    expect(await closed(excess)).toBe(1013)
    for (const socket of sockets) {
      socket.close()
    }
  })
})

function createServer(): LanDisplayServer {
  const envelope = new CaptionEnvelopeFactory().snapshot(createInitialSnapshot())
  return new LanDisplayServer({ address: '127.0.0.1', port: 0, initialEnvelope: envelope })
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', reject)
  })
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((resolve) => socket.once('message', (data) => resolve(data.toString())))
}

function closed(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => socket.once('close', (code) => resolve(code)))
}
