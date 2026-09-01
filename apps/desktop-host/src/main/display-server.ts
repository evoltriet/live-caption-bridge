import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import {
  DISPLAY_PORT,
  type CaptionEnvelopeV1,
  type OverlayBackground,
  type ReceiverProfile
} from '@live-caption-bridge/caption-protocol'

export type OverlayMode = 'screen' | 'obs' | 'native'

export interface OverlayPageOptions {
  profile?: ReceiverProfile
  scale?: number
  opacity?: number
  background?: OverlayBackground
}

export interface DisplayServerOptions {
  port?: number
  initialEnvelope: CaptionEnvelopeV1
}

export class DisplayServer {
  private readonly port: number
  private activePort: number
  private readonly server: Server
  private readonly sockets = new Set<WebSocket>()
  private envelope: CaptionEnvelopeV1

  constructor(options: DisplayServerOptions) {
    this.port = options.port ?? DISPLAY_PORT
    this.activePort = this.port
    this.envelope = options.initialEnvelope
    const websocketServer = new WebSocketServer({ noServer: true })

    this.server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/health') {
        const status = envelopeStatus(this.envelope)
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        })
        response.end(
          JSON.stringify({
            ok: true,
            phase: status.phase,
            provider: status.provider,
            updatedAt: status.updatedAt
          })
        )
        return
      }

      if (url.pathname === '/overlay') {
        const mode = parseMode(url.searchParams.get('mode'))
        const pageOptions = parsePageOptions(url.searchParams)
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ws://127.0.0.1:*"
        })
        response.end(renderOverlayPage(mode, this.activePort, pageOptions))
        return
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
    })

    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/events') {
        socket.destroy()
        return
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit('connection', websocket, request)
      })
    })

    websocketServer.on('connection', (socket) => {
      this.sockets.add(socket)
      socket.send(JSON.stringify(this.envelope))
      socket.on('close', () => this.sockets.delete(socket))
    })
  }

  async start(): Promise<number> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.port, '127.0.0.1', () => {
        this.server.off('error', reject)
        resolve()
      })
    })
    this.activePort = (this.server.address() as AddressInfo).port
    return this.activePort
  }

  broadcast(envelope: CaptionEnvelopeV1): void {
    this.envelope = envelope
    const payload = JSON.stringify(envelope)
    for (const socket of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload)
      }
    }
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) {
      socket.close()
    }
    this.sockets.clear()
    await closeServer(this.server)
  }
}

function envelopeStatus(envelope: CaptionEnvelopeV1) {
  return envelope.type === 'snapshot' ? envelope.payload.status : envelope.payload
}

function parseMode(value: string | null): OverlayMode {
  return value === 'obs' || value === 'native' ? value : 'screen'
}

function parsePageOptions(parameters: URLSearchParams): OverlayPageOptions {
  const profile = parameters.get('profile')
  const background = parameters.get('background')
  const parsedScale = Number(parameters.get('scale'))
  const parsedOpacity = Number(parameters.get('opacity'))
  return {
    profile:
      profile === 'english' ||
      profile === 'vietnamese' ||
      profile === 'glance' ||
      profile === 'bilingual'
        ? profile
        : 'bilingual',
    background:
      background === 'solid' || background === 'transparent' || background === 'gradient'
        ? background
        : 'gradient',
    scale: Number.isFinite(parsedScale) ? Math.min(1.6, Math.max(0.7, parsedScale)) : 1,
    opacity: Number.isFinite(parsedOpacity)
      ? Math.min(1, Math.max(0.2, parsedOpacity))
      : 0.65
  }
}

