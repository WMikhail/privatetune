import { centsBetween, frequencyToMidi, midiToFrequency } from '@/domain/note-math'
import type { TunerMode } from '@/domain/types'

export interface MatchOptions {
  mode: TunerMode
  strings: readonly number[]
  guidedStringIndex: number
  a4: number
  previousMidi: number | null
  hysteresisCents?: number
}

export interface PitchMatch {
  frequency: number
  midi: number
  noteMidi: number
  targetFrequency: number
  cents: number
  stringIndex: number | null
}

function harmonicCandidates(frequency: number): number[] {
  return [frequency, frequency / 2, frequency / 3]
}

function targetDistance(frequency: number, targetMidi: number, a4: number): number {
  return Math.abs(centsBetween(frequency, midiToFrequency(targetMidi, a4)))
}

export function matchPitch(rawFrequency: number, options: MatchOptions): PitchMatch {
  const { mode, strings, guidedStringIndex, a4, previousMidi, hysteresisCents = 18 } = options

  if (mode === 'chromatic' || strings.length === 0) {
    const midiFloat = frequencyToMidi(rawFrequency, a4)
    let noteMidi = Math.round(midiFloat)
    if (
      previousMidi !== null &&
      Math.abs(centsBetween(rawFrequency, midiToFrequency(previousMidi, a4))) < 50 + hysteresisCents
    ) {
      noteMidi = previousMidi
    }
    const targetFrequency = midiToFrequency(noteMidi, a4)
    return {
      frequency: rawFrequency,
      midi: midiFloat,
      noteMidi,
      targetFrequency,
      cents: centsBetween(rawFrequency, targetFrequency),
      stringIndex: null
    }
  }

  const clampedGuidedIndex = Math.min(Math.max(guidedStringIndex, 0), strings.length - 1)
  const allowed =
    mode === 'guided'
      ? [{ midi: strings[clampedGuidedIndex] ?? strings[0]!, index: clampedGuidedIndex }]
      : strings.map((midi, index) => ({ midi, index }))

  let best = {
    frequency: rawFrequency,
    midi: allowed[0]!.midi,
    index: allowed[0]!.index,
    distance: Infinity
  }
  for (const candidate of harmonicCandidates(rawFrequency)) {
    for (const target of allowed) {
      const distance = targetDistance(candidate, target.midi, a4)
      if (distance < best.distance)
        best = { frequency: candidate, midi: target.midi, index: target.index, distance }
    }
  }

  if (mode === 'automatic' && previousMidi !== null && strings.includes(previousMidi)) {
    const previousDistance = targetDistance(best.frequency, previousMidi, a4)
    if (previousDistance <= best.distance + hysteresisCents) {
      best = {
        frequency: best.frequency,
        midi: previousMidi,
        index: strings.indexOf(previousMidi),
        distance: previousDistance
      }
    }
  }

  const targetFrequency = midiToFrequency(best.midi, a4)
  return {
    frequency: best.frequency,
    midi: frequencyToMidi(best.frequency, a4),
    noteMidi: best.midi,
    targetFrequency,
    cents: centsBetween(best.frequency, targetFrequency),
    stringIndex: best.index
  }
}
