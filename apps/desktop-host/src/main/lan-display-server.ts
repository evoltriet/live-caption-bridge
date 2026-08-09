import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { renderReceiverPage } from '@live-caption-bridge/web-receiver'
import {
  LAN_DISPLAY_PORT,
  LAN_WARNING,
  MAX_LAN_RECEIVERS,
  type CaptionEnvelopeV1,
  type LanShareState
} from '@live-caption-bridge/caption-protocol'

interface LanDisplayServerOptions {
  address: string
  port?: number
  initialEnvelope: CaptionEnvelopeV1
  onStateChange?: (state: LanShareState) => void
}

export class LanDisplayServer {
  private readonly address: string
  private readonly requestedPort: number
  private readonly server: Server
  private readonly clients = new Set<WebSocket>()
  private readonly pending = new Set<WebSocket>()
  private readonly onStateChange?: (state: LanShareState) => void
  private envelope: CaptionEnvelopeV1
  private token = randomBytes(16).toString('hex')
  private activePort = LAN_DISPLAY_PORT
  private active = false

  constructor(options: LanDisplayServerOptions) {
    if (!isPrivateIpv4(options.address) && options.address !== '127.0.0.1') {
      throw new Error('LAN sharing requires a private IPv4 interface.')
    }
    this.address = options.address
    this.requestedPort = options.port ?? LAN_DISPLAY_PORT
    this.envelope = options.initialEnvelope
    this.onStateChange = options.onStateChange

    const websocketServer = new WebSocketServer({ noServer: true })
    this.server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', `http://${this.address}`)
      if (url.pathname === '/' || url.pathname === '/receiver') {
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ws:"
        })
        response.end(renderReceiverPage())
        return
      }
      if (url.pathname === '/health') {
        const status =
          this.envelope.type === 'snapshot' ? this.envelope.payload.status : this.envelope.payload
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        })
        response.end(
          JSON.stringify({
            ok: true,
            phase: status.phase,
            provider: status.provider,
            clients: this.clients.size,
            updatedAt: status.updatedAt
          })
        )
        return
      }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
    })

    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', `http://${this.address}`)
      if (url.pathname !== '/events') {
        socket.destroy()
        return
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit('connection', websocket, request)
      })
    })

    websocketServer.on('connection', (socket) => {
      if (this.clients.size + this.pending.size >= MAX_LAN_RECEIVERS) {
        socket.close(1013, 'Receiver limit reached')
        return
      }
      this.authenticate(socket)
    })
  }

  async start(): Promise<LanShareState> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.requestedPort, this.address, () => {
        this.server.off('error', reject)
        resolve()
      })
    })
    this.activePort = (this.server.address() as AddressInfo).port
    this.active = true
    const state = this.getState()
    this.onStateChange?.(state)
    return state
  }

  broadcast(envelope: CaptionEnvelopeV1): void {
    this.envelope = envelope
    const payload = JSON.stringify(envelope)
    for (const socket of this.clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload)
      }
    }
  }

  getState(): LanShareState {
    return {
      active: this.active,
      address: this.active ? this.address : undefined,
      port: this.activePort,
      receiverUrl: this.active
        ? `http://${this.address}:${this.activePort}/#token=${this.token}`
        : undefined,
      connectedClients: this.clients.size,
      warning: LAN_WARNING
    }
  }

  async stop(): Promise<LanShareState> {
    this.active = false
    this.token = ''
    for (const socket of [...this.pending, ...this.clients]) {
      socket.close(1008, 'Sharing session ended')
    }
    this.pending.clear()
    this.clients.clear()
    if (this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    const state = this.getState()
    this.onStateChange?.(state)
    return state
  }

  private authenticate(socket: WebSocket): void {
    this.pending.add(socket)
    const timeout = setTimeout(() => socket.close(1008, 'Pairing timed out'), 5_000)

    socket.once('message', (data) => {
      clearTimeout(timeout)
      this.pending.delete(socket)
      if (!this.isValidAuthMessage(data.toString())) {
        socket.close(1008, 'Pairing expired')
        return
      }
      this.clients.add(socket)
      socket.send(JSON.stringify(this.envelope))
      this.onStateChange?.(this.getState())
      socket.on('message', () => socket.close(1008, 'Receiver is read-only'))
      socket.on('close', () => {
        this.clients.delete(socket)
        this.onStateChange?.(this.getState())
      })
    })

    socket.on('close', () => {
      clearTimeout(timeout)
      this.pending.delete(socket)
    })
  }

  private isValidAuthMessage(raw: string): boolean {
    if (!this.token) {
      return false
    }
    try {
      const value = JSON.parse(raw) as { type?: unknown; token?: unknown }
      if (value.type !== 'auth' || typeof value.token !== 'string') {
        return false
      }
      const expected = Buffer.from(this.token, 'utf8')
      const provided = Buffer.from(value.token, 'utf8')
      return provided.length === expected.length && timingSafeEqual(provided, expected)
    } catch {
      return false
    }
  }
}

export function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }
  const [first, second] = parts
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}
