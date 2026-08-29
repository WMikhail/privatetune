import { describe, expect, it } from 'vitest'
import type { CustomTuning } from '@/domain/types'
import {
  CUSTOM_TUNINGS_KEY,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadPersistentState,
  loadCustomTunings,
  loadSettings,
  saveCustomTunings,
  saveSettings
} from '../persistence'

describe('versioned local storage', () => {
  it('round-trips settings', () => {
    const settings = { ...DEFAULT_SETTINGS, a4: 432, accidental: 'flat' as const }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it('safely recovers from corrupt, unknown-version and invalid settings', () => {
    localStorage.setItem(SETTINGS_KEY, '{not-json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 99, data: DEFAULT_SETTINGS }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, data: { a4: 999 } }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('repairs one invalid setting without discarding valid preferences', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        data: { ...DEFAULT_SETTINGS, a4: 999, accidental: 'flat', wakeLock: true }
      })
    )

    expect(loadSettings()).toMatchObject({ a4: 440, accidental: 'flat', wakeLock: true })
  })

  it('round-trips validated custom tunings', () => {
    const tuning: CustomTuning = {
      id: 'custom-test',
      name: 'Test Drop',
      family: 'custom',
      stringCount: 4,
      strings: [28, 33, 38, 43],
      custom: true,
      createdAt: 1,
      updatedAt: 1
    }
    saveCustomTunings([tuning])
    expect(loadCustomTunings()).toEqual([tuning])
  })

  it('rejects malformed custom tuning arrays atomically', () => {
    localStorage.setItem(
      CUSTOM_TUNINGS_KEY,
      JSON.stringify({ version: 1, data: [{ id: 'bad', strings: [1] }] })
    )
    expect(loadCustomTunings()).toEqual([])
  })

  it('rejects custom strings that are not ordered from thickest to thinnest', () => {
    localStorage.setItem(
      CUSTOM_TUNINGS_KEY,
      JSON.stringify({
        version: 1,
        data: [
          {
            id: 'custom-unordered',
            name: 'Broken order',
            family: 'custom',
            stringCount: 4,
            strings: [40, 38, 45, 50],
            custom: true,
            createdAt: 1,
            updatedAt: 1
          }
        ]
      })
    )

    expect(loadCustomTunings()).toEqual([])
  })

  it('ignores unavailable or full storage when saving', () => {
    const storage = {
      setItem: () => {
        throw new DOMException('Blocked', 'QuotaExceededError')
      }
    } as unknown as Storage

    expect(() => saveSettings(DEFAULT_SETTINGS, storage)).not.toThrow()
    expect(() => saveCustomTunings([], storage)).not.toThrow()
  })

  it('repairs cross-record tuning references and guided indices', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        data: {
          ...DEFAULT_SETTINGS,
          instrumentKey: 'bass-5',
          tuningId: 'g6-drop-c',
          guidedStringIndex: 99
        }
      })
    )

    expect(loadPersistentState().settings).toMatchObject({
      instrumentKey: 'bass-5',
      tuningId: 'b5-b-standard',
      guidedStringIndex: 4
    })
  })

  it('upgrades existing settings to the standard interface without losing calibration', () => {
    const { interfaceMode, showGuidedSession, showStrings, showSignalPanel, ...legacySettings } = {
      ...DEFAULT_SETTINGS,
      tuningId: 'g6-drop-c',
      mode: 'chromatic' as const,
      a4: 432
    }
    void interfaceMode
    void showGuidedSession
    void showStrings
    void showSignalPanel
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, data: legacySettings }))

    expect(loadPersistentState().settings).toMatchObject({
      interfaceMode: 'standard',
      mode: 'automatic',
      tuningId: 'g6-drop-c',
      a4: 432,
      showGuidedSession: true,
      showStrings: false,
      showSignalPanel: false
    })
  })

  it('falls back to a complete default when the selected custom catalog is unavailable', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        data: { ...DEFAULT_SETTINGS, instrumentKey: 'custom', tuningId: 'custom-missing' }
      })
    )

    expect(loadPersistentState().settings).toEqual(DEFAULT_SETTINGS)
  })
})
