import { PitchDetector as PitchyDetector } from 'pitchy'

export interface PitchDetection {
  frequency: number
  clarity: number
}

export interface PitchDetector {
  detect(samples: Float32Array, sampleRate: number): PitchDetection | null
}

export class MpmPitchDetector implements PitchDetector {
  private readonly detectors = new Map<number, PitchyDetector<Float32Array>>()

  detect(samples: Float32Array, sampleRate: number): PitchDetection | null {
    let detector = this.detectors.get(samples.length)
    if (!detector) {
      detector = PitchyDetector.forFloat32Array(samples.length)
      this.detectors.set(samples.length, detector)
    }
    const [frequency, clarity] = detector.findPitch(samples, sampleRate)
    if (!Number.isFinite(frequency) || frequency <= 0) return null
    return { frequency, clarity }
  }
}
