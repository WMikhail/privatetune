import { describe, expect, it } from 'vitest'
import {
  centsBetween,
  formatNote,
  frequencyToMidi,
  midiToFrequency,
  midiToNote,
  noteToMidi,
  parseAsciiNote
} from '../note-math'

describe('note math', () => {
  it('converts between MIDI and frequency', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(frequencyToMidi(440)).toBe(69)
    expect(midiToFrequency(21)).toBeCloseTo(27.5, 8)
    expect(frequencyToMidi(midiToFrequency(35))).toBeCloseTo(35, 10)
  })

  it('supports a reference frequency other than 440 Hz', () => {
    expect(midiToFrequency(69, 432)).toBe(432)
    expect(frequencyToMidi(432, 432)).toBe(69)
    expect(midiToFrequency(57, 432)).toBe(216)
  })

  it('calculates signed cents', () => {
    expect(centsBetween(440, 440)).toBe(0)
    expect(centsBetween(440 * 2 ** (3 / 1200), 440)).toBeCloseTo(3, 10)
    expect(centsBetween(220, 440)).toBeCloseTo(-1200, 10)
  })

  it('formats sharps, flats and octaves', () => {
    expect(formatNote(42, 'sharp')).toBe('F♯2')
    expect(formatNote(42, 'flat')).toBe('G♭2')
    expect(midiToNote(23)).toMatchObject({ name: 'B', octave: 0 })
    expect(noteToMidi(0, 4)).toBe(60)
    expect(parseAsciiNote('A#0')).toBe(22)
    expect(parseAsciiNote('Bb0')).toBe(22)
  })
})
