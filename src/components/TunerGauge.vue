<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Check, Minus } from '@lucide/vue'
import { midiToNote } from '@/domain/note-math'
import type { AccidentalStyle, TunerReading } from '@/domain/types'

const props = defineProps<{
  reading: TunerReading | null
  accidental: AccidentalStyle
  detailed: boolean
  active: boolean
  stringNumber: number | null
}>()

const note = computed(() =>
  props.reading ? midiToNote(props.reading.noteMidi, props.accidental) : null
)
const status = computed(() => {
  if (!props.reading)
    return {
      label: props.active ? 'Ожидание сигнала' : 'Готов к настройке',
      direction: props.active ? 'Сыграйте струну' : 'Микрофон выключен',
      icon: Minus
    }
  if (props.reading.state === 'in-tune')
    return { label: 'Точно', direction: 'Настроено', icon: Check }
  if (props.reading.cents < 0)
    return {
      label: props.reading.state === 'close' ? 'Почти настроено' : 'Ниже цели',
      direction: 'Натянуть',
      icon: ArrowUp
    }
  return {
    label: props.reading.state === 'close' ? 'Почти настроено' : 'Выше цели',
    direction: 'Ослабить',
    icon: ArrowDown
  }
})
const gaugeState = computed(() => props.reading?.state ?? 'idle')
const eyebrow = computed(() => {
  if (props.detailed) return 'Текущая нота'
  if (props.reading && props.stringNumber !== null) return `Струна ${props.stringNumber} · открытая`
  return 'Сыграйте открытую струну'
})
const needleLeft = computed(() => {
  if (props.reading?.state === 'in-tune') return '50%'
  return `${Math.max(-50, Math.min(50, props.reading?.cents ?? 0)) + 50}%`
})
const centsLabel = computed(() => {
  if (!props.reading) return '± 0.0'
  return `${props.reading.cents >= 0 ? '+' : '−'} ${Math.abs(props.reading.cents).toFixed(1)}`
})
</script>

<template>
  <section class="gauge" :data-state="gaugeState">
    <p class="sr-only" aria-live="polite" aria-atomic="true">
      {{ note ? `${note.name}${note.octave}, ${status.direction}` : status.direction }}
    </p>
    <div v-if="!active" class="gauge__idle">
      <strong>Готов к настройке</strong>
      <small>Сыграйте любую открытую струну.</small>
    </div>
    <template v-else>
      <div class="gauge__eyebrow">{{ eyebrow }}</div>
      <div class="gauge__note-wrap">
        <span class="gauge__note" :class="{ 'gauge__note--placeholder': !note }">{{
          note?.name ?? '…'
        }}</span>
        <span class="gauge__octave">{{ note?.octave ?? '' }}</span>
      </div>
      <div v-if="detailed" class="gauge__frequency">
        {{ reading ? reading.frequency.toFixed(2) : '—' }} <span>Hz</span>
      </div>

      <div class="meter" aria-label="Отклонение от цели от минус 50 до плюс 50 центов">
        <div v-if="detailed" class="meter__labels">
          <span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span>
        </div>
        <div class="meter__rail">
          <i v-for="tick in 41" :key="tick" :class="{ major: (tick - 1) % 10 === 0 }" />
          <div class="meter__sweet-spot" aria-hidden="true" />
          <div class="meter__needle" :style="{ left: needleLeft }" aria-hidden="true" />
        </div>
      </div>

      <div class="gauge__readout" :class="{ 'gauge__readout--simple': !detailed }">
        <div v-if="detailed" class="cents">
          <strong>{{ centsLabel }}</strong
          ><span>cents</span>
        </div>
        <div class="tune-status">
          <component :is="status.icon" :size="21" stroke-width="2.2" aria-hidden="true" />
          <div>
            <strong>{{ status.direction }}</strong
            ><span>{{ status.label }}</span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
