import type { MicrophoneStatus, TunerMode, TunerReading } from '@/domain/types'
import audioCaptureWorkletUrl from './audio-capture-worklet.ts?worker&url'
import type {
  AnalyzePitchMessage,
  CaptureConfigureMessage,
  CaptureFrameMessage,
  PitchWorkerMessage
} from './audio-protocol'
import { chooseFrameSize } from './frame-size'
import { MicrophoneError, MicrophoneService, type AudioInputSource } from './microphone-service'
import { PitchSmoother } from './pitch-smoother'
import { matchPitch } from './tuning-matcher'

export interface TunerEngineConfig {
  mode: TunerMode
  strings: readonly number[]
  guidedStringIndex: number
  a4: number
  gateDb: number
  inputDeviceId: string
}

export interface TunerEngineEvents {
  onStatus: (status: MicrophoneStatus) => void
  onReading: (reading: TunerReading | null) => void
  onLevel: (rms: number) => void
  onDevices: (devices: MediaDeviceInfo[]) => void
}

export interface TunerEnginePlatform {
  isAudioSupported: () => boolean
  createContext: () => AudioContext
  createCaptureNode: (context: AudioContext) => AudioWorkletNode
  createWorker: () => Worker
  now: () => number
  setInterval: (handler: () => void, milliseconds: number) => ReturnType<typeof setInterval>
  clearInterval: (timer: ReturnType<typeof setInterval>) => void
}

const browserPlatform: TunerEnginePlatform = {
  isAudioSupported: () => Boolean(window.AudioContext && window.AudioWorkletNode),
  createContext: () => new window.AudioContext({ latencyHint: 'interactive' }),
  createCaptureNode: (context) =>
    new window.AudioWorkletNode(context, 'audio-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      outputChannelCount: [1]
    }),
  createWorker: () => new Worker(new URL('./pitch-worker.ts', import.meta.url), { type: 'module' }),
  now: () => performance.now(),
  setInterval: (handler, milliseconds) => setInterval(handler, milliseconds),
  clearInterval: (timer) => clearInterval(timer)
}

function stringsKey(strings: readonly number[]): string {
  return strings.join(',')
}

function minimumMidi(strings: readonly number[]): number {
  return Math.min(...strings, 40)
}

export class TunerEngine {
  private context: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private captureNode: AudioWorkletNode | null = null
  private muteNode: GainNode | null = null
  private worker: Worker | null = null
  private workerBusy = false
  private smoother = new PitchSmoother(5, 0.38)
  private previousMidi: number | null = null
  private lastPitchAt = 0
  private lastFrameAt = 0
  private signalTimer: ReturnType<typeof setInterval> | null = null
  private activeFrameSize = 0
  private analysisRevision = 0
  private sessionRevision = 0
  private lifecycle: Promise<void> = Promise.resolve()
  private config: TunerEngineConfig

  constructor(
    config: TunerEngineConfig,
    private readonly events: TunerEngineEvents,
    private readonly input: AudioInputSource = new MicrophoneService(),
    private readonly platform: TunerEnginePlatform = browserPlatform
  ) {
    this.config = config
  }

  updateConfig(config: TunerEngineConfig): void {
    const tuningChanged =
      config.mode !== this.config.mode ||
      config.guidedStringIndex !== this.config.guidedStringIndex ||
      stringsKey(config.strings) !== stringsKey(this.config.strings)
    const analysisChanged =
      tuningChanged || config.a4 !== this.config.a4 || config.gateDb !== this.config.gateDb

    this.config = config
    if (analysisChanged) {
      this.analysisRevision += 1
      this.smoother.reset()
      this.previousMidi = null
    }
    this.configureCaptureIfNeeded()
  }

  start(): Promise<void> {
    const session = ++this.sessionRevision
    this.events.onStatus('requesting')
    return this.enqueue(() => this.startSession(session))
  }

