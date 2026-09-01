import { mkdir, writeFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  powerSaveBlocker,
  screen,
  session,
  type SaveDialogOptions
} from 'electron'
import {
  DISPLAY_PORT,
  assertNativeOverlayOptions,
  assertSessionConfig,
  createInactiveLanShareState,
  isLanguageMode,
  type BootstrapState,
  type CaptionSnapshot,
  type DisplayInfo,
  type ExportFormat,
  type LanInterfaceInfo,
  type LanShareState,
  type NativeOverlayOptions,
  type SessionConfig
} from '@live-caption-bridge/caption-protocol'
import { CaptionEnvelopeFactory } from './caption-events'
import { CaptionStore } from './caption-store'
import { CredentialStore } from './credential-store'
import { DisplayServer } from './display-server'
import { serializeTranscript } from './exporters'
import { LanDisplayServer, isPrivateIpv4 } from './lan-display-server'
import { FixtureSpeechProvider } from './providers/fixture-provider'
import { SessionController } from './session-controller'

const store = new CaptionStore()
const envelopeFactory = new CaptionEnvelopeFactory()
let latestEnvelope = envelopeFactory.snapshot(store.getSnapshot())
const controller =
  process.env.LCB_E2E === '1' && !app.isPackaged
    ? new SessionController(store, (emit) => new FixtureSpeechProvider(emit))
    : new SessionController(store)
const displayServer = new DisplayServer({ initialEnvelope: latestEnvelope })

let operatorWindow: BrowserWindow | undefined
let audienceWindow: BrowserWindow | undefined
let audienceDisplayId: number | undefined
let nativeOverlayWindow: BrowserWindow | undefined
let nativeOverlayDisplayId: number | undefined
let nativeOverlayGeneration = 0
let lanServer: LanDisplayServer | undefined
let lanShareState = createInactiveLanShareState()
let credentialStore: CredentialStore
let sleepBlockerId: number | undefined

const overlayBaseUrl = `http://127.0.0.1:${DISPLAY_PORT}`

