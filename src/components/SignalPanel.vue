<script setup lang="ts">
import { computed } from 'vue'
import { Activity, Radio } from '@lucide/vue'
import { amplitudeToDb } from '@/audio/signal-gate'

const props = defineProps<{ rms: number; clarity: number }>()
const levelPercent = computed(() =>
  Math.max(0, Math.min(100, ((amplitudeToDb(props.rms) + 70) / 60) * 100))
)
const clarityPercent = computed(() => Math.round(Math.max(0, Math.min(1, props.clarity)) * 100))
</script>

<template>
  <section class="signal-panel" aria-label="Качество входного сигнала">
    <div class="signal-row">
      <span><Radio :size="17" aria-hidden="true" /> Вход</span
      ><strong>{{ Math.round(levelPercent) }}%</strong>
    </div>
    <div class="progress-track"><i :style="{ width: `${levelPercent}%` }" /></div>
    <div class="signal-row clarity-row">
      <span><Activity :size="17" aria-hidden="true" /> Стабильность</span
      ><strong>{{ clarityPercent }}%</strong>
    </div>
    <div class="progress-track"><i :style="{ width: `${clarityPercent}%` }" /></div>
  </section>
</template>
