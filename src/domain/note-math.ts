import type { AccidentalStyle } from './types'

export const SHARP_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B'
] as const
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

export function frequencyToMidi(frequency: number, a4 = 440): number {
  if (!(frequency > 0) || !(a4 > 0)) return Number.NaN
  return 69 + 12 * Math.log2(frequency / a4)
}

export function centsBetween(frequency: number, targetFrequency: number): number {
  if (!(frequency > 0) || !(targetFrequency > 0)) return Number.NaN
  return 1200 * Math.log2(frequency / targetFrequency)
}

export function midiToNote(midi: number, accidental: AccidentalStyle = 'sharp') {
  const rounded = Math.round(midi)
  const pitchClass = ((rounded % 12) + 12) % 12
  const names = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES
  return { name: names[pitchClass] ?? '—', octave: Math.floor(rounded / 12) - 1, midi: rounded }
}

export function noteToMidi(pitchClass: number, octave: number): number {
  return (octave + 1) * 12 + pitchClass
}

export function parseAsciiNote(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!match) throw new Error(`Invalid note: ${note}`)
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const letter = match[1]
  const accidental = match[2]
  const octave = Number(match[3])
  let pitchClass = base[letter ?? '']
  if (pitchClass === undefined) throw new Error(`Invalid note: ${note}`)
  if (accidental === '#') pitchClass += 1
  if (accidental === 'b') pitchClass -= 1
  return noteToMidi((pitchClass + 12) % 12, octave)
}

export function formatNote(midi: number, accidental: AccidentalStyle = 'sharp'): string {
  const note = midiToNote(midi, accidental)
  return `${note.name}${note.octave}`
}
