<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { formatNote } from '@/domain/note-math'
import type { AccidentalStyle, TunerMode } from '@/domain/types'

const props = defineProps<{
  strings: readonly number[]
  accidental: AccidentalStyle
  mode: TunerMode
  selectedIndex: number
  detectedIndex: number | null
  completedIndices?: readonly number[]
  sessionActive?: boolean
}>()
const emit = defineEmits<{ select: [index: number] }>()

const selected = computed(() =>
  props.mode === 'guided' ? props.selectedIndex : props.detectedIndex
)

function select(index: number): void {
  if (!props.sessionActive) emit('select', index)
}
</script>

<template>
  <section class="strings-panel" aria-labelledby="strings-title">
    <div class="panel-heading">
      <div>
        <span class="kicker">СТРУНЫ</span>
        <h2 id="strings-title">От толстой к тонкой</h2>
      </div>
      <span class="string-count">{{ strings.length }}×</span>
    </div>
    <div class="string-strip" role="list" aria-label="Струны от толстой к тонкой">
      <button
        v-for="(midi, index) in strings"
        :key="`${midi}-${index}`"
        type="button"
        class="string-button"
        :class="{
          active: selected === index,
          'session-complete': completedIndices?.includes(index)
        }"
        :aria-pressed="selected === index"
        :aria-disabled="sessionActive || undefined"
        :aria-label="`Струна ${strings.length - index}, ${formatNote(midi, accidental)}${index === 0 ? ', самая толстая' : index === strings.length - 1 ? ', самая тонкая' : ''}${completedIndices?.includes(index) ? ', настроена' : ''}`"
        @click="select(index)"
      >
        <span class="string-number">{{ strings.length - index }}</span>
        <strong>{{ formatNote(midi, accidental) }}</strong>
        <Check
          v-if="completedIndices?.includes(index)"
          class="string-complete-icon"
          :size="17"
          aria-hidden="true"
        />
        <small v-else-if="index === 0">толстая</small>
        <small v-else-if="index === strings.length - 1">тонкая</small>
        <small v-else>струна</small>
      </button>
    </div>
  </section>
</template>
