declare const sampleRate: number
declare function registerProcessor(name: string, constructor: typeof AudioWorkletProcessor): void
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(inputs: Float32Array[][]): boolean
}

const TARGET_RATE = 16_000
const CHUNK_SAMPLES = 1_600

class PcmCaptureProcessor extends AudioWorkletProcessor {
  private input: number[] = []
  private output: number[] = []
  private readPosition = 0

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) {
      return true
    }

    for (const sample of channel) {
      this.input.push(sample)
    }

    const ratio = sampleRate / TARGET_RATE
    while (this.readPosition + 1 < this.input.length) {
      const left = Math.floor(this.readPosition)
      const fraction = this.readPosition - left
      const first = this.input[left] ?? 0
      const second = this.input[left + 1] ?? first
      this.output.push(first + (second - first) * fraction)
      this.readPosition += ratio
    }

    const consumed = Math.floor(this.readPosition)
    if (consumed > 0) {
      this.input.splice(0, consumed)
      this.readPosition -= consumed
    }

    while (this.output.length >= CHUNK_SAMPLES) {
      const samples = this.output.splice(0, CHUNK_SAMPLES)
      const pcm = new Int16Array(samples.length)
      samples.forEach((sample, index) => {
        const clamped = Math.max(-1, Math.min(1, sample))
        pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      })
      this.port.postMessage(pcm.buffer, [pcm.buffer])
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)

export {}
