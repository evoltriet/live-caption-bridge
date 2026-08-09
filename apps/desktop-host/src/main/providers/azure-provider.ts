import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk'
import type {
  CaptionSegment,
  LanguageMode,
  ProviderEvent,
  SessionConfig,
  SpeechProvider,
  SupportedLocale
} from '@live-caption-bridge/caption-protocol'
import { isSupportedLocale } from '@live-caption-bridge/caption-protocol'

export type ProviderEventHandler = (event: ProviderEvent) => void

export class AzureSpeechProvider implements SpeechProvider {
  readonly kind = 'azure' as const

  private readonly emitEvent: ProviderEventHandler
  private recognizer?: speechSdk.TranslationRecognizer
  private audioStream?: speechSdk.PushAudioInputStream
  private config?: SessionConfig
  private languageMode: LanguageMode = 'auto'
  private sequence = 0
  private segmentStartedAt = Date.now()
  private stopping = false

  constructor(emitEvent: ProviderEventHandler) {
    this.emitEvent = emitEvent
  }

  async start(config: SessionConfig): Promise<void> {
    const key = config.azureKey?.trim()
    const region = config.azureRegion?.trim()
    if (!key || !region) {
      throw new Error('Azure key and region are required.')
    }

    this.config = { ...config, azureKey: key, azureRegion: region }
    this.languageMode = config.languageMode
    this.stopping = false
    this.emitEvent({ type: 'status', status: { phase: 'connecting', message: undefined } })

    const endpoint = new URL(`wss://${region}.stt.speech.microsoft.com/speech/universal/v2`)
    const translationConfig = speechSdk.SpeechTranslationConfig.fromEndpoint(endpoint, key)
    translationConfig.addTargetLanguage('en')
    translationConfig.addTargetLanguage('vi')
    if (this.languageMode === 'auto') {
      translationConfig.setProperty(
        speechSdk.PropertyId.SpeechServiceConnection_LanguageIdMode,
        'Continuous'
      )
    }

    const format = speechSdk.AudioStreamFormat.getWaveFormatPCM(16_000, 16, 1)
    this.audioStream = speechSdk.AudioInputStream.createPushStream(format)
    const audioConfig = speechSdk.AudioConfig.fromStreamInput(this.audioStream)

    if (this.languageMode === 'auto') {
      const languageConfig = speechSdk.AutoDetectSourceLanguageConfig.fromLanguages([
        'en-US',
        'vi-VN'
      ])
      this.recognizer = speechSdk.TranslationRecognizer.FromConfig(
        translationConfig,
        languageConfig,
        audioConfig
      )
    } else {
      translationConfig.speechRecognitionLanguage = this.languageMode
      this.recognizer = new speechSdk.TranslationRecognizer(translationConfig, audioConfig)
    }

    this.attachEvents(this.recognizer)
    await startRecognizer(this.recognizer)
    this.emitEvent({
      type: 'status',
      status: { phase: 'listening', languageMode: this.languageMode, message: undefined }
    })
  }

  pushAudio(chunk: ArrayBuffer): void {
    if (!this.audioStream || this.stopping || chunk.byteLength === 0) {
      return
    }
    this.audioStream.write(chunk)
  }

  async setLanguageMode(mode: LanguageMode): Promise<void> {
    if (mode === this.languageMode) {
      return
    }
    const next = this.config ? { ...this.config, languageMode: mode } : undefined
    await this.stop()
    if (next) {
      await this.start(next)
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    const recognizer = this.recognizer
    this.recognizer = undefined
    if (recognizer) {
      await stopRecognizer(recognizer)
      recognizer.close()
    }
    this.audioStream?.close()
    this.audioStream = undefined
  }

  private attachEvents(recognizer: speechSdk.TranslationRecognizer): void {
    recognizer.recognizing = (_sender, event) => {
      const segment = this.toSegment(event.result, false)
      if (segment) {
        this.emitEvent({ type: 'segment', segment })
      }
    }

    recognizer.recognized = (_sender, event) => {
      if (event.result.reason !== speechSdk.ResultReason.TranslatedSpeech) {
        return
      }
      const segment = this.toSegment(event.result, true)
      if (segment) {
        this.emitEvent({ type: 'segment', segment })
        this.segmentStartedAt = Date.now()
      }
    }

    recognizer.canceled = (_sender, event) => {
      if (this.stopping) {
        return
      }
      const detail = event.errorDetails?.trim() || speechSdk.CancellationReason[event.reason]
      this.emitEvent({ type: 'fatal', message: `Azure Speech disconnected: ${detail}` })
    }

    recognizer.sessionStarted = () => {
      this.emitEvent({ type: 'status', status: { phase: 'listening', message: undefined } })
    }
  }

  private toSegment(
    result: speechSdk.TranslationRecognitionResult,
    isFinal: boolean
  ): CaptionSegment | undefined {
    const sourceText = result.text?.trim()
    if (!sourceText) {
      return undefined
    }

    const locale = this.detectLocale(result)
    const now = Date.now()
    const id = isFinal ? result.resultId || `final-${this.sequence + 1}` : 'active'
    if (isFinal) {
      this.sequence += 1
    }

    const englishTranslation = result.translations.get('en')?.trim()
    const vietnameseTranslation = result.translations.get('vi')?.trim()
    return {
      id,
      sequence: isFinal ? this.sequence : this.sequence + 1,
      sourceLocale: locale,
      sourceText,
      texts: {
        'en-US': locale === 'en-US' ? sourceText : englishTranslation || '',
        'vi-VN': locale === 'vi-VN' ? sourceText : vietnameseTranslation || ''
      },
      isFinal,
      startedAt: this.segmentStartedAt,
      emittedAt: now
    }
  }

  private detectLocale(result: speechSdk.TranslationRecognitionResult): SupportedLocale {
    if (this.languageMode !== 'auto') {
      return this.languageMode
    }
    const detected = speechSdk.AutoDetectSourceLanguageResult.fromResult(result).language
    return isSupportedLocale(detected) ? detected : 'en-US'
  }
}

function startRecognizer(recognizer: speechSdk.TranslationRecognizer): Promise<void> {
  return new Promise((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(resolve, (error) => reject(new Error(error)))
  })
}

function stopRecognizer(recognizer: speechSdk.TranslationRecognizer): Promise<void> {
  return new Promise((resolve) => {
    recognizer.stopContinuousRecognitionAsync(resolve, () => resolve())
  })
}
