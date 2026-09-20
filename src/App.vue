<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AudioLines, CircleAlert, ListChecks, Mic, ShieldCheck, Square } from '@lucide/vue'
import type { GuidedSessionEvent } from '@/domain/guided-session'
import { INSTRUMENTS } from '@/domain/tunings'
import type { MicrophoneStatus } from '@/domain/types'
import { useTunerRuntime } from '@/composables/use-tuner-runtime'
import { useTunerStore } from '@/stores/tuner'
import SettingsDialog from '@/components/SettingsDialog.vue'
import GuidedSessionPanel from '@/components/GuidedSessionPanel.vue'
import SignalPanel from '@/components/SignalPanel.vue'
import StringStrip from '@/components/StringStrip.vue'
import TunerGauge from '@/components/TunerGauge.vue'
import UpdatePrompt from '@/components/UpdatePrompt.vue'

type StatusAction = 'settings' | 'lower-gate' | 'raise-gate'
interface StatusUi {
  title: string
  text: string
  active: boolean
  callout?: boolean
  error?: boolean
  startLabel?: string
  action?: StatusAction
  actionLabel?: string
}

const STATUS_UI: Record<MicrophoneStatus, StatusUi> = {
  idle: {
    title: 'Готов к настройке',
    text: 'Начните настройку и сыграйте одну открытую струну.',
    active: false,
    startLabel: 'Начать настройку'
  },
  requesting: {
    title: 'Жду разрешения',
    text: 'Выберите микрофон или вход аудиоинтерфейса в браузере.',
    active: false,
    startLabel: 'Подключение…'
  },
  running: {
    title: 'Слушаю',
    text: 'Играйте одну струну ровно и дайте показанию стабилизироваться.',
    active: true
  },
  denied: {
    title: 'Доступ отклонён',
    text: 'Разрешите микрофон для этого сайта в настройках браузера.',
    active: false,
    callout: true,
    error: true,
    startLabel: 'Повторить запрос'
  },
  missing: {
    title: 'Микрофон не найден',
    text: 'Подключите микрофон или аудиоинтерфейс и попробуйте снова.',
    active: false,
    callout: true,
    error: true,
    startLabel: 'Проверить устройства'
  },
  unsupported: {
    title: 'API не поддерживается',
    text: 'Откройте приложение в современном браузере по HTTPS или localhost.',
    active: false,
    callout: true,
    error: true,
    startLabel: 'Нужен совместимый браузер'
  },
  'no-signal': {
    title: 'Нет сигнала',
    text: 'Сыграйте струну ближе к микрофону или проверьте выбранный вход.',
    active: true,
    callout: true,
    action: 'settings',
    actionLabel: 'Выбрать вход'
  },
  'weak-signal': {
    title: 'Слабый сигнал',
    text: 'Сыграйте громче или уменьшите порог шума.',
    active: true,
    callout: true,
    action: 'lower-gate',
    actionLabel: 'Снизить порог'
  },
  'noisy-signal': {
    title: 'Нестабильный сигнал',
    text: 'Заглушите соседние струны и уменьшите фоновый шум.',
    active: true,
    callout: true,
    action: 'raise-gate',
    actionLabel: 'Поднять порог'
  },
  error: {
    title: 'Не удалось запустить вход',
    text: 'Проверьте разрешение и занятость аудиоустройства.',
    active: false,
    callout: true,
    error: true,
    startLabel: 'Повторить запуск'
  }
}

const store = useTunerStore()
const {
  settings,
  status,
  reading,
  inputLevel,
  availableTunings,
  tuning,
  guidedSession,
  guidedSessionActive
} = storeToRefs(store)
const settingsOpen = ref(false)
const mobileControlsOpen = ref(false)
const statusUi = computed(() => STATUS_UI[status.value])
const isActive = computed(() => statusUi.value.active)
const isBusy = computed(() => status.value === 'requesting')
const isProfessional = computed(() => settings.value.interfaceMode === 'professional')
const showRightPanel = computed(() => settings.value.showStrings || settings.value.showSignalPanel)
const { start, stop } = useTunerRuntime(isActive)

