import type { PitchDetection, PitchDetector } from './pitch-detector'
import { passesSignalGate, prepareSignal } from './signal-gate'

export type FrameAnalysis =
  ({ type: 'pitch'; rms: number } & PitchDetection) | { type: 'silent' | 'unpitched'; rms: number }

/** Deterministic seam used by the Worker and synthetic tests; it never stores PCM. */
export function analyzePcmFrame(
  samples: Float32Array,
  sampleRate: number,
  gateDb: number,
  detector: PitchDetector
): FrameAnalysis {
  const prepared = prepareSignal(samples)
  if (!passesSignalGate(prepared.rms, gateDb)) return { type: 'silent', rms: prepared.rms }
  const pitch = detector.detect(prepared.samples, sampleRate)
  return pitch
    ? { type: 'pitch', ...pitch, rms: prepared.rms }
    : { type: 'unpitched', rms: prepared.rms }
}