export function renderOverlayPage(
  mode: OverlayMode,
  port = DISPLAY_PORT,
  options: OverlayPageOptions = {}
): string {
  const transparent = mode !== 'screen'
  const profile = options.profile ?? 'bilingual'
  const background = options.background ?? 'gradient'
  const scale = Math.min(1.6, Math.max(0.7, options.scale ?? 1))
  const opacity = Math.min(1, Math.max(0.2, options.opacity ?? 0.65))
  return `<!doctype html>
<html lang="en" data-mode="${mode}" data-profile="${profile}" data-background="${background}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live Caption Bridge</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, "Segoe UI", Arial, sans-serif; --caption-scale: ${scale}; --surface-opacity: ${opacity}; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: ${transparent ? 'transparent' : '#080a0f'}; }
    body { color: #fff; }
    main { height: 100%; padding: clamp(24px, 4vw, 72px); display: grid; grid-template-rows: 1fr 1fr; gap: clamp(12px, 2vh, 28px); }
    .lane { position: relative; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: clamp(20px, 2.5vw, 46px); border-radius: 24px; overflow: hidden; }
    [data-mode="screen"] .lane { background: rgba(17,21,31,var(--surface-opacity)); border: 1px solid #2b3345; }
    [data-mode="obs"] main { position: absolute; inset: auto 4% 3%; width: 92%; height: 47%; padding: 0; }
    [data-mode="native"] main { padding: 8px; }
    [data-background="gradient"] .lane { background: linear-gradient(180deg, transparent 0%, rgba(3,6,12,calc(var(--surface-opacity) * .85)) 38%, rgba(3,6,12,var(--surface-opacity)) 100%); }
    [data-background="solid"] .lane { background: rgba(3,6,12,var(--surface-opacity)); border: 1px solid rgba(255,255,255,.14); }
    [data-background="transparent"] .lane { background: transparent; }
    .label { position: absolute; top: 15px; left: 22px; color: #b8c3d3; font-size: calc(clamp(12px, 1.15vw, 21px) * var(--caption-scale)); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .label.spoken::after { content: " • Spoken"; color: #7ee0c4; }
    .history { color: #d0d6e0; font-size: calc(clamp(17px, 1.65vw, 31px) * var(--caption-scale)); line-height: 1.2; opacity: .78; min-height: 1.25em; text-shadow: 0 2px 12px #000; }
    .current { margin-top: .28em; font-size: calc(clamp(27px, 3vw, 58px) * var(--caption-scale)); line-height: 1.1; font-weight: 780; text-wrap: balance; overflow-wrap: anywhere; text-shadow: 0 3px 18px #000, 0 1px 3px #000; }
    .current.partial { opacity: .82; }
    [data-profile="english"] #vietnamese-lane, [data-profile="vietnamese"] #english-lane, [data-profile="glance"] #vietnamese-lane { display: none; }
    [data-profile="english"] main, [data-profile="vietnamese"] main, [data-profile="glance"] main { grid-template-rows: 1fr; }
    [data-profile="glance"] .label, [data-profile="glance"] .history { display: none; }
    [data-profile="glance"] .current { text-align: center; font-size: calc(clamp(31px, 3.6vw, 66px) * var(--caption-scale)); }
    #notice { position: fixed; inset: auto 0 10px; text-align: center; color: #ffd6a4; font-size: clamp(13px, 1.2vw, 20px); opacity: 0; transition: opacity .2s; text-shadow: 0 2px 8px #000; }
    #notice.visible { opacity: 1; }
  </style>
</head>
<body>
  <main aria-live="polite">
    <section class="lane" id="english-lane"><div class="label" id="english-label">English</div><div class="history" id="english-history"></div><div class="current" id="english-current"></div></section>
    <section class="lane" id="vietnamese-lane"><div class="label" id="vietnamese-label">Tiếng Việt</div><div class="history" id="vietnamese-history"></div><div class="current" id="vietnamese-current"></div></section>
  </main>
  <div id="notice" role="status">Captions temporarily unavailable</div>
  <script>
    (() => {
      const elements = {
        englishHistory: document.getElementById('english-history'), englishCurrent: document.getElementById('english-current'),
        vietnameseHistory: document.getElementById('vietnamese-history'), vietnameseCurrent: document.getElementById('vietnamese-current'),
        englishLabel: document.getElementById('english-label'), vietnameseLabel: document.getElementById('vietnamese-label'), notice: document.getElementById('notice')
      };
      let unavailableTimer;
      function text(node, value) { node.textContent = value || ''; }
      function localized(segment, locale) { return segment && ((segment.texts && segment.texts[locale]) || (segment.sourceLocale === locale ? segment.sourceText : '')); }
      function render(snapshot) {
        const recent = (snapshot.finalized || []).slice(-2);
        const current = snapshot.partial || recent.at(-1);
        const prior = recent.slice(0, -1);
        const glance = document.documentElement.dataset.profile === 'glance';
        text(elements.englishHistory, prior.map(item => localized(item, 'en-US')).join('  •  '));
        text(elements.vietnameseHistory, prior.map(item => localized(item, 'vi-VN')).join('  •  '));
        text(elements.englishCurrent, glance && current ? current.sourceText : localized(current, 'en-US'));
        text(elements.vietnameseCurrent, localized(current, 'vi-VN'));
        elements.englishCurrent.classList.toggle('partial', Boolean(snapshot.partial));
        elements.vietnameseCurrent.classList.toggle('partial', Boolean(snapshot.partial));
        const locale = current && current.sourceLocale;
        elements.englishLabel.classList.toggle('spoken', locale === 'en-US');
        elements.vietnameseLabel.classList.toggle('spoken', locale === 'vi-VN');
        clearTimeout(unavailableTimer);
        if (['error', 'reconnecting'].includes(snapshot.status.phase)) unavailableTimer = setTimeout(() => elements.notice.classList.add('visible'), 5000);
        else elements.notice.classList.remove('visible');
      }
      function connect() {
        const socket = new WebSocket('ws://127.0.0.1:${port}/events');
        socket.addEventListener('message', event => {
          try { const envelope = JSON.parse(event.data); if (envelope.version === 1 && envelope.type === 'snapshot') render(envelope.payload); } catch { /* Ignore malformed local messages. */ }
        });
        socket.addEventListener('close', () => { elements.notice.classList.add('visible'); setTimeout(connect, 1000); });
      }
      connect();
    })();
  </script>
</body>
</html>`
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