const instrumentLabel = computed(
  () =>
    INSTRUMENTS.find((item) => item.key === settings.value.instrumentKey)?.label ?? 'Мой инструмент'
)
const detectedStringNumber = computed(() => {
  const index = reading.value?.stringIndex
  return index === null || index === undefined ? null : (tuning.value?.stringCount ?? 0) - index
})
const guidedResults = computed(() =>
  guidedSession.value.phase === 'tuning' ? guidedSession.value.tuned : guidedSession.value.verified
)
const guidedCompletedCount = computed(() => guidedResults.value.filter(Boolean).length)
const completedStringIndices = computed(() =>
  guidedResults.value.flatMap((done, index) => (done ? [index] : []))
)
const targetLabel = computed(() => {
  if (settings.value.mode === 'chromatic') return 'Ближайшая нота'
  if (settings.value.mode === 'guided')
    return `Струна ${(tuning.value?.stringCount ?? 0) - settings.value.guidedStringIndex}`
  return 'Автовыбор струны'
})

async function beginGuidedSession(): Promise<void> {
  if (!store.beginGuidedSession()) return
  if (!isActive.value) {
    await start()
    if (!isActive.value) store.cancelGuidedSession()
  }
}

function sessionFeedback(event: GuidedSessionEvent): void {
  if (!navigator.vibrate) return
  navigator.vibrate(event === 'session-complete' ? [60, 45, 100] : 45)
}

function handleStatusAction(): void {
  if (statusUi.value.action === 'settings') settingsOpen.value = true
  if (statusUi.value.action === 'lower-gate') store.adjustNoiseGate(-5)
  if (statusUi.value.action === 'raise-gate') store.adjustNoiseGate(5)
}

function changeInstrument(event: Event): void {
  store.setInstrument((event.target as HTMLSelectElement).value)
}

