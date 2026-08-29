import type { CaptureConfigureMessage, CaptureFrameMessage } from './audio-protocol'
import { PcmFrameCollector } from './frame-collector'

declare const AudioWorkletProcessor: {
  new (): { readonly port: MessagePort }
}

declare function registerProcessor(
  name: string,
  processor: new () => {
    readonly port: MessagePort
    process(inputs: Float32Array[][]): boolean
  }
): void

class AudioCaptureProcessor extends AudioWorkletProcessor {
  private readonly collector = new PcmFrameCollector()

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<CaptureConfigureMessage>) => {
      if (event.data.type !== 'configure') return
      this.collector.configure(event.data.frameSize, event.data.hopSize)
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (const samples of this.collector.push(channel)) {
      const message: CaptureFrameMessage = { type: 'frame', samples }
      this.port.postMessage(message, [samples.buffer])
    }
    return true
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