  stop(notify = true): Promise<void> {
    const session = ++this.sessionRevision
    return this.enqueue(async () => {
      await this.releaseResources()
      if (notify && this.isCurrentSession(session)) this.events.onStatus('idle')
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private async startSession(session: number): Promise<void> {
    await this.releaseResources()
    if (!this.isCurrentSession(session)) return

    try {
      if (!this.platform.isAudioSupported()) throw new MicrophoneError('unsupported')
      const stream = await this.input.start(this.config.inputDeviceId)
      if (!this.isCurrentSession(session)) {
        this.input.stop()
        return
      }

      const context = this.platform.createContext()
      this.context = context
      await context.audioWorklet.addModule(audioCaptureWorkletUrl)
      if (!this.isCurrentSession(session)) {
        await this.releaseResources()
        return
      }
      await context.resume()
      if (!this.isCurrentSession(session)) {
        await this.releaseResources()
        return
      }

      const captureNode = this.platform.createCaptureNode(context)
      const worker = this.platform.createWorker()
      this.captureNode = captureNode
      this.worker = worker
      this.configureCaptureIfNeeded()

      worker.onmessage = (event: MessageEvent<PitchWorkerMessage>) => {
        if (this.isCurrentSession(session)) this.handleWorker(event.data)
      }
      worker.onerror = () => this.handleWorkerFailure(session)
      worker.onmessageerror = () => this.handleWorkerFailure(session)
      captureNode.port.onmessage = (event: MessageEvent<CaptureFrameMessage>) => {
        if (
          !this.isCurrentSession(session) ||
          event.data.type !== 'frame' ||
          this.workerBusy ||
          !this.worker ||
          !this.context
        ) {
          return
        }
        this.workerBusy = true
        const samples = event.data.samples
        const message: AnalyzePitchMessage = {
          type: 'analyze',
          samples,
          sampleRate: this.context.sampleRate,
          gateDb: this.config.gateDb,
          timestamp: this.platform.now(),
          revision: this.analysisRevision
        }
        this.worker.postMessage(message, [samples.buffer])
      }

      this.sourceNode = context.createMediaStreamSource(stream)
      this.muteNode = context.createGain()
      this.muteNode.gain.value = 0
      this.sourceNode.connect(captureNode).connect(this.muteNode).connect(context.destination)

      if (!this.isCurrentSession(session)) {
        await this.releaseResources()
        return
      }
      this.lastPitchAt = this.platform.now()
      this.lastFrameAt = this.lastPitchAt
      this.signalTimer = this.platform.setInterval(() => {
        if (!this.isCurrentSession(session)) return
        if (this.platform.now() - this.lastFrameAt > 1600) {
          this.events.onStatus('no-signal')
          this.events.onReading(null)
        }
      }, 500)
      this.events.onStatus('running')
      void this.refreshDevices(session)
    } catch (error) {
      await this.releaseResources()
      if (!this.isCurrentSession(session)) return
      this.events.onStatus(error instanceof MicrophoneError ? error.status : 'error')
    }
  }

  private async refreshDevices(session: number): Promise<void> {
    try {
      const devices = await this.input.listInputs()
      if (this.isCurrentSession(session)) this.events.onDevices(devices)
    } catch {
      if (this.isCurrentSession(session)) this.events.onDevices([])
    }
  }

  private configureCaptureIfNeeded(): void {
    if (!this.captureNode || !this.context) return
    const frameSize = chooseFrameSize(minimumMidi(this.config.strings), this.context.sampleRate)
    if (frameSize === this.activeFrameSize) return

    const hopSize = Math.max(512, 128 * Math.round(this.context.sampleRate / 25 / 128))
    const message: CaptureConfigureMessage = { type: 'configure', frameSize, hopSize }
    this.captureNode.port.postMessage(message)
    this.activeFrameSize = frameSize
  }

  private async releaseResources(): Promise<void> {
    if (this.signalTimer) this.platform.clearInterval(this.signalTimer)
    this.signalTimer = null
    if (this.captureNode) this.captureNode.port.onmessage = null
    if (this.worker) {
      this.worker.onmessage = null
      this.worker.onerror = null
      this.worker.onmessageerror = null
    }
    this.safeDisconnect(this.captureNode)
    this.safeDisconnect(this.sourceNode)
    this.safeDisconnect(this.muteNode)
    this.worker?.terminate()
    this.worker = null
    this.captureNode = null
    this.sourceNode = null
    this.muteNode = null
    this.workerBusy = false
    this.activeFrameSize = 0
    this.input.stop()
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close()
      } catch {
        // A context can already be closing during page lifecycle teardown.
      }
    }
    this.context = null
    this.smoother.reset()
    this.previousMidi = null
    this.events.onReading(null)
    this.events.onLevel(0)
  }

  private safeDisconnect(node: AudioNode | null): void {
    try {
      node?.disconnect()
    } catch {
      // Disconnect is idempotent at the Engine boundary even on older browsers.
    }
  }

  private isCurrentSession(session: number): boolean {
    return session === this.sessionRevision
  }

  private handleWorkerFailure(session: number): void {
    if (!this.isCurrentSession(session)) return
    this.workerBusy = false
    this.events.onStatus('error')
    void this.stop(false)
  }

  private handleWorker(message: PitchWorkerMessage): void {
    this.workerBusy = false
    if (message.revision !== this.analysisRevision) return

    this.lastFrameAt = this.platform.now()
    this.events.onLevel(message.rms)
    if (message.type === 'silent') {
      if (this.platform.now() - this.lastPitchAt > 700) {
        this.events.onStatus(message.rms < 0.00001 ? 'no-signal' : 'weak-signal')
        this.events.onReading(null)
      }
      return
    }
    if (message.type === 'unpitched' || message.clarity < 0.82) {
      if (this.platform.now() - this.lastPitchAt > 700) {
        this.events.onStatus('noisy-signal')
        this.events.onReading(null)
      }
      return
    }

    this.lastPitchAt = this.platform.now()
    this.events.onStatus('running')
    const matched = matchPitch(message.frequency, {
      mode: this.config.mode,
      strings: this.config.strings,
      guidedStringIndex: this.config.guidedStringIndex,
      a4: this.config.a4,
      previousMidi: this.previousMidi
    })
    if (this.previousMidi !== null && this.previousMidi !== matched.noteMidi) this.smoother.reset()
    this.previousMidi = matched.noteMidi
    const smoothedCents = this.smoother.push(matched.cents)
    const absolute = Math.abs(smoothedCents)
    const state: TunerReading['state'] =
      absolute <= 3 ? 'in-tune' : absolute <= 10 ? 'close' : smoothedCents < 0 ? 'low' : 'high'
    this.events.onReading({
      ...matched,
      clarity: message.clarity,
      rms: message.rms,
      timestamp: message.timestamp,
      rawFrequency: message.frequency,
      cents: smoothedCents,
      state
    })
  }
}
