import { describe, expect, it, vi } from 'vitest'
import type { AudioInputSource } from '../microphone-service'
import {
  TunerEngine,
  type TunerEngineConfig,
  type TunerEngineEvents,
  type TunerEnginePlatform
} from '../tuner-engine'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function config(overrides: Partial<TunerEngineConfig> = {}): TunerEngineConfig {
  return {
    mode: 'automatic',
    strings: [40, 45, 50, 55, 59, 64],
    guidedStringIndex: 0,
    a4: 440,
    gateDb: -55,
    inputDeviceId: '',
    ...overrides
  }
}

function eventSpies(): TunerEngineEvents & {
  onStatus: ReturnType<typeof vi.fn>
  onReading: ReturnType<typeof vi.fn>
} {
  return {
    onStatus: vi.fn(),
    onReading: vi.fn(),
    onLevel: vi.fn(),
    onDevices: vi.fn()
  }
}

function createAudioHarness() {
  const captureMessages: unknown[] = []
  const capturePort = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn((message: unknown) => captureMessages.push(message))
  }
  const connectable = () => ({
    connect(destination: unknown) {
      return destination
    },
    disconnect: vi.fn()
  })
  const captureNode = { ...connectable(), port: capturePort } as unknown as AudioWorkletNode
  const sourceNode = connectable() as unknown as MediaStreamAudioSourceNode
  const muteNode = { ...connectable(), gain: { value: 1 } } as unknown as GainNode
  const destination = connectable() as unknown as AudioDestinationNode
  const worker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn()
  } as unknown as Worker
  const context = {
    state: 'running',
    sampleRate: 48_000,
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn(() => sourceNode),
    createGain: vi.fn(() => muteNode),
    destination
  } as unknown as AudioContext
  const platform: TunerEnginePlatform = {
    isAudioSupported: () => true,
    createContext: vi.fn(() => context),
    createCaptureNode: vi.fn(() => captureNode),
    createWorker: vi.fn(() => worker),
    now: () => 1000,
    setInterval: vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>),
    clearInterval: vi.fn()
  }
  return { captureMessages, context, platform }
}

describe('TunerEngine lifecycle', () => {
  it('does not revive a session stopped while getUserMedia is pending', async () => {
    const pendingStream = deferred<MediaStream>()
    const trackStop = vi.fn()
    let currentStream: MediaStream | null = null
    const input: AudioInputSource = {
      start: vi.fn(async () => {
        currentStream = await pendingStream.promise
        return currentStream
      }),
      stop: vi.fn(() => {
        currentStream?.getTracks().forEach((track) => track.stop())
        currentStream = null
      }),
      listInputs: vi.fn().mockResolvedValue([])
    }
    const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream
    const events = eventSpies()
    const harness = createAudioHarness()
    const engine = new TunerEngine(config(), events, input, harness.platform)

    const starting = engine.start()
    await vi.waitFor(() => expect(input.start).toHaveBeenCalledOnce())
    const stopping = engine.stop()
    pendingStream.resolve(stream)
    await Promise.all([starting, stopping])

    expect(trackStop).toHaveBeenCalledOnce()
    expect(harness.platform.createContext).not.toHaveBeenCalled()
    expect(events.onStatus).not.toHaveBeenCalledWith('running')
    expect(events.onStatus).toHaveBeenLastCalledWith('idle')
  })

  it('expands the active worklet window when switching to low bass', async () => {
    const stream = { getTracks: () => [] } as unknown as MediaStream
    const input: AudioInputSource = {
      start: vi.fn().mockResolvedValue(stream),
      stop: vi.fn(),
      listInputs: vi.fn().mockResolvedValue([])
    }
    const harness = createAudioHarness()
    const engine = new TunerEngine(config(), eventSpies(), input, harness.platform)

    await engine.start()
    expect(harness.captureMessages).toContainEqual({
      type: 'configure',
      frameSize: 8192,
      hopSize: 1920
    })

    engine.updateConfig(config({ strings: [21, 28, 33, 38, 43] }))
    expect(harness.captureMessages.at(-1)).toEqual({
      type: 'configure',
      frameSize: 16384,
      hopSize: 1920
    })

    await engine.stop()
  })
})
