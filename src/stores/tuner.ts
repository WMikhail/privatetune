import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  idleGuidedSession,
  isGuidedSessionActive,
  startGuidedSession as createGuidedSession,
  updateGuidedSession
} from '@/domain/guided-session'
import type { GuidedSessionEvent } from '@/domain/guided-session'
import { INSTRUMENTS, tuningsForInstrument } from '@/domain/tunings'
import type {
  CustomTuning,
  InterfaceMode,
  MicrophoneStatus,
  PitchMeasurement,
  TunerMode,
  TunerReading,
  TunerSettings
} from '@/domain/types'
import {
  DEFAULT_SETTINGS,
  loadPersistentState,
  saveCustomTunings,
  saveSettings,
  validateCustomTuning
} from './persistence'

export const useTunerStore = defineStore('tuner', () => {
  const persisted = loadPersistentState()
  const settings = ref<TunerSettings>(persisted.settings)
  const customTunings = ref<CustomTuning[]>(persisted.customTunings)
  const status = ref<MicrophoneStatus>('idle')
  const reading = ref<TunerReading | null>(null)
  const inputLevel = ref(0)
  const audioInputs = ref<MediaDeviceInfo[]>([])
  const guidedSession = ref(idleGuidedSession())
  let sessionReturnSelection: { mode: TunerMode; guidedStringIndex: number } | null = null

  const instrument = computed(() =>
    INSTRUMENTS.find((item) => item.key === settings.value.instrumentKey)
  )
  const availableTunings = computed(() => {
    if (settings.value.instrumentKey === 'custom') return customTunings.value
    return tuningsForInstrument(settings.value.instrumentKey)
  })
  const tuning = computed(
    () =>
      availableTunings.value.find((item) => item.id === settings.value.tuningId) ??
      availableTunings.value[0]
  )
  const guidedSessionActive = computed(() => isGuidedSessionActive(guidedSession.value))

  function restoreSessionSelection(): void {
    if (!sessionReturnSelection) return
    settings.value.mode = sessionReturnSelection.mode
    settings.value.guidedStringIndex = sessionReturnSelection.guidedStringIndex
    sessionReturnSelection = null
  }

  function beginGuidedSession(): boolean {
    const stringCount = tuning.value?.strings.length ?? 0
    if (stringCount === 0) return false
    if (!guidedSessionActive.value) {
      sessionReturnSelection = {
        mode: settings.value.mode,
        guidedStringIndex: settings.value.guidedStringIndex
      }
    }
    guidedSession.value = createGuidedSession(stringCount)
    settings.value.mode = 'guided'
    settings.value.guidedStringIndex = 0
    return true
  }

  function consumeGuidedSessionReading(value: TunerReading | null): GuidedSessionEvent | null {
    if (!guidedSessionActive.value) return null
    const update = updateGuidedSession(guidedSession.value, value)
    guidedSession.value = update.state
    if (isGuidedSessionActive(update.state)) {
      settings.value.guidedStringIndex = update.state.currentIndex
    } else if (update.state.phase === 'complete') {
      restoreSessionSelection()
    }
    return update.event
  }

  function cancelGuidedSession(): void {
    restoreSessionSelection()
    guidedSession.value = idleGuidedSession()
  }

  function dismissGuidedSession(): void {
    guidedSession.value = idleGuidedSession()
  }

  function setInstrument(key: string): void {
    if (guidedSession.value.phase !== 'idle') cancelGuidedSession()
    settings.value.instrumentKey = key
    const first = key === 'custom' ? customTunings.value[0] : tuningsForInstrument(key)[0]
    if (first) settings.value.tuningId = first.id
    settings.value.guidedStringIndex = 0
  }

  function setInterfaceMode(mode: InterfaceMode): void {
    settings.value.interfaceMode = mode
    if (mode !== 'standard') return
    if (sessionReturnSelection) sessionReturnSelection.mode = 'automatic'
    else settings.value.mode = 'automatic'
  }

  function selectString(index: number): void {
    if (
      guidedSessionActive.value ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= (tuning.value?.strings.length ?? 0)
    ) {
      return
    }
    settings.value.guidedStringIndex = index
    settings.value.mode = 'guided'
  }

  function adjustNoiseGate(delta: number): void {
    if (!Number.isFinite(delta)) return
    settings.value.noiseGateDb = Math.min(-30, Math.max(-70, settings.value.noiseGateDb + delta))
  }

  function addCustomTuning(
    input: Omit<CustomTuning, 'id' | 'custom' | 'createdAt' | 'updatedAt'>
  ): CustomTuning {
    const now = Date.now()
    const tuning: CustomTuning = {
      ...input,
      id: `custom-${now}-${Math.random().toString(36).slice(2, 7)}`,
      custom: true,
      createdAt: now,
      updatedAt: now
    }
    if (!validateCustomTuning(tuning)) throw new Error('Некорректный пользовательский строй')
    customTunings.value.push(tuning)
    return tuning
  }

  function updateCustomTuning(updated: CustomTuning): void {
    if (!validateCustomTuning(updated)) throw new Error('Некорректный пользовательский строй')
    const index = customTunings.value.findIndex((item) => item.id === updated.id)
    if (index < 0) throw new Error('Строй не найден')
    customTunings.value[index] = { ...updated, updatedAt: Date.now() }
  }

  function duplicateCustomTuning(id: string): CustomTuning | null {
    const source = customTunings.value.find((item) => item.id === id)
    if (!source) return null
    return addCustomTuning({
      name: `${source.name} — копия`,
      family: 'custom',
      stringCount: source.stringCount,
      strings: [...source.strings]
    })
  }

  function removeCustomTuning(id: string): void {
    customTunings.value = customTunings.value.filter((item) => item.id !== id)
    if (settings.value.tuningId === id) {
      const next = customTunings.value[0]
      if (next) settings.value.tuningId = next.id
      else setInstrument('guitar-6')
    }
  }

  function resetSettings(): void {
    if (guidedSession.value.phase !== 'idle') cancelGuidedSession()
    settings.value = { ...DEFAULT_SETTINGS }
  }

  watch(
    tuning,
    (value, previous) => {
      const targetsChanged =
        previous &&
        (value?.id !== previous.id || value.strings.join(',') !== previous.strings.join(','))
      if (guidedSession.value.phase !== 'idle' && targetsChanged) {
        cancelGuidedSession()
      }
      if (!value) return
      settings.value.guidedStringIndex = Math.min(
        Math.max(settings.value.guidedStringIndex, 0),
        value.strings.length - 1
      )
    },
    { immediate: true }
  )
  watch(settings, (value) => saveSettings(value), { deep: true })
  watch(customTunings, (value) => saveCustomTunings(value), { deep: true })

  return {
    settings,
    customTunings,
    status,
    reading,
    inputLevel,
    audioInputs,
    instrument,
    availableTunings,
    tuning,
    guidedSession,
    guidedSessionActive,
    setInstrument,
    setInterfaceMode,
    selectString,
    adjustNoiseGate,
    beginGuidedSession,
    consumeGuidedSessionReading,
    cancelGuidedSession,
    dismissGuidedSession,
    addCustomTuning,
    updateCustomTuning,
    duplicateCustomTuning,
    removeCustomTuning,
    resetSettings
  }
})

export type { PitchMeasurement }
