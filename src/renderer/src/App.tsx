import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BootstrapState,
  CaptionSnapshot,
  ExportFormat,
  LanguageMode
} from '../../shared/contracts'
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
    void window.weddingCaptions.getBootstrap().then((value) => {
      setBootstrap(value)
      setSnapshot(value.snapshot)
      setRegion(value.savedRegion ?? '')
      const external = value.displays.find((display) => !display.primary) ?? value.displays[0]
      setDisplayId(external?.id)
    })
    void refreshDevices()
    const removeListener = window.weddingCaptions.onSnapshot(setSnapshot)

    const updateNetwork = (): void => window.weddingCaptions.updateNetworkState(navigator.onLine)
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)
    updateNetwork()

    return () => {
      removeListener?.()
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
      void captureRef.current?.stop()
    }
  }, [refreshDevices])

  const phase = snapshot?.status.phase ?? 'idle'
  const active = phase === 'listening' || phase === 'connecting' || phase === 'reconnecting'
  const canStart = Boolean(deviceId && region && (key || bootstrap?.hasSavedCredentials))

  const preview = useMemo(() => {
    const current = snapshot?.partial ?? snapshot?.finalized.at(-1)
    return {
      english: current?.englishText || 'English captions will appear here.',
      vietnamese: current?.vietnameseText || 'Phụ đề tiếng Việt sẽ xuất hiện ở đây.'
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
      await window.weddingCaptions.startSession({
        provider: 'azure',
        languageMode,
        azureRegion: region,
        azureKey: key || undefined,
        rememberCredentials: remember
      })
      setKey('')
      const capture = new AudioCapture({
        deviceId,
        onChunk: (chunk) => window.weddingCaptions.pushAudio(chunk),
        onMeter: setMeter,
        onDeviceLost: () => {
          setFeedback('Audio interface disconnected. Reselect it before resuming.')
          void window.weddingCaptions.reportDeviceLost()
        }
      })
      captureRef.current = capture
      await capture.start()
    } catch (error) {
      await captureRef.current?.stop()
      captureRef.current = undefined
      await window.weddingCaptions.pauseSession()
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
      await window.weddingCaptions.pauseSession()
    } finally {
      setBusy(false)
    }
  }

  async function endSession(): Promise<void> {
    setBusy(true)
    try {
      await captureRef.current?.stop()
      captureRef.current = undefined
      await window.weddingCaptions.endSession()
    } finally {
      setBusy(false)
    }
  }

  async function changeLanguage(mode: LanguageMode): Promise<void> {
    setLanguageMode(mode)
    if (active) {
      setBusy(true)
      try {
        await window.weddingCaptions.setLanguageMode(mode)
      } catch (error) {
        setFeedback(safeMessage(error))
      } finally {
        setBusy(false)
      }
    }
  }

  async function exportTranscript(format: ExportFormat): Promise<void> {
    const result = await window.weddingCaptions.exportTranscript(format)
    if (!result.canceled && result.path) {
      setFeedback(`Transcript saved to ${result.path}`)
    }
  }

  async function copyOverlayUrl(): Promise<void> {
    if (bootstrap?.overlayUrl) {
      await navigator.clipboard.writeText(bootstrap.overlayUrl)
      setFeedback('OBS overlay URL copied.')
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">English ↔ Tiếng Việt</p>
          <h1>Wedding Live Captions</h1>
          <p className="subtitle">A calm operator console for a very important day.</p>
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
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio input ${index + 1}`}
                </option>
              ))}
            </select>
          </label>

          <div className="meter-row">
            <span>Input level</span>
            <div className="meter" aria-label={`Input level ${Math.round(meter.level * 100)} percent`}>
              <div className={meter.clipping ? 'meter-fill clipping' : 'meter-fill'} style={{ width: `${meter.level * 100}%` }} />
            </div>
            <strong className={meter.clipping ? 'danger' : ''}>{meter.clipping ? 'CLIP' : `${Math.round(meter.level * 100)}%`}</strong>
          </div>

          <div className="credentials-grid">
            <label>
              Azure region
              <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="eastus" disabled={active} />
            </label>
            <label>
              Azure Speech key
              <input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={bootstrap?.hasSavedCredentials ? 'Saved key available' : 'Enter key'} disabled={active} />
            </label>
          </div>
          <div className="inline-options">
            <label className="checkbox"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={active} /> Remember key with Windows encryption</label>
            {bootstrap?.hasSavedCredentials && (
              <button className="text-button danger" onClick={() => void window.weddingCaptions.clearSavedCredentials().then(() => setBootstrap({ ...bootstrap, hasSavedCredentials: false }))}>Forget saved key</button>
            )}
          </div>

          <fieldset>
            <legend>Spoken language</legend>
            <div className="segmented">
              {([['auto', 'Auto detect'], ['en-US', 'English'], ['vi-VN', 'Vietnamese']] as const).map(([value, label]) => (
                <button key={value} className={languageMode === value ? 'selected' : ''} onClick={() => void changeLanguage(value)} disabled={busy}>{label}</button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="panel display-panel">
          <div className="section-heading"><div><span className="step">2</span><h2>Audience output</h2></div></div>
          <label>
            Projector or TV
            <select value={displayId ?? ''} onChange={(event) => setDisplayId(Number(event.target.value))}>
              {bootstrap?.displays.map((display) => <option key={display.id} value={display.id}>{display.label}{display.primary ? ' (operator display)' : ''}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button className="secondary" onClick={() => displayId !== undefined && void window.weddingCaptions.openDisplay(displayId)}>Open fullscreen</button>
            <button className="secondary" onClick={() => void window.weddingCaptions.closeDisplay()}>Close fullscreen</button>
          </div>
          <div className="obs-card">
            <span className="tag">Optional</span>
            <h3>OBS transparent overlay</h3>
            <code>{bootstrap?.overlayUrl ?? 'Starting local display service…'}</code>
            <button className="text-button" onClick={() => void copyOverlayUrl()}>Copy URL</button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="section-heading"><div><span className="step">3</span><h2>Caption preview</h2></div></div>
          <div className="preview-lane">
            <span>English{(snapshot?.partial ?? snapshot?.finalized.at(-1))?.sourceLocale === 'en-US' ? ' • Spoken' : ''}</span>
            <p>{preview.english}</p>
          </div>
          <div className="preview-lane">
            <span>Tiếng Việt{(snapshot?.partial ?? snapshot?.finalized.at(-1))?.sourceLocale === 'vi-VN' ? ' • Spoken' : ''}</span>
            <p>{preview.vietnamese}</p>
          </div>
        </section>

        <section className="panel controls-panel">
          <div className="session-controls">
            {!active ? (
              <button className="primary" disabled={!canStart || busy} onClick={() => void startSession()}>{phase === 'paused' ? 'Resume captions' : 'Start captions'}</button>
            ) : (
              <button className="primary pause" disabled={busy} onClick={() => void pauseSession()}>Pause captions</button>
            )}
            <button className="secondary" disabled={busy || phase === 'idle'} onClick={() => void endSession()}>End session</button>
            <button className="secondary" onClick={() => void window.weddingCaptions.clearCaptions()}>Clear screen</button>
          </div>
          <div className="export-row">
            <span>Export only when requested:</span>
            {(['txt', 'json', 'vtt'] as const).map((format) => <button key={format} className="text-button" onClick={() => void exportTranscript(format)}>{format.toUpperCase()}</button>)}
          </div>
        </section>
      </main>

      <footer>
        <span>Audio is streamed to Azure in cloud mode and is never recorded by this app.</span>
        <span>Offline provider: benchmark-gated for v0.2</span>
      </footer>
    </div>
  )
}

function StatusBadge({ snapshot }: { snapshot?: CaptionSnapshot }) {
  const status = snapshot?.status
  const locale = status?.detectedLocale === 'vi-VN' ? 'Vietnamese' : status?.detectedLocale === 'en-US' ? 'English' : '—'
  return (
    <div className={`status-card status-${status?.phase ?? 'idle'}`}>
      <div><span className="status-dot" /><strong>{status?.phase ?? 'idle'}</strong></div>
      <dl>
        <div><dt>Language</dt><dd>{locale}</dd></div>
        <div><dt>Latency</dt><dd>{status?.latencyMs ? `${(status.latencyMs / 1000).toFixed(1)}s` : '—'}</dd></div>
        <div><dt>Network</dt><dd>{status?.networkOnline === false ? 'Offline' : 'Online'}</dd></div>
      </dl>
      {status?.message && <small>{status.message}</small>}
    </div>
  )
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
