export interface CaptureConfigureMessage {
  type: 'configure'
  frameSize: number
  hopSize: number
}

export interface CaptureFrameMessage {
  type: 'frame'
  samples: Float32Array
}

export interface AnalyzePitchMessage {
  type: 'analyze'
  samples: Float32Array
  sampleRate: number
  gateDb: number
  timestamp: number
  revision: number
}

interface PitchWorkerBaseMessage {
  rms: number
  timestamp: number
  revision: number
}

export interface PitchWorkerResultMessage extends PitchWorkerBaseMessage {
  type: 'pitch'
  frequency: number
  clarity: number
}

export interface PitchWorkerSilentMessage extends PitchWorkerBaseMessage {
  type: 'silent'
}

export interface PitchWorkerUnpitchedMessage extends PitchWorkerBaseMessage {
  type: 'unpitched'
}

export type PitchWorkerMessage =
  PitchWorkerResultMessage | PitchWorkerSilentMessage | PitchWorkerUnpitchedMessage
