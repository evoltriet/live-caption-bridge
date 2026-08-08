import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import type { CaptionSnapshot } from '../shared/contracts'
import { DISPLAY_PORT } from '../shared/defaults'

export interface DisplayServerOptions {
  port?: number
  initialSnapshot: CaptionSnapshot
}

export class DisplayServer {
  private readonly port: number
  private activePort: number
  private readonly server: Server
  private readonly sockets = new Set<WebSocket>()
  private snapshot: CaptionSnapshot

  constructor(options: DisplayServerOptions) {
    this.port = options.port ?? DISPLAY_PORT
    this.activePort = this.port
    this.snapshot = options.initialSnapshot
    const websocketServer = new WebSocketServer({ noServer: true })

    this.server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/health') {
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        })
        response.end(
          JSON.stringify({
            ok: true,
            phase: this.snapshot.status.phase,
            provider: this.snapshot.status.provider,
            updatedAt: this.snapshot.status.updatedAt
          })
        )
        return
      }

      if (url.pathname === '/overlay') {
        const mode = url.searchParams.get('mode') === 'obs' ? 'obs' : 'screen'
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ws://127.0.0.1:*"
        })
        response.end(renderOverlayPage(mode, this.activePort))
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
      socket.send(JSON.stringify(this.snapshot))
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

  broadcast(snapshot: CaptionSnapshot): void {
    this.snapshot = snapshot
    const payload = JSON.stringify(snapshot)
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
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

export function renderOverlayPage(mode: 'screen' | 'obs', port = DISPLAY_PORT): string {
  const transparent = mode === 'obs'
  return `<!doctype html>
<html lang="en" data-mode="${mode}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wedding Live Captions</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, "Segoe UI", Arial, sans-serif; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: ${transparent ? 'transparent' : '#080a0f'}; }
    body { color: #fff; }
    main { height: 100%; padding: clamp(24px, 4vw, 72px); display: grid; grid-template-rows: 1fr 1fr; gap: clamp(18px, 3vh, 42px); }
    .lane { position: relative; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: clamp(24px, 3vw, 52px); border-radius: 28px; overflow: hidden; }
    [data-mode="screen"] .lane { background: #11151fcc; border: 1px solid #2b3345; }
    [data-mode="obs"] .lane { background: linear-gradient(180deg, transparent 0%, rgba(3,6,12,.88) 44%, rgba(3,6,12,.96) 100%); }
    .label { position: absolute; top: 22px; left: 28px; color: #aeb9ca; font-size: clamp(16px, 1.4vw, 26px); font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
    .label.spoken::after { content: " • Spoken"; color: #7ee0c4; }
    .history { color: #c3cad7; font-size: clamp(22px, 2.1vw, 38px); line-height: 1.22; opacity: .78; min-height: 1.3em; }
    .current { margin-top: .35em; font-size: clamp(34px, 4vw, 72px); line-height: 1.12; font-weight: 760; text-wrap: balance; overflow-wrap: anywhere; text-shadow: 0 3px 18px rgba(0,0,0,.8); }
    .current.partial { opacity: .82; }
    #notice { position: fixed; inset: auto 0 18px; text-align: center; color: #ffd6a4; font-size: clamp(15px, 1.3vw, 22px); opacity: 0; transition: opacity .2s; }
    #notice.visible { opacity: 1; }
  </style>
</head>
<body>
  <main aria-live="polite">
    <section class="lane" id="english-lane">
      <div class="label" id="english-label">English</div>
      <div class="history" id="english-history"></div>
      <div class="current" id="english-current"></div>
    </section>
    <section class="lane" id="vietnamese-lane">
      <div class="label" id="vietnamese-label">Tiếng Việt</div>
      <div class="history" id="vietnamese-history"></div>
      <div class="current" id="vietnamese-current"></div>
    </section>
  </main>
  <div id="notice" role="status">Captions temporarily unavailable</div>
  <script>
    (() => {
      const elements = {
        englishHistory: document.getElementById('english-history'),
        englishCurrent: document.getElementById('english-current'),
        vietnameseHistory: document.getElementById('vietnamese-history'),
        vietnameseCurrent: document.getElementById('vietnamese-current'),
        englishLabel: document.getElementById('english-label'),
        vietnameseLabel: document.getElementById('vietnamese-label'),
        notice: document.getElementById('notice')
      };
      let unavailableTimer;

      function text(node, value) { node.textContent = value || ''; }
      function render(snapshot) {
        const finalized = snapshot.finalized || [];
        const recent = finalized.slice(-2);
        const latest = recent.at(-1);
        const prior = recent.slice(0, -1);
        const partial = snapshot.partial;
        const current = partial || latest;

        text(elements.englishHistory, prior.map(item => item.englishText).join('  •  '));
        text(elements.vietnameseHistory, prior.map(item => item.vietnameseText).join('  •  '));
        text(elements.englishCurrent, current && current.englishText);
        text(elements.vietnameseCurrent, current && current.vietnameseText);
        elements.englishCurrent.classList.toggle('partial', Boolean(partial));
        elements.vietnameseCurrent.classList.toggle('partial', Boolean(partial));

        const locale = current && current.sourceLocale;
        elements.englishLabel.classList.toggle('spoken', locale === 'en-US');
        elements.vietnameseLabel.classList.toggle('spoken', locale === 'vi-VN');

        const unavailable = ['error', 'reconnecting'].includes(snapshot.status.phase);
        clearTimeout(unavailableTimer);
        if (unavailable) {
          unavailableTimer = setTimeout(() => elements.notice.classList.add('visible'), 5000);
        } else {
          elements.notice.classList.remove('visible');
        }
      }

      function connect() {
        const socket = new WebSocket('ws://127.0.0.1:${port}/events');
        socket.addEventListener('message', event => {
          try { render(JSON.parse(event.data)); } catch { /* Ignore malformed local messages. */ }
        });
        socket.addEventListener('close', () => {
          elements.notice.classList.add('visible');
          setTimeout(connect, 1000);
        });
      }
      connect();
    })();
  </script>
</body>
</html>`
}
