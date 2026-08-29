import type { CustomTuning, TunerSettings } from '@/domain/types'
import { BUILT_IN_TUNINGS, isValidTuningStrings, tuningsForInstrument } from '@/domain/tunings'

export const SETTINGS_KEY = 'privatetune:settings'
export const CUSTOM_TUNINGS_KEY = 'privatetune:custom-tunings'
export const STORAGE_VERSION = 1

export const DEFAULT_SETTINGS: TunerSettings = {
  instrumentKey: 'guitar-6',
  tuningId: 'g6-e-standard',
  interfaceMode: 'standard',
  mode: 'automatic',
  guidedStringIndex: 0,
  showGuidedSession: true,
  showStrings: false,
  showSignalPanel: false,
  a4: 440,
  accidental: 'sharp',
  noiseGateDb: -55,
  inputDeviceId: '',
  wakeLock: false
}

interface Envelope<T> {
  version: number
  data: T
}

function sanitizeSettings(value: unknown): TunerSettings {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    instrumentKey:
      typeof item.instrumentKey === 'string' ? item.instrumentKey : DEFAULT_SETTINGS.instrumentKey,
    tuningId: typeof item.tuningId === 'string' ? item.tuningId : DEFAULT_SETTINGS.tuningId,
    interfaceMode:
      item.interfaceMode === 'professional' || item.interfaceMode === 'standard'
        ? item.interfaceMode
        : DEFAULT_SETTINGS.interfaceMode,
    mode:
      item.mode === 'chromatic' || item.mode === 'automatic' || item.mode === 'guided'
        ? item.mode
        : DEFAULT_SETTINGS.mode,
    guidedStringIndex: Number.isInteger(item.guidedStringIndex)
      ? Number(item.guidedStringIndex)
      : DEFAULT_SETTINGS.guidedStringIndex,
    showGuidedSession:
      typeof item.showGuidedSession === 'boolean'
        ? item.showGuidedSession
        : DEFAULT_SETTINGS.showGuidedSession,
    showStrings:
      typeof item.showStrings === 'boolean' ? item.showStrings : DEFAULT_SETTINGS.showStrings,
    showSignalPanel:
      typeof item.showSignalPanel === 'boolean'
        ? item.showSignalPanel
        : DEFAULT_SETTINGS.showSignalPanel,
    a4:
      typeof item.a4 === 'number' && item.a4 >= 430 && item.a4 <= 450
        ? item.a4
        : DEFAULT_SETTINGS.a4,
    accidental:
      item.accidental === 'flat' || item.accidental === 'sharp'
        ? item.accidental
        : DEFAULT_SETTINGS.accidental,
    noiseGateDb:
      typeof item.noiseGateDb === 'number' && item.noiseGateDb >= -80 && item.noiseGateDb <= -20
        ? item.noiseGateDb
        : DEFAULT_SETTINGS.noiseGateDb,
    inputDeviceId:
      typeof item.inputDeviceId === 'string' ? item.inputDeviceId : DEFAULT_SETTINGS.inputDeviceId,
    wakeLock: typeof item.wakeLock === 'boolean' ? item.wakeLock : DEFAULT_SETTINGS.wakeLock
  }
}

export function validateCustomTuning(value: unknown): value is CustomTuning {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.family === 'custom' &&
    item.custom === true &&
    Number.isInteger(item.stringCount) &&
    isValidTuningStrings(item.strings) &&
    item.strings.length === item.stringCount &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}

function parseEnvelope(raw: string | null): unknown {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Envelope<unknown>>
    if (parsed.version !== STORAGE_VERSION) return null
    return parsed.data
  } catch {
    return null
  }
}

function readItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeItem(storage: Storage, key: string, data: unknown): void {
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, data }))
  } catch {
    // Storage can be blocked or full; settings must not break the tuner.
  }
}

export function loadSettings(storage: Storage = localStorage): TunerSettings {
  return sanitizeSettings(parseEnvelope(readItem(storage, SETTINGS_KEY)))
}

export function saveSettings(settings: TunerSettings, storage: Storage = localStorage): void {
  writeItem(storage, SETTINGS_KEY, settings)
}

function isCustomTunings(value: unknown): value is CustomTuning[] {
  if (!Array.isArray(value) || !value.every(validateCustomTuning)) return false
  const builtInIds = new Set(BUILT_IN_TUNINGS.map((tuning) => tuning.id))
  const customIds = value.map((tuning) => tuning.id)
  return (
    new Set(customIds).size === customIds.length && customIds.every((id) => !builtInIds.has(id))
  )
}

export function loadCustomTunings(storage: Storage = localStorage): CustomTuning[] {
  const value = parseEnvelope(readItem(storage, CUSTOM_TUNINGS_KEY))
  return isCustomTunings(value) ? value : []
}

export function saveCustomTunings(tunings: CustomTuning[], storage: Storage = localStorage): void {
  writeItem(storage, CUSTOM_TUNINGS_KEY, tunings)
}

export function normalizeSettings(
  settings: TunerSettings,
  customTunings: readonly CustomTuning[]
): TunerSettings {
  const normalized = { ...DEFAULT_SETTINGS, ...settings }
  const available =
    normalized.instrumentKey === 'custom'
      ? customTunings
      : tuningsForInstrument(normalized.instrumentKey)

  if (available.length === 0) return { ...DEFAULT_SETTINGS }

  const defaultForInstrument =
    normalized.instrumentKey === DEFAULT_SETTINGS.instrumentKey
      ? available.find((tuning) => tuning.id === DEFAULT_SETTINGS.tuningId)
      : undefined
  const tuning =
    available.find((candidate) => candidate.id === normalized.tuningId) ??
    defaultForInstrument ??
    available[0]!
  const guidedStringIndex = Math.min(
    Math.max(normalized.guidedStringIndex, 0),
    tuning.strings.length - 1
  )

  return {
    ...normalized,
    tuningId: tuning.id,
    guidedStringIndex,
    mode: normalized.interfaceMode === 'standard' ? 'automatic' : normalized.mode
  }
}

export function loadPersistentState(storage: Storage = localStorage): {
  settings: TunerSettings
  customTunings: CustomTuning[]
} {
  const customTunings = loadCustomTunings(storage)
  return {
    settings: normalizeSettings(loadSettings(storage), customTunings),
    customTunings
  }
}
