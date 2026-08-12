import { contextBridge, ipcRenderer } from 'electron'
import type {
  CaptionSnapshot,
  ExportFormat,
  LanShareState,
  LanguageMode,
  LiveCaptionBridgeApi,
  NativeOverlayOptions,
  SessionConfig,
} from '@live-caption-bridge/caption-protocol'

const api: LiveCaptionBridgeApi = {
  getBootstrap: () => ipcRenderer.invoke('app:get-bootstrap'),
  startSession: (config: SessionConfig) => ipcRenderer.invoke('session:start', config),
  pauseSession: () => ipcRenderer.invoke('session:pause'),
  endSession: () => ipcRenderer.invoke('session:end'),
  clearCaptions: () => ipcRenderer.invoke('session:clear'),
  setLanguageMode: (mode: LanguageMode) => ipcRenderer.invoke('session:set-language', mode),
  reportDeviceLost: () => ipcRenderer.invoke('session:device-lost'),
  updateNetworkState: (online: boolean) => ipcRenderer.send('network:update', online),
  pushAudio: (chunk: ArrayBuffer) => ipcRenderer.send('audio:push', chunk),
  openDisplay: (displayId: number) => ipcRenderer.invoke('display:open', displayId),
  closeDisplay: () => ipcRenderer.invoke('display:close'),
  openNativeOverlay: (options: NativeOverlayOptions) =>
    ipcRenderer.invoke('overlay:open-native', options),
  closeNativeOverlay: () => ipcRenderer.invoke('overlay:close-native'),
  startLanSharing: (address: string) => ipcRenderer.invoke('lan:start', address),
  stopLanSharing: () => ipcRenderer.invoke('lan:stop'),
  exportTranscript: (format: ExportFormat) => ipcRenderer.invoke('transcript:export', format),
  clearSavedCredentials: () => ipcRenderer.invoke('credentials:clear'),
  onSnapshot: (callback: (snapshot: CaptionSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: CaptionSnapshot): void => {
      callback(snapshot)
    }
    ipcRenderer.on('caption:snapshot', handler)
    return () => ipcRenderer.removeListener('caption:snapshot', handler)
  },
  onLanShare: (callback: (state: LanShareState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: LanShareState): void => {
      callback(state)
    }
    ipcRenderer.on('lan:state', handler)
    return () => ipcRenderer.removeListener('lan:state', handler)
  }
}

contextBridge.exposeInMainWorld('liveCaptionBridge', api)
