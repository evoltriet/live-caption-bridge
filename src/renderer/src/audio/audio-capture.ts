import pcmWorkletUrl from './pcm-worklet.ts?worker&url'

export interface AudioMeterReading {
  level: number
  clipping: boolean
}

export interface AudioCaptureOptions {
  deviceId: string
  onChunk: (chunk: ArrayBuffer) => void
  onMeter: (reading: AudioMeterReading) => void
  onDeviceLost: () => void
}

export class AudioCapture {
  private context?: AudioContext
  private stream?: MediaStream
  private analyser?: AnalyserNode
  private animationFrame?: number
  private selectedDeviceId?: string
  private readonly options: AudioCaptureOptions

  constructor(options: AudioCaptureOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    if (this.context) {
      return
    }

    this.selectedDeviceId = this.options.deviceId
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: this.options.deviceId },
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
        channelCount: 1
      },
      video: false
    })

    this.context = new AudioContext({ latencyHint: 'interactive' })
    await this.context.audioWorklet.addModule(pcmWorkletUrl)
    const source = this.context.createMediaStreamSource(this.stream)
    const worklet = new AudioWorkletNode(this.context, 'pcm-capture')
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1_024
    const silent = this.context.createGain()
    silent.gain.value = 0

    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.options.onChunk(event.data)
    }
    source.connect(this.analyser)
    source.connect(worklet)
    worklet.connect(silent)
    silent.connect(this.context.destination)
    navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange)
    this.readMeter()
  }

  async stop(): Promise<void> {
    navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange)
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = undefined
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = undefined
    await this.context?.close()
    this.context = undefined
    this.analyser = undefined
    this.options.onMeter({ level: 0, clipping: false })
  }

  private readonly handleDeviceChange = async (): Promise<void> => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const stillConnected = devices.some(
      (device) => device.kind === 'audioinput' && device.deviceId === this.selectedDeviceId
    )
    if (!stillConnected) {
      await this.stop()
      this.options.onDeviceLost()
    }
  }

  private readonly readMeter = (): void => {
    if (!this.analyser) {
      return
    }
    const samples = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(samples)
    let sum = 0
    let peak = 0
    for (const sample of samples) {
      sum += sample * sample
      peak = Math.max(peak, Math.abs(sample))
    }
    const rms = Math.sqrt(sum / samples.length)
    this.options.onMeter({ level: Math.min(1, rms * 4), clipping: peak >= 0.98 })
    this.animationFrame = requestAnimationFrame(this.readMeter)
  }
}