async function createOperatorWindow(): Promise<void> {
  operatorWindow = new BrowserWindow({
    width: 1_300,
    height: 900,
    minWidth: 1_020,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b0e14',
    title: 'Live Caption Bridge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  operatorWindow.on('ready-to-show', () => operatorWindow?.show())
  operatorWindow.on('closed', () => {
    operatorWindow = undefined
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await operatorWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await operatorWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function configureMediaPermissions(): void {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
}

function registerIpc(): void {
  ipcMain.handle('app:get-bootstrap', async (): Promise<BootstrapState> => {
    const saved = await credentialStore.load()
    return {
      displays: listDisplays(),
      overlayUrl: `${overlayBaseUrl}/overlay?mode=obs`,
      screenUrl: `${overlayBaseUrl}/overlay?mode=screen`,
      lanInterfaces: listLanInterfaces(),
      lanShare: lanShareState,
      hasSavedCredentials: Boolean(saved),
      savedRegion: saved?.region,
      snapshot: store.getSnapshot()
    }
  })

  ipcMain.handle('session:start', async (_event, rawConfig: unknown) => {
    assertSessionConfig(rawConfig)
    const config = await resolveCredentials(rawConfig)
    if (config.provider === 'offline') {
      throw new Error('Offline mode is gated behind the v0.2 benchmark and is not shipped yet.')
    }
    await stopLanSharing()
    envelopeFactory.beginSession()
    await controller.start(config)
    startSleepBlocker()
  })

  ipcMain.handle('session:pause', async () => {
    await controller.pause()
    stopSleepBlocker()
  })

  ipcMain.handle('session:end', async () => {
    await controller.end()
    await stopLanSharing()
    stopSleepBlocker()
  })

  ipcMain.handle('session:clear', () => store.clear())

  ipcMain.handle('session:set-language', async (_event, value: unknown) => {
    if (!isLanguageMode(value)) {
      throw new Error('Unsupported language mode.')
    }
    await controller.setLanguageMode(value)
  })

  ipcMain.handle('session:device-lost', async () => {
    await controller.pause('Audio interface disconnected. Reselect it before resuming.')
    stopSleepBlocker()
  })

  ipcMain.on('network:update', (_event, online: unknown) => {
    if (typeof online === 'boolean') {
      store.updateStatus({ networkOnline: online })
    }
  })

  ipcMain.on('audio:push', (_event, value: unknown) => {
    const chunk = toArrayBuffer(value)
    if (chunk && chunk.byteLength <= 1_048_576) {
      controller.pushAudio(chunk)
    }
  })

  ipcMain.handle('display:open', async (_event, displayId: unknown) => {
    if (typeof displayId !== 'number') {
      throw new Error('A valid display is required.')
    }
    await openAudienceDisplay(displayId)
  })

  ipcMain.handle('display:close', () => closeAudienceDisplay())

  ipcMain.handle('overlay:open-native', async (_event, rawOptions: unknown) => {
    assertNativeOverlayOptions(rawOptions)
    await openNativeOverlay(rawOptions)
  })

  ipcMain.handle('overlay:close-native', () => closeNativeOverlay())

  ipcMain.handle('lan:start', async (_event, address: unknown) => {
    if (
      typeof address !== 'string' ||
      !listLanInterfaces().some((item) => item.address === address)
    ) {
      throw new Error('Select an available private network interface.')
    }
    await stopLanSharing()
    lanServer = new LanDisplayServer({
      address,
      initialEnvelope: latestEnvelope,
      onStateChange: publishLanState
    })
    lanShareState = await lanServer.start()
    publishLanState(lanShareState)
    return lanShareState
  })

  ipcMain.handle('lan:stop', () => stopLanSharing())

  ipcMain.handle('credentials:clear', async () => credentialStore.clear())

  ipcMain.handle('transcript:export', async (_event, format: unknown) => {
    if (format !== 'txt' && format !== 'json' && format !== 'vtt') {
      throw new Error('Unsupported transcript format.')
    }
    return exportTranscript(format)
  })
}

async function resolveCredentials(config: SessionConfig): Promise<SessionConfig> {
  if (process.env.LCB_E2E === '1' && !app.isPackaged) {
    return { ...config, azureKey: 'fixture-credential', azureRegion: 'fixture' }
  }
  const suppliedKey = config.azureKey?.trim()
  const suppliedRegion = config.azureRegion?.trim().toLowerCase()
  const saved = await credentialStore.load()
  const key = suppliedKey || saved?.key
  const region = suppliedRegion || saved?.region

  if (!key || key.length < 16) {
    throw new Error('Enter a valid Azure Speech key or use a saved key.')
  }
  if (!region || !/^[a-z0-9-]+$/.test(region)) {
    throw new Error('Enter a valid Azure region, such as eastus.')
  }
  if (config.rememberCredentials && suppliedKey) {
    await credentialStore.save(region, suppliedKey)
  }
  return { ...config, azureKey: key, azureRegion: region }
}

function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: `${display.id === primaryId ? 'Primary' : 'Display'} ${index + 1} — ${display.size.width}×${display.size.height}`,
    primary: display.id === primaryId,
    width: display.size.width,
    height: display.size.height
  }))
}

function listLanInterfaces(): LanInterfaceInfo[] {
  const results = new Map<string, LanInterfaceInfo>()
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal && isPrivateIpv4(address.address)) {
        results.set(address.address, {
          address: address.address,
          label: `${name} — ${address.address}`
        })
      }
    }
  }
  return [...results.values()].sort((a, b) => a.label.localeCompare(b.label))
}

async function openAudienceDisplay(displayId: number): Promise<void> {
  const target = screen.getAllDisplays().find((display) => display.id === displayId)
  if (!target) {
    throw new Error('The selected display is no longer connected.')
  }
  closeAudienceDisplay()
  audienceDisplayId = displayId
  audienceWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#080a0f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  audienceWindow.on('closed', () => {
    audienceWindow = undefined
    audienceDisplayId = undefined
  })
  await audienceWindow.loadURL(`${overlayBaseUrl}/overlay?mode=screen`)
}

function closeAudienceDisplay(): void {
  audienceWindow?.close()
  audienceWindow = undefined
  audienceDisplayId = undefined
}

