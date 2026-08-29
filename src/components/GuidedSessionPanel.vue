<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, ListChecks, RotateCcw, X } from '@lucide/vue'
import type { GuidedSessionPhase } from '@/domain/guided-session'

const props = defineProps<{
  phase: GuidedSessionPhase
  stringCount: number
  currentIndex: number
  completedCount: number
  stableProgress: number
}>()

const emit = defineEmits<{ cancel: []; restart: []; dismiss: [] }>()

const active = computed(() => props.phase === 'tuning' || props.phase === 'verification')
const currentStringNumber = computed(() => Math.max(1, props.stringCount - props.currentIndex))
const progressPercent = computed(() => Math.round(props.stableProgress * 100))
const passLabel = computed(() => (props.phase === 'tuning' ? 'ПРОХОД 1 ИЗ 2' : 'КОНТРОЛЬ 2 ИЗ 2'))
const title = computed(() =>
  props.phase === 'verification'
    ? `Проверьте струну ${currentStringNumber.value}`
    : `Настройте струну ${currentStringNumber.value}`
)
</script>

<template>
  <section
    v-if="active"
    class="guided-session-card"
    :data-phase="phase"
    aria-labelledby="guided-session-title"
  >
    <div class="guided-session-card__icon" aria-hidden="true"><ListChecks :size="20" /></div>
    <div class="guided-session-card__body">
      <span class="guided-session-card__kicker">{{ passLabel }}</span>
      <strong id="guided-session-title">{{ title }}</strong>
      <small>Играйте открытую струну, пока шкала подтверждения не заполнится.</small>
      <div
        class="guided-stability"
        role="progressbar"
        aria-label="Стабильность настройки текущей струны"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progressPercent"
      >
        <i :style="{ width: `${progressPercent}%` }" />
      </div>
      <div class="guided-session-card__meta">
        <span>Готово {{ completedCount }} из {{ stringCount }}</span>
        <span>{{ progressPercent }}% стабильно</span>
      </div>
    </div>
    <button
      class="guided-session-cancel"
      type="button"
      aria-label="Отменить пошаговую настройку"
      @click="emit('cancel')"
    >
      <X :size="18" />
    </button>
  </section>

  <section
    v-else-if="phase === 'complete'"
    class="guided-session-card guided-session-card--complete"
    aria-live="polite"
  >
    <div class="guided-session-card__icon" aria-hidden="true"><CheckCircle2 :size="22" /></div>
    <div class="guided-session-card__body">
      <span class="guided-session-card__kicker">СЕАНС ЗАВЕРШЁН</span>
      <strong>Все струны настроены</strong>
      <small>Основной проход и контрольная проверка успешно завершены.</small>
      <div class="guided-session-card__actions">
        <button class="button" type="button" @click="emit('restart')">
          <RotateCcw :size="16" /> Ещё раз
        </button>
        <button class="button ghost" type="button" @click="emit('dismiss')">Закрыть</button>
      </div>
    </div>
  </section>
</template>
