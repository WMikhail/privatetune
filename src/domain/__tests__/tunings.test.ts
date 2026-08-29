import { describe, expect, it } from 'vitest'
import { formatNote } from '../note-math'
import { BUILT_IN_TUNINGS, INSTRUMENTS, tuningsForInstrument } from '../tunings'

const controls: Record<string, string[]> = {
  'g6-drop-c': ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'],
  'g6-drop-b': ['B1', 'F♯2', 'B2', 'E3', 'G♯3', 'C♯4'],
  'g7-drop-a': ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'g8-fs-standard': ['F♯1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'g8-drop-e': ['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'b4-e-standard': ['E1', 'A1', 'D2', 'G2'],
  'b5-b-standard': ['B0', 'E1', 'A1', 'D2', 'G2'],
  'b5-drop-a': ['A0', 'E1', 'A1', 'D2', 'G2']
}

describe('typed tuning catalog', () => {
  it.each(Object.entries(controls))('%s has the required notes and octaves', (id, expected) => {
    const tuning = BUILT_IN_TUNINGS.find((item) => item.id === id)
    expect(tuning).toBeDefined()
    expect(tuning?.strings.map((midi) => formatNote(midi))).toEqual(expected)
  })

  it('contains valid, ascending MIDI notes and consistent string counts', () => {
    expect(new Set(BUILT_IN_TUNINGS.map((item) => item.id)).size).toBe(BUILT_IN_TUNINGS.length)
    for (const tuning of BUILT_IN_TUNINGS) {
      expect(tuning.strings).toHaveLength(tuning.stringCount)
      expect(
        tuning.strings.every((midi) => Number.isInteger(midi) && midi >= 19 && midi <= 64)
      ).toBe(true)
      expect(
        tuning.strings.every(
          (midi, index) => index === 0 || midi > (tuning.strings[index - 1] ?? 0)
        )
      ).toBe(true)
    }
  })

  it('covers every declared instrument with the required catalog size', () => {
    const expectedCounts: Record<string, number> = {
      'guitar-6': 14,
      'guitar-7': 7,
      'guitar-8': 6,
      'bass-4': 11,
      'bass-5': 6,
      'bass-6': 2
    }
    for (const instrument of INSTRUMENTS) {
      const tunings = tuningsForInstrument(instrument.key)
      expect(tunings).toHaveLength(expectedCounts[instrument.key])
      expect(tunings.every((item) => item.stringCount === instrument.stringCount)).toBe(true)
    }
  })
})