watch(reading, (value) => {
  const event = store.consumeGuidedSessionReading(value)
  if (event) sessionFeedback(event)
})
watch(status, (value) => {
  if (guidedSessionActive.value && STATUS_UI[value].error) store.cancelGuidedSession()
})
watch(isActive, (value) => {
  if (value) mobileControlsOpen.value = false
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#main" aria-label="PrivateTune, перейти к тюнеру"
        ><span class="brand-mark"><AudioLines :size="22" /></span
        ><span><strong>PrivateTune</strong><small>PRIVATE ON-DEVICE TUNER</small></span></a
      >
      <div class="topbar-actions">
        <span class="interface-badge">{{ isProfessional ? 'Профи' : 'Стандарт' }}</span
        ><span class="local-badge"><ShieldCheck :size="15" /> 100% локально</span
        ><SettingsDialog v-model:open="settingsOpen" />
      </div>
    </header>

    <main
      id="main"
      class="tuner-layout"
      :class="{
        'tuner-layout--simple': !showRightPanel,
        'tuner-layout--with-panel': showRightPanel
      }"
    >
      <aside
        class="control-panel panel"
        :class="{ 'control-panel--collapsed': isActive && !mobileControlsOpen }"
      >
        <div class="panel-heading">
          <div>
            <span class="kicker">{{ isProfessional ? 'Точный контроль' : 'Параметры' }}</span>
            <h1>{{ isProfessional ? 'Точная настройка' : 'Инструмент и строй' }}</h1>
            <p v-if="isProfessional" class="panel-intro">
              Ручной выбор цели и подробные показатели.
            </p>
          </div>
        </div>
        <label class="field"
          ><span>Инструмент</span
          ><select
            :value="settings.instrumentKey"
            :disabled="guidedSessionActive"
            @change="changeInstrument"
          >
            <option v-for="item in INSTRUMENTS" :key="item.key" :value="item.key">
              {{ item.label }}
            </option>
            <option v-if="store.customTunings.length" value="custom">Мой инструмент</option>
          </select></label
        >
        <label class="field"
          ><span>Строй</span
          ><select v-model="settings.tuningId" :disabled="guidedSessionActive">
            <option v-for="item in availableTunings" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select></label
        >
        <fieldset v-if="isProfessional" class="mode-switch">
          <legend>Режим</legend>
          <label
            ><input
              v-model="settings.mode"
              type="radio"
              value="chromatic"
              :disabled="guidedSessionActive"
            /><span>Хроматика</span></label
          ><label
            ><input
              v-model="settings.mode"
              type="radio"
              value="automatic"
              :disabled="guidedSessionActive"
            /><span>Авто</span></label
          ><label
            ><input
              v-model="settings.mode"
              type="radio"
              value="guided"
              :disabled="guidedSessionActive"
            /><span>Струна</span></label
          >
        </fieldset>
        <div class="privacy-note">
          <ShieldCheck :size="18" aria-hidden="true" />
          <p>
            <strong>Звук остаётся на устройстве</strong
            ><span>Ничего не записывается и не отправляется.</span>
          </p>
        </div>
      </aside>

      <section class="center-stage" :class="{ 'center-stage--idle': !isActive }">
        <div class="mobile-selection">
          <span
            ><small>{{ instrumentLabel }}</small
            ><strong>{{ tuning?.name ?? '—' }}</strong></span
          ><button
            v-if="isActive"
            type="button"
            class="mobile-selection__change"
            @click="mobileControlsOpen = !mobileControlsOpen"
          >
            {{ mobileControlsOpen ? 'Скрыть' : 'Изменить' }}
          </button>
        </div>
        <div v-if="isProfessional" class="target-summary">
          <span
            >ЦЕЛЬ <strong>{{ targetLabel }}</strong></span
          ><small
            >A4 = {{ settings.a4 }} Hz ·
            {{ settings.accidental === 'sharp' ? 'диезы' : 'бемоли' }}</small
          >
        </div>
        <TunerGauge
          :reading="reading"
          :accidental="settings.accidental"
          :detailed="isProfessional"
          :active="isActive"
          :string-number="detectedStringNumber"
        />
        <GuidedSessionPanel
          :phase="guidedSession.phase"
          :string-count="guidedSession.stringCount"
          :current-index="guidedSession.currentIndex"
          :completed-count="guidedCompletedCount"
          :stable-progress="guidedSession.stableProgress"
          @cancel="store.cancelGuidedSession"
          @restart="beginGuidedSession"
          @dismiss="store.dismissGuidedSession"
        />
        <div v-if="statusUi.callout" class="status-callout" :data-status="status">
          <CircleAlert v-if="statusUi.error" :size="20" /><span
            ><strong>{{ statusUi.title }}</strong
            ><small>{{ statusUi.text }}</small
            ><small
              v-if="statusUi.action === 'lower-gate' || statusUi.action === 'raise-gate'"
              class="status-callout__detail"
              >Текущий порог: {{ settings.noiseGateDb }} dB</small
            ></span
          ><button
            v-if="statusUi.actionLabel"
            class="button compact status-callout__action"
            type="button"
            @click="handleStatusAction"
          >
            {{ statusUi.actionLabel }}
          </button>
        </div>
        <div v-if="!isActive" class="start-actions">
          <button
            class="button mic-button"
            type="button"
            :disabled="isBusy || status === 'unsupported'"
            @click="start"
          >
            <Mic :size="21" /> {{ statusUi.startLabel ?? 'Начать настройку' }}
          </button>
          <button
            v-if="settings.showGuidedSession && guidedSession.phase === 'idle' && !statusUi.error"
            class="button guided-session-launch"
            type="button"
            :disabled="isBusy"
            @click="beginGuidedSession"
          >
            <ListChecks :size="18" /> Настроить все струны
          </button>
        </div>
        <button
          v-else
          class="button stop-button"
          type="button"
          aria-label="Завершить настройку и выключить микрофон"
          @click="stop"
        >
          <Square :size="16" fill="currentColor" /> Завершить
        </button>
      </section>

      <aside v-if="showRightPanel" class="right-panel panel">
        <StringStrip
          v-if="settings.showStrings"
          :strings="tuning?.strings ?? []"
          :accidental="settings.accidental"
          :mode="settings.mode"
          :selected-index="settings.guidedStringIndex"
          :detected-index="reading?.stringIndex ?? null"
          :completed-indices="completedStringIndices"
          :session-active="guidedSessionActive"
          @select="store.selectString"
        />
        <SignalPanel
          v-if="settings.showSignalPanel"
          :rms="inputLevel"
          :clarity="reading?.clarity ?? 0"
        />
      </aside>
    </main>
    <UpdatePrompt />
  </div>
</template>
