import { describe, expect, it } from 'vitest'
import { analyzePcmFrame } from '../analysis-pipeline'
import { chooseFrameSize } from '../frame-size'
import { MpmPitchDetector } from '../pitch-detector'
import { centsBetween, frequencyToMidi, midiToFrequency } from '@/domain/note-math'
import { matchPitch } from '../tuning-matcher'

const sampleRate = 48_000

function noise(index: number): number {
  // Deterministic hash noise in [-1, 1].
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

function synth(
  frequency: number,
  length: number,
  options: { noise?: number; fundamental?: number; second?: number } = {}
): Float32Array {
  const result = new Float32Array(length)
  const fundamental = options.fundamental ?? 0.8
  const second = options.second ?? 0
  for (let index = 0; index < length; index += 1) {
    const phase = (2 * Math.PI * frequency * index) / sampleRate
    result[index] =
      fundamental * Math.sin(phase) +
      second * Math.sin(phase * 2 + 0.21) +
      (options.noise ?? 0) * noise(index)
  }
  return result
}

function detect(frequency: number, options = {}) {
  const midi = Math.round(frequencyToMidi(frequency))
  const size = chooseFrameSize(midi, sampleRate)
  const result = analyzePcmFrame(
    synth(frequency, size, options),
    sampleRate,
    -70,
    new MpmPitchDetector()
  )
  expect(result.type).toBe('pitch')
  if (result.type !== 'pitch') throw new Error(`Expected pitch, received ${result.type}`)
  return result
}

describe('deterministic MPM benchmark', () => {
  it.each([27.5, 30.8677, 41.2034, 65.4064, 82.4069, 110, 146.832, 220, 440])(
    'detects a clean %.4f Hz sine within 1 cent',
    (frequency) => {
      const result = detect(frequency)
      expect(Math.abs(centsBetween(result.frequency, frequency))).toBeLessThanOrEqual(1)
    }
  )

  it.each([41.2034, 65.4064, 82.4069, 110, 220, 440])(
    'stays within 3 cents with moderate noise and harmonics at %.4f Hz',
    (frequency) => {
      const result = detect(frequency, { noise: 0.08, fundamental: 0.65, second: 0.38 })
      expect(Math.abs(centsBetween(result.frequency, frequency))).toBeLessThanOrEqual(3)
    }
  )

  it.each([27.5, 30.8677, 36.7081])(
    'stays within 5 cents in the low bass range at %.4f Hz',
    (frequency) => {
      const result = detect(frequency, { noise: 0.05, fundamental: 0.75, second: 0.28 })
      expect(Math.abs(centsBetween(result.frequency, frequency))).toBeLessThanOrEqual(5)
    }
  )

  it('recovers the fundamental when the second harmonic dominates', () => {
    const fundamental = midiToFrequency(36)
    const result = detect(fundamental, { fundamental: 0.22, second: 0.9 })
    const matched = matchPitch(result.frequency, {
      mode: 'guided',
      strings: [36, 43, 48, 53, 57, 62],
      guidedStringIndex: 0,
      a4: 440,
      previousMidi: null
    })
    expect(Math.abs(matched.cents)).toBeLessThanOrEqual(3)
    expect(matched.noteMidi).toBe(36)
  })

  it('uses windows inside stabilization budgets', () => {
    expect((chooseFrameSize(40, sampleRate) / sampleRate) * 1000).toBeLessThan(500)
    expect((chooseFrameSize(21, sampleRate) / sampleRate) * 1000).toBeLessThan(800)
  })
})
