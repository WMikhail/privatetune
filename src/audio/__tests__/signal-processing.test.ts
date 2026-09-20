import { describe, expect, it } from 'vitest'
import { PitchSmoother } from '../pitch-smoother'
import { amplitudeToDb, dbToAmplitude, passesSignalGate, prepareSignal } from '../signal-gate'
import { matchPitch } from '../tuning-matcher'
import { midiToFrequency } from '@/domain/note-math'

describe('signal gate', () => {
  it('removes DC and calculates RMS', () => {
    const prepared = prepareSignal(new Float32Array([1, 2, 1, 2]))
    expect([...prepared.samples]).toEqual([-0.5, 0.5, -0.5, 0.5])
    expect(prepared.rms).toBeCloseTo(0.5)
  })

  it('uses a dB threshold', () => {
    expect(amplitudeToDb(dbToAmplitude(-55))).toBeCloseTo(-55, 8)
    expect(passesSignalGate(0.01, -50)).toBe(true)
    expect(passesSignalGate(0.001, -50)).toBe(false)
  })
})

describe('smoothing and matching', () => {
  it('rejects an outlier through the median and smooths movement', () => {
    const smoother = new PitchSmoother(5, 0.5)
    smoother.push(2)
    smoother.push(2.5)
    smoother.push(50)
    smoother.push(3)
    expect(smoother.push(3.2)).toBeLessThan(5)
    smoother.reset()
    expect(smoother.push(-8)).toBe(-8)
  })

  it('locks guided mode to the selected string', () => {
    const matched = matchPitch(112, {
      mode: 'guided',
      strings: [36, 43, 48, 53, 57, 62],
      guidedStringIndex: 0,
      a4: 440,
      previousMidi: null
    })
    expect(matched.noteMidi).toBe(36)
    expect(matched.stringIndex).toBe(0)
  })

  it('corrects a dominant second harmonic against tuning targets', () => {
    const matched = matchPitch(130.8128, {
      mode: 'guided',
      strings: [36, 43, 48, 53, 57, 62],
      guidedStringIndex: 0,
      a4: 440,
      previousMidi: null
    })
    expect(matched.noteMidi).toBe(36)
    expect(matched.frequency).toBeCloseTo(65.4064, 3)
    expect(Math.abs(matched.cents)).toBeLessThan(0.01)
  })

  it('prefers a nearby fundamental over an ambiguous third harmonic in automatic mode', () => {
    const frequency = midiToFrequency(64) * 2 ** (3 / 1200)
    const matched = matchPitch(frequency, {
      mode: 'automatic',
      strings: [40, 45, 50, 55, 59, 64],
      guidedStringIndex: 0,
      a4: 440,
      previousMidi: null
    })
    expect(matched.noteMidi).toBe(64)
    expect(matched.stringIndex).toBe(5)
    expect(matched.cents).toBeCloseTo(3)
  })

  it('uses hysteresis before switching automatic strings', () => {
    const options = {
      mode: 'automatic',
      strings: [40, 45, 50, 55, 59, 64],
      guidedStringIndex: 0,
      a4: 440,
      hysteresisCents: 35
    } as const
    expect(matchPitch(96, { ...options, previousMidi: null }).noteMidi).toBe(45)
    expect(matchPitch(96, { ...options, previousMidi: 40 }).noteMidi).toBe(40)
  })
})
