export type InstrumentFamily = 'guitar' | 'bass' | 'custom'
export type TunerMode = 'chromatic' | 'automatic' | 'guided'
export type InterfaceMode = 'standard' | 'professional'
export type AccidentalStyle = 'sharp' | 'flat'

export interface TuningPreset {
  id: string
  name: string
  family: InstrumentFamily
  stringCount: number
  /** MIDI notes ordered from the thickest/lowest string to the thinnest/highest. */
  strings: readonly number[]
  custom?: boolean
}

export interface CustomTuning extends Omit<TuningPreset, 'custom' | 'strings'> {
  family: 'custom'
  strings: number[]
  custom: true
  createdAt: number
  updatedAt: number
}

export interface TunerSettings {
  instrumentKey: string
  tuningId: string
  interfaceMode: InterfaceMode
  mode: TunerMode
  guidedStringIndex: number
  showGuidedSession: boolean
  showStrings: boolean
  showSignalPanel: boolean
  a4: number
  accidental: AccidentalStyle
  noiseGateDb: number
  inputDeviceId: string
  wakeLock: boolean
}

export type MicrophoneStatus =
  | 'idle'
  | 'requesting'
  | 'running'
  | 'denied'
  | 'missing'
  | 'unsupported'
  | 'no-signal'
  | 'weak-signal'
  | 'noisy-signal'
  | 'error'

export interface PitchMeasurement {
  frequency: number
  clarity: number
  rms: number
  timestamp: number
}

export interface TunerReading extends PitchMeasurement {
  rawFrequency: number
  midi: number
  noteMidi: number
  cents: number
  targetFrequency: number
  stringIndex: number | null
  state: 'in-tune' | 'close' | 'low' | 'high'
}