async function openNativeOverlay(options: NativeOverlayOptions): Promise<void> {
  const target = screen.getAllDisplays().find((display) => display.id === options.displayId)
  if (!target) {
    throw new Error('The selected overlay display is no longer connected.')
  }
  closeNativeOverlay()
  const generation = nativeOverlayGeneration

  const bounds = target.bounds
  const width = Math.round(bounds.width * (options.widthPercent / 100))
  const heightRatio = options.profile === 'bilingual' ? 0.42 : 0.28
  const height = Math.max(180, Math.round(bounds.height * heightRatio))
  const x = bounds.x + Math.round((bounds.width - width) / 2)
  const margin = Math.max(12, Math.round(bounds.height * 0.025))
  const y =
    options.placement === 'top'
      ? bounds.y + margin
      : options.placement === 'center'
        ? bounds.y + Math.round((bounds.height - height) / 2)
        : bounds.y + bounds.height - height - margin

  nativeOverlayDisplayId = options.displayId
  const overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  nativeOverlayWindow = overlayWindow
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.on('closed', () => {
    if (nativeOverlayWindow === overlayWindow) {
      nativeOverlayWindow = undefined
      nativeOverlayDisplayId = undefined
    }
  })

  const parameters = new URLSearchParams({
    mode: 'native',
    profile: options.profile,
    scale: String(options.scale),
    opacity: String(options.opacity),
    background: options.background
  })
  try {
    await overlayWindow.loadURL(`${overlayBaseUrl}/overlay?${parameters.toString()}`)
  } catch (error) {
    if (nativeOverlayWindow !== overlayWindow || generation !== nativeOverlayGeneration) {
      return
    }
    throw error
  }
  if (
    nativeOverlayWindow === overlayWindow &&
    generation === nativeOverlayGeneration &&
    !overlayWindow.isDestroyed()
  ) {
    overlayWindow.showInactive()
  }
}

function closeNativeOverlay(): void {
  nativeOverlayGeneration += 1
  const overlayWindow = nativeOverlayWindow
  nativeOverlayWindow = undefined
  nativeOverlayDisplayId = undefined
  overlayWindow?.close()
}

async function stopLanSharing(): Promise<LanShareState> {
  const current = lanServer
  lanServer = undefined
  if (current) {
    await current.stop()
  }
  lanShareState = createInactiveLanShareState()
  publishLanState(lanShareState)
  return lanShareState
}

function publishLanState(state: LanShareState): void {
  lanShareState = state
  operatorWindow?.webContents.send('lan:state', state)
}

async function exportTranscript(format: ExportFormat): Promise<{ canceled: boolean; path?: string }> {
  const options: SaveDialogOptions = {
    title: 'Export bilingual transcript',
    defaultPath: `live-captions-${new Date().toISOString().replaceAll(':', '-')}.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  }
  const result = operatorWindow
    ? await dialog.showSaveDialog(operatorWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }
  await mkdir(dirname(result.filePath), { recursive: true })
  await writeFile(result.filePath, serializeTranscript(store.getTranscript(), format), 'utf8')
  return { canceled: false, path: result.filePath }
}

function startSleepBlocker(): void {
  if (sleepBlockerId === undefined) {
    sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
  }
}

function stopSleepBlocker(): void {
  if (sleepBlockerId !== undefined && powerSaveBlocker.isStarted(sleepBlockerId)) {
    powerSaveBlocker.stop(sleepBlockerId)
  }
  sleepBlockerId = undefined
}

function toArrayBuffer(value: unknown): ArrayBuffer | undefined {
  if (value instanceof ArrayBuffer) {
    return value
  }
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
  }
  return undefined
}

function broadcastSnapshot(snapshot: CaptionSnapshot): void {
  latestEnvelope = envelopeFactory.snapshot(snapshot)
  displayServer.broadcast(latestEnvelope)
  lanServer?.broadcast(latestEnvelope)
  operatorWindow?.webContents.send('caption:snapshot', snapshot)
}

app.whenReady().then(async () => {
  credentialStore = new CredentialStore(app.getPath('userData'))
  configureMediaPermissions()
  registerIpc()
  store.on('change', broadcastSnapshot)
  await displayServer.start()
  await createOperatorWindow()

  screen.on('display-removed', (_event, display) => {
    if (display.id === audienceDisplayId) {
      closeAudienceDisplay()
      void controller.pause('Audience display disconnected. Select a display before resuming.')
      stopSleepBlocker()
    }
    if (display.id === nativeOverlayDisplayId) {
      closeNativeOverlay()
      operatorWindow?.webContents.send('caption:snapshot', store.getSnapshot())
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createOperatorWindow()
    }
  })
})

app.on('before-quit', () => {
  stopSleepBlocker()
  void controller.end()
  void stopLanSharing()
  void displayServer.stop()
})

app.on('window-all-closed', () => app.quit())
