import { computed, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { TunerEngine } from '@/audio/tuner-engine'
import type { TunerEngineConfig, TunerEngineEvents } from '@/audio/tuner-engine'
import { useTunerStore } from '@/stores/tuner'

type RuntimeEngine = Pick<TunerEngine, 'start' | 'stop' | 'updateConfig'>

export function useTunerRuntime(isActive: Readonly<Ref<boolean>>) {
  const store = useTunerStore()
  const { settings, status, reading, inputLevel, audioInputs, tuning, guidedSessionActive } =
    storeToRefs(store)
  let engine: RuntimeEngine | null = null
  let wakeLock: WakeLockSentinel | null = null
  let wakeLockRevision = 0

  const config = computed<TunerEngineConfig>(() => ({
    mode: settings.value.mode,
    strings: tuning.value?.strings ?? [],
    guidedStringIndex: settings.value.guidedStringIndex,
    a4: settings.value.a4,
    gateDb: settings.value.noiseGateDb,
    inputDeviceId: settings.value.inputDeviceId
  }))

  function createEngine(): RuntimeEngine {
    const events: TunerEngineEvents = {
      onStatus: (value) => (status.value = value),
      onReading: (value) => (reading.value = value),
      onLevel: (value) => (inputLevel.value = value),
      onDevices: (value) => (audioInputs.value = value)
    }
    return (
      window.__PRIVATETUNE_TEST_ENGINE_FACTORY__?.(events) ?? new TunerEngine(config.value, events)
    )
  }

  async function releaseHeldWakeLock(): Promise<void> {
    const lock = wakeLock
    wakeLock = null
    if (lock) await lock.release()
  }

  async function releaseWakeLock(): Promise<void> {
    wakeLockRevision += 1
    await releaseHeldWakeLock()
  }

  async function syncWakeLock(): Promise<void> {
    const revision = ++wakeLockRevision
    const manager = navigator.wakeLock
    if (!settings.value.wakeLock || !isActive.value || !manager) {
      await releaseHeldWakeLock()
      return
    }
    try {
      const next = await manager.request('screen')
      if (revision !== wakeLockRevision || !settings.value.wakeLock || !isActive.value) {
        await next.release()
        return
      }
      await releaseHeldWakeLock()
      wakeLock = next
    } catch {
      if (revision === wakeLockRevision) wakeLock = null
    }
  }

  async function start(): Promise<void> {
    engine ??= createEngine()
    engine.updateConfig(config.value)
    await engine.start()
    if (status.value === 'missing' && settings.value.inputDeviceId) {
      settings.value.inputDeviceId = ''
      engine.updateConfig(config.value)
      await engine.start()
    }
  }

  async function stop(): Promise<void> {
    if (guidedSessionActive.value) store.cancelGuidedSession()
    await engine?.stop()
    await releaseWakeLock()
  }

  function handleVisibility(): void {
    if (document.visibilityState === 'visible') void syncWakeLock()
  }

  watch(config, (value) => engine?.updateConfig(value), { deep: true })
  watch(isActive, () => void syncWakeLock())
  watch(
    () => settings.value.wakeLock,
    () => void syncWakeLock()
  )
  watch(
    () => settings.value.inputDeviceId,
    async (value, previous) => {
      if (value === previous || !isActive.value) return
      await engine?.stop()
      await start()
    }
  )

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', stop)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pagehide', stop)
    void stop()
  })

  return { start, stop }
}
