import type { InstrumentFamily, TuningPreset } from './types'

const preset = (
  id: string,
  name: string,
  family: InstrumentFamily,
  strings: readonly number[]
): TuningPreset => ({ id, name, family, stringCount: strings.length, strings })

export const BUILT_IN_TUNINGS: readonly TuningPreset[] = [
  preset('g6-e-standard', 'E Standard', 'guitar', [40, 45, 50, 55, 59, 64]),
  preset('g6-eb-standard', 'E♭ Standard', 'guitar', [39, 44, 49, 54, 58, 63]),
  preset('g6-d-standard', 'D Standard', 'guitar', [38, 43, 48, 53, 57, 62]),
  preset('g6-cs-standard', 'C♯ Standard', 'guitar', [37, 42, 47, 52, 56, 61]),
  preset('g6-c-standard', 'C Standard', 'guitar', [36, 41, 46, 51, 55, 60]),
  preset('g6-b-standard', 'B Standard', 'guitar', [35, 40, 45, 50, 54, 59]),
  preset('g6-drop-d', 'Drop D', 'guitar', [38, 45, 50, 55, 59, 64]),
  preset('g6-drop-cs', 'Drop C♯', 'guitar', [37, 44, 49, 54, 58, 63]),
  preset('g6-drop-c', 'Drop C', 'guitar', [36, 43, 48, 53, 57, 62]),
  preset('g6-drop-b', 'Drop B', 'guitar', [35, 42, 47, 52, 56, 61]),
  preset('g6-drop-bb', 'Drop B♭', 'guitar', [34, 41, 46, 51, 55, 60]),
  preset('g6-drop-a', 'Drop A', 'guitar', [33, 40, 45, 50, 54, 59]),
  preset('g6-drop-ab', 'Drop A♭', 'guitar', [32, 39, 44, 49, 53, 58]),
  preset('g6-drop-g', 'Drop G', 'guitar', [31, 38, 43, 48, 52, 57]),

  preset('g7-b-standard', 'B Standard', 'guitar', [35, 40, 45, 50, 55, 59, 64]),
  preset('g7-bb-standard', 'B♭ Standard', 'guitar', [34, 39, 44, 49, 54, 58, 63]),
  preset('g7-a-standard', 'A Standard', 'guitar', [33, 38, 43, 48, 53, 57, 62]),
  preset('g7-drop-a', 'Drop A', 'guitar', [33, 40, 45, 50, 55, 59, 64]),
  preset('g7-drop-ab', 'Drop A♭', 'guitar', [32, 39, 44, 49, 54, 58, 63]),
  preset('g7-drop-g', 'Drop G', 'guitar', [31, 38, 43, 48, 53, 57, 62]),
  preset('g7-drop-fs', 'Drop F♯', 'guitar', [30, 37, 42, 47, 52, 56, 61]),

  preset('g8-fs-standard', 'F♯ Standard', 'guitar', [30, 35, 40, 45, 50, 55, 59, 64]),
  preset('g8-f-standard', 'F Standard', 'guitar', [29, 34, 39, 44, 49, 54, 58, 63]),
  preset('g8-e-standard', 'E Standard', 'guitar', [28, 33, 38, 43, 48, 53, 57, 62]),
  preset('g8-drop-e', 'Drop E', 'guitar', [28, 35, 40, 45, 50, 55, 59, 64]),
  preset('g8-drop-eb', 'Drop E♭', 'guitar', [27, 34, 39, 44, 49, 54, 58, 63]),
  preset('g8-drop-d', 'Drop D', 'guitar', [26, 33, 38, 43, 48, 53, 57, 62]),

  preset('b4-e-standard', 'E Standard', 'bass', [28, 33, 38, 43]),
  preset('b4-eb-standard', 'E♭ Standard', 'bass', [27, 32, 37, 42]),
  preset('b4-d-standard', 'D Standard', 'bass', [26, 31, 36, 41]),
  preset('b4-cs-standard', 'C♯ Standard', 'bass', [25, 30, 35, 40]),
  preset('b4-c-standard', 'C Standard', 'bass', [24, 29, 34, 39]),
  preset('b4-bead', 'BEAD / B Standard', 'bass', [23, 28, 33, 38]),
  preset('b4-drop-d', 'Drop D', 'bass', [26, 33, 38, 43]),
  preset('b4-drop-cs', 'Drop C♯', 'bass', [25, 32, 37, 42]),
  preset('b4-drop-c', 'Drop C', 'bass', [24, 31, 36, 41]),
  preset('b4-drop-b', 'Drop B', 'bass', [23, 30, 35, 40]),
  preset('b4-drop-a', 'Drop A', 'bass', [21, 28, 33, 38]),

  preset('b5-b-standard', 'B Standard', 'bass', [23, 28, 33, 38, 43]),
  preset('b5-bb-standard', 'B♭ Standard', 'bass', [22, 27, 32, 37, 42]),
  preset('b5-a-standard', 'A Standard', 'bass', [21, 26, 31, 36, 41]),
  preset('b5-drop-a', 'Drop A', 'bass', [21, 28, 33, 38, 43]),
  preset('b5-drop-ab', 'Drop A♭', 'bass', [20, 27, 32, 37, 42]),
  preset('b5-drop-g', 'Drop G', 'bass', [19, 26, 31, 36, 41]),

  preset('b6-b-standard', 'B Standard', 'bass', [23, 28, 33, 38, 43, 48]),
  preset('b6-drop-a', 'Drop A', 'bass', [21, 28, 33, 38, 43, 48])
] as const

export interface InstrumentOption {
  key: string
  label: string
  family: 'guitar' | 'bass'
  stringCount: number
}

export const INSTRUMENTS: readonly InstrumentOption[] = [
  { key: 'guitar-6', label: 'Гитара · 6 струн', family: 'guitar', stringCount: 6 },
  { key: 'guitar-7', label: 'Гитара · 7 струн', family: 'guitar', stringCount: 7 },
  { key: 'guitar-8', label: 'Гитара · 8 струн', family: 'guitar', stringCount: 8 },
  { key: 'bass-4', label: 'Бас · 4 струны', family: 'bass', stringCount: 4 },
  { key: 'bass-5', label: 'Бас · 5 струн', family: 'bass', stringCount: 5 },
  { key: 'bass-6', label: 'Бас · 6 струн', family: 'bass', stringCount: 6 }
] as const

export function isValidTuningStrings(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.length <= 9 &&
    value.every(
      (midi, index) =>
        Number.isInteger(midi) &&
        midi >= 12 &&
        midi <= 88 &&
        (index === 0 || midi > value[index - 1]!)
    )
  )
}

export function tuningsForInstrument(instrumentKey: string): readonly TuningPreset[] {
  const instrument = INSTRUMENTS.find((item) => item.key === instrumentKey)
  if (!instrument) return []
  return BUILT_IN_TUNINGS.filter(
    (tuning) => tuning.family === instrument.family && tuning.stringCount === instrument.stringCount
  )
}

export function findTuning(id: string): TuningPreset | undefined {
  return BUILT_IN_TUNINGS.find((tuning) => tuning.id === id)
}
