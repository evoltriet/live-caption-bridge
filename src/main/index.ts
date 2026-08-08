import { mkdir, writeFile } from 'node:fs/promises'
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
import type {
  BootstrapState,
  CaptionSnapshot,
  DisplayInfo,
  ExportFormat,
  SessionConfig
} from '../shared/contracts'
import {
  assertSessionConfig,
  isLanguageMode
} from '../shared/contracts'
import { DISPLAY_PORT } from '../shared/defaults'
import { CaptionStore } from './caption-store'
import { CredentialStore } from './credential-store'
import { DisplayServer } from './display-server'
import { serializeTranscript } from './exporters'
import { FixtureSpeechProvider } from './providers/fixture-provider'
import { SessionController } from './session-controller'

const store = new CaptionStore()
const controller =
  process.env.WLC_E2E === '1' && !app.isPackaged
    ? new SessionController(store, (emit) => new FixtureSpeechProvider(emit))
    : new SessionController(store)
const displayServer = new DisplayServer({ initialSnapshot: store.getSnapshot() })

let operatorWindow: BrowserWindow | undefined
let audienceWindow: BrowserWindow | undefined
let audienceDisplayId: number | undefined
let credentialStore: CredentialStore
let sleepBlockerId: number | undefined

const overlayBaseUrl = `http://127.0.0.1:${DISPLAY_PORT}`

async function createOperatorWindow(): Promise<void> {
  operatorWindow = new BrowserWindow({
    width: 1_260,
    height: 860,
    minWidth: 1_020,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b0e14',
    title: 'Wedding Live Captions',
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
    await controller.start(config)
    startSleepBlocker()
  })

  ipcMain.handle('session:pause', async () => {
    await controller.pause()
    stopSleepBlocker()
  })

  ipcMain.handle('session:end', async () => {
    await controller.end()
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

  ipcMain.handle('credentials:clear', async () => credentialStore.clear())

  ipcMain.handle('transcript:export', async (_event, format: unknown) => {
    if (format !== 'txt' && format !== 'json' && format !== 'vtt') {
      throw new Error('Unsupported transcript format.')
    }
    return exportTranscript(format)
  })
}

async function resolveCredentials(config: SessionConfig): Promise<SessionConfig> {
  if (process.env.WLC_E2E === '1' && !app.isPackaged) {
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

async function exportTranscript(format: ExportFormat): Promise<{ canceled: boolean; path?: string }> {
  const options: SaveDialogOptions = {
    title: 'Export bilingual transcript',
    defaultPath: `wedding-captions-${new Date().toISOString().replaceAll(':', '-')}.${format}`,
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
  displayServer.broadcast(snapshot)
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
  void displayServer.stop()
})

app.on('window-all-closed', () => app.quit())
