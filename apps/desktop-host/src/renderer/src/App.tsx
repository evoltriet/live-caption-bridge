import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  captionText,
  createInactiveLanShareState,
  type BootstrapState,
  type CaptionSnapshot,
  type ExportFormat,
  type LanShareState,
  type LanguageMode,
  type NativeOverlayOptions,
  type OverlayBackground,
  type OverlayPlacement,
  type ReceiverProfile
} from '@live-caption-bridge/caption-protocol'
import { AudioCapture, type AudioMeterReading } from './audio/audio-capture'

const initialMeter: AudioMeterReading = { level: 0, clipping: false }

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState>()
  const [snapshot, setSnapshot] = useState<CaptionSnapshot>()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [displayId, setDisplayId] = useState<number>()
  const [region, setRegion] = useState('')
  const [key, setKey] = useState('')
  const [remember, setRemember] = useState(false)
  const [languageMode, setLanguageMode] = useState<LanguageMode>('auto')
  const [meter, setMeter] = useState(initialMeter)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string>()
  const [profile, setProfile] = useState<ReceiverProfile>('bilingual')
  const [placement, setPlacement] = useState<OverlayPlacement>('bottom')
  const [background, setBackground] = useState<OverlayBackground>('gradient')
  const [widthPercent, setWidthPercent] = useState(92)
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(0.9)
  const [lanAddress, setLanAddress] = useState('')
  const [lanShare, setLanShare] = useState<LanShareState>(createInactiveLanShareState())
  const [receiverQr, setReceiverQr] = useState('')
  const captureRef = useRef<AudioCapture | undefined>(undefined)

  const refreshDevices = useCallback(async (requestPermission = false): Promise<void> => {
    try {
      if (requestPermission) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        permissionStream.getTracks().forEach((track) => track.stop())
      }
      const audioDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'audioinput'
      )
      setDevices(audioDevices)
      setDeviceId((current) =>
        audioDevices.some((device) => device.deviceId === current)
          ? current
          : audioDevices[0]?.deviceId ?? ''
      )
      setFeedback(undefined)
    } catch (error) {
      setFeedback(safeMessage(error))
    }
  }, [])

  useEffect(() => {
    void window.liveCaptionBridge.getBootstrap().then((value) => {
      setBootstrap(value)
      setSnapshot(value.snapshot)
      setRegion(value.savedRegion ?? '')
      setLanShare(value.lanShare)
      const external = value.displays.find((display) => !display.primary) ?? value.displays[0]
      setDisplayId(external?.id)
      setLanAddress(value.lanInterfaces[0]?.address ?? '')
    })
    void refreshDevices()
    const removeSnapshotListener = window.liveCaptionBridge.onSnapshot(setSnapshot)
    const removeLanListener = window.liveCaptionBridge.onLanShare(setLanShare)

    const updateNetwork = (): void =>
      window.liveCaptionBridge.updateNetworkState(navigator.onLine)
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)
    updateNetwork()

    return () => {
      removeSnapshotListener?.()
      removeLanListener?.()
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
      void captureRef.current?.stop()
    }
  }, [refreshDevices])

  useEffect(() => {
    if (!lanShare.receiverUrl) {
      setReceiverQr('')
      return
    }
    let active = true
    void QRCode.toDataURL(lanShare.receiverUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#07110e', light: '#ffffff' }
    }).then((value) => {
      if (active) {
        setReceiverQr(value)
      }
    })
    return () => {
      active = false
    }
  }, [lanShare.receiverUrl])

  const phase = snapshot?.status.phase ?? 'idle'
  const active = phase === 'listening' || phase === 'connecting' || phase === 'reconnecting'
  const sessionExists = phase !== 'idle'
  const canStart = Boolean(deviceId && region && (key || bootstrap?.hasSavedCredentials))

  const preview = useMemo(() => {
    const current = snapshot?.partial ?? snapshot?.finalized.at(-1)
    return {
      english: captionText(current, 'en-US') || 'English captions will appear here.',
      vietnamese:
        captionText(current, 'vi-VN') || 'Phụ đề tiếng Việt sẽ xuất hiện ở đây.'
    }
  }, [snapshot])

  async function startSession(): Promise<void> {
    if (!canStart) {
      setFeedback('Choose an audio input and enter Azure credentials before starting.')
      return
    }
    setBusy(true)
    setFeedback(undefined)
    try {
      await window.liveCaptionBridge.startSession({
        provider: 'azure',
        languageMode,
        azureRegion: region,
        azureKey: key || undefined,
        rememberCredentials: remember
      })
      setKey('')
      const capture = new AudioCapture({
        deviceId,
        onChunk: (chunk) => window.liveCaptionBridge.pushAudio(chunk),
        onMeter: setMeter,
        onDeviceLost: () => {
          setFeedback('Audio interface disconnected. Reselect it before resuming.')
          void window.liveCaptionBridge.reportDeviceLost()
        }
      })
      captureRef.current = capture
      await capture.start()
    } catch (error) {
      await captureRef.current?.stop()
      captureRef.current = undefined
      await window.liveCaptionBridge.pauseSession()
      setFeedback(safeMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function pauseSession(): Promise<void> {
    setBusy(true)
    try {
      await captureRef.current?.stop()
      captureRef.current = undefined
      await window.liveCaptionBridge.pauseSession()
    } finally {
      setBusy(false)
    }
  }

  async function endSession(): Promise<void> {
    setBusy(true)
    try {
      await captureRef.current?.stop()
      captureRef.current = undefined
      await window.liveCaptionBridge.endSession()
      await window.liveCaptionBridge.closeNativeOverlay()
    } finally {
      setBusy(false)
    }
  }

  async function changeLanguage(mode: LanguageMode): Promise<void> {
    setLanguageMode(mode)
    if (active) {
      setBusy(true)
      try {
        await window.liveCaptionBridge.setLanguageMode(mode)
      } catch (error) {
        setFeedback(safeMessage(error))
      } finally {
        setBusy(false)
      }
    }
  }

  async function exportTranscript(format: ExportFormat): Promise<void> {
    const result = await window.liveCaptionBridge.exportTranscript(format)
    if (!result.canceled && result.path) {
      setFeedback(`Transcript saved to ${result.path}`)
    }
  }

  async function copyText(value: string | undefined, message: string): Promise<void> {
    if (value) {
      await navigator.clipboard.writeText(value)
      setFeedback(message)
    }
  }

  async function showNativeOverlay(): Promise<void> {
    if (displayId === undefined) {
      setFeedback('Select a display for the native overlay.')
      return
    }
    const options: NativeOverlayOptions = {
      displayId,
      placement,
      widthPercent,
      scale,
      opacity,
      background,
      profile
    }
    try {
      await window.liveCaptionBridge.openNativeOverlay(options)
      setFeedback('Click-through overlay is visible. Press Close overlay from this console to remove it.')
    } catch (error) {
      setFeedback(safeMessage(error))
    }
  }

  async function startLanSharing(): Promise<void> {
    if (!lanAddress) {
      setFeedback('No private LAN interface is available.')
      return
    }
    try {
      const state = await window.liveCaptionBridge.startLanSharing(lanAddress)
      setLanShare(state)
      setFeedback('Local receivers can now pair. Traffic is authenticated but not encrypted.')
    } catch (error) {
      setFeedback(safeMessage(error))
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Wedding preset · English ↔ Tiếng Việt</p>
          <h1>Live Caption Bridge</h1>
          <p className="subtitle">One caption stream for the projector, OBS, and nearby devices.</p>
        </div>
        <StatusBadge snapshot={snapshot} />
      </header>

      {feedback && <div className="feedback" role="status">{feedback}</div>}

      <main className="dashboard">
        <section className="panel setup-panel">
          <div className="section-heading">
            <div><span className="step">1</span><h2>Audio and provider</h2></div>
            <button className="text-button" onClick={() => void refreshDevices(true)}>Authorize & refresh</button>
          </div>

          <label>
            Soundboard audio input
            <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} disabled={active}>
              {devices.length === 0 && <option value="">No audio inputs found</option>}
              {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Audio input ${index + 1}`}</option>)}
            </select>
          </label>

          <div className="meter-row">
            <span>Input level</span>
            <div className="meter" aria-label={`Input level ${Math.round(meter.level * 100)} percent`}><div className={meter.clipping ? 'meter-fill clipping' : 'meter-fill'} style={{ width: `${meter.level * 100}%` }} /></div>
            <strong className={meter.clipping ? 'danger' : ''}>{meter.clipping ? 'CLIP' : `${Math.round(meter.level * 100)}%`}</strong>
          </div>

          <div className="credentials-grid">
            <label>Azure region<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="eastus" disabled={active} /></label>
            <label>Azure Speech key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={bootstrap?.hasSavedCredentials ? 'Saved key available' : 'Enter key'} disabled={active} /></label>
          </div>
          <div className="inline-options">
            <label className="checkbox"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={active} /> Remember key with Windows encryption</label>
            {bootstrap?.hasSavedCredentials && <button className="text-button danger" onClick={() => void window.liveCaptionBridge.clearSavedCredentials().then(() => setBootstrap({ ...bootstrap, hasSavedCredentials: false }))}>Forget saved key</button>}
          </div>

          <fieldset>
            <legend>Spoken language</legend>
            <div className="segmented">
              {([['auto', 'Auto detect'], ['en-US', 'English'], ['vi-VN', 'Vietnamese']] as const).map(([value, label]) => <button key={value} className={languageMode === value ? 'selected' : ''} onClick={() => void changeLanguage(value)} disabled={busy}>{label}</button>)}
            </div>
          </fieldset>
        </section>

        <section className="panel display-panel">
          <div className="section-heading"><div><span className="step">2</span><h2>Presentation</h2></div></div>
          <label>Output display<select value={displayId ?? ''} onChange={(event) => setDisplayId(Number(event.target.value))}>{bootstrap?.displays.map((display) => <option key={display.id} value={display.id}>{display.label}{display.primary ? ' (operator display)' : ''}</option>)}</select></label>

          <div className="output-card">
            <h3>Caption-only screen</h3>
            <div className="button-row"><button className="secondary" onClick={() => displayId !== undefined && void window.liveCaptionBridge.openDisplay(displayId)}>Open fullscreen</button><button className="secondary" onClick={() => void window.liveCaptionBridge.closeDisplay()}>Close</button></div>
          </div>

          <div className="output-card">
            <h3>Click-through presentation overlay</h3>
            <div className="compact-grid">
              <label>Profile<select value={profile} onChange={(event) => setProfile(event.target.value as ReceiverProfile)}><option value="bilingual">Bilingual</option><option value="english">English</option><option value="vietnamese">Vietnamese</option><option value="glance">Glance</option></select></label>
              <label>Placement<select value={placement} onChange={(event) => setPlacement(event.target.value as OverlayPlacement)}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></label>
              <label>Background<select value={background} onChange={(event) => setBackground(event.target.value as OverlayBackground)}><option value="gradient">Gradient</option><option value="solid">Solid</option><option value="transparent">Text only</option></select></label>
            </div>
            <div className="range-grid">
              <label>Width <strong>{widthPercent}%</strong><input type="range" min="40" max="100" value={widthPercent} onChange={(event) => setWidthPercent(Number(event.target.value))} /></label>
              <label>Scale <strong>{scale.toFixed(1)}×</strong><input type="range" min="0.7" max="1.6" step="0.1" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
              <label>Surface <strong>{Math.round(opacity * 100)}%</strong><input type="range" min="0.2" max="1" step="0.1" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
            </div>
            <div className="button-row"><button className="secondary" onClick={() => void showNativeOverlay()}>Show overlay</button><button className="secondary" onClick={() => void window.liveCaptionBridge.closeNativeOverlay()}>Close overlay</button></div>
            <small>Use windowed/borderless PowerPoint or video. Exclusive fullscreen can cover desktop overlays; use OBS in that case.</small>
          </div>

          <div className="obs-card">
            <span className="tag">Compositor</span><h3>OBS transparent browser source</h3><code>{bootstrap?.overlayUrl ?? 'Starting local display service…'}</code><button className="text-button" onClick={() => void copyText(bootstrap?.overlayUrl, 'OBS overlay URL copied.')}>Copy URL</button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="section-heading"><div><span className="step">3</span><h2>Caption preview</h2></div></div>
          <div className="preview-lane"><span>English{(snapshot?.partial ?? snapshot?.finalized.at(-1))?.sourceLocale === 'en-US' ? ' • Spoken' : ''}</span><p>{preview.english}</p></div>
          <div className="preview-lane"><span>Tiếng Việt{(snapshot?.partial ?? snapshot?.finalized.at(-1))?.sourceLocale === 'vi-VN' ? ' • Spoken' : ''}</span><p>{preview.vietnamese}</p></div>
        </section>

        <section className="panel receiver-panel">
          <div className="section-heading"><div><span className="step">4</span><h2>Nearby read-only receivers</h2></div><span className={lanShare.active ? 'share-status active' : 'share-status'}>{lanShare.active ? `${lanShare.connectedClients} connected` : 'Off'}</span></div>
          <div className="receiver-setup">
            <div>
              <label>Trusted private network<select value={lanAddress} onChange={(event) => setLanAddress(event.target.value)} disabled={lanShare.active}>{bootstrap?.lanInterfaces.length ? bootstrap.lanInterfaces.map((item) => <option key={item.address} value={item.address}>{item.label}</option>) : <option value="">No private IPv4 interface found</option>}</select></label>
              <p className="warning">{lanShare.warning}</p>
              <div className="button-row">{lanShare.active ? <button className="secondary danger-border" onClick={() => void window.liveCaptionBridge.stopLanSharing()}>Stop sharing</button> : <button className="secondary" disabled={!sessionExists || !lanAddress} onClick={() => void startLanSharing()}>Start local sharing</button>}{lanShare.receiverUrl && <button className="text-button" onClick={() => void copyText(lanShare.receiverUrl, 'Private receiver link copied.')}>Copy private link</button>}</div>
            </div>
            {receiverQr && <div className="qr-card"><img src={receiverQr} alt="Private receiver pairing QR code" /><span>Scan on the same trusted network</span></div>}
          </div>
        </section>

        <section className="panel controls-panel">
          <div className="session-controls">
            {!active ? <button className="primary" disabled={!canStart || busy} onClick={() => void startSession()}>{phase === 'paused' ? 'Resume captions' : 'Start captions'}</button> : <button className="primary pause" disabled={busy} onClick={() => void pauseSession()}>Pause captions</button>}
            <button className="secondary" disabled={busy || phase === 'idle'} onClick={() => void endSession()}>End session</button>
            <button className="secondary" onClick={() => void window.liveCaptionBridge.clearCaptions()}>Clear screen</button>
          </div>
          <div className="export-row"><span>Export only when requested:</span>{(['txt', 'json', 'vtt'] as const).map((format) => <button key={format} className="text-button" onClick={() => void exportTranscript(format)}>{format.toUpperCase()}</button>)}</div>
        </section>
      </main>

      <footer><span>Audio is streamed to Azure in cloud mode and is never recorded by this app.</span><span>Offline provider: benchmark-gated for v0.2</span></footer>
    </div>
  )
}

function StatusBadge({ snapshot }: { snapshot?: CaptionSnapshot }) {
  const status = snapshot?.status
  const locale = status?.detectedLocale === 'vi-VN' ? 'Vietnamese' : status?.detectedLocale === 'en-US' ? 'English' : '—'
  return (
    <div className={`status-card status-${status?.phase ?? 'idle'}`}>
      <div><span className="status-dot" /><strong>{status?.phase ?? 'idle'}</strong></div>
      <dl><div><dt>Language</dt><dd>{locale}</dd></div><div><dt>Latency</dt><dd>{status?.latencyMs ? `${(status.latencyMs / 1000).toFixed(1)}s` : '—'}</dd></div><div><dt>Network</dt><dd>{status?.networkOnline === false ? 'Offline' : 'Online'}</dd></div></dl>
      {status?.message && <small>{status.message}</small>}
    </div>
  )
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
