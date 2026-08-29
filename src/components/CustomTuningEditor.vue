<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Minus, Plus } from '@lucide/vue'
import { FLAT_NAMES, SHARP_NAMES, midiToNote, noteToMidi } from '@/domain/note-math'
import { isValidTuningStrings } from '@/domain/tunings'
import type { CustomTuning } from '@/domain/types'

const props = defineProps<{ modelValue: CustomTuning | null }>()
const emit = defineEmits<{
  save: [value: { name: string; strings: number[]; existing: CustomTuning | null }]
  cancel: []
}>()

const form = reactive({ name: '', strings: [40, 45, 50, 55, 59, 64] as number[] })
const pitchClasses = SHARP_NAMES.map((name, value) => ({
  name,
  flatName: FLAT_NAMES[value],
  value
}))
const octaves = [-1, 0, 1, 2, 3, 4, 5, 6]

watch(
  () => props.modelValue,
  (value) => {
    form.name = value?.name ?? ''
    form.strings = value ? [...value.strings] : [40, 45, 50, 55, 59, 64]
  },
  { immediate: true }
)

const valid = computed(() => form.name.trim().length > 0 && isValidTuningStrings(form.strings))

function setPitchClass(index: number, pitchClass: number): void {
  const note = midiToNote(form.strings[index] ?? 40)
  form.strings[index] = noteToMidi(pitchClass, note.octave)
}

function setOctave(index: number, octave: number): void {
  const midi = form.strings[index] ?? 40
  form.strings[index] = noteToMidi(((midi % 12) + 12) % 12, octave)
}

function changeCount(delta: number): void {
  const next = Math.max(4, Math.min(9, form.strings.length + delta))
  while (form.strings.length < next) form.strings.push((form.strings.at(-1) ?? 40) + 5)
  form.strings.splice(next)
}
</script>

<template>
  <form
    class="custom-editor"
    @submit.prevent="
      valid &&
      emit('save', { name: form.name.trim(), strings: [...form.strings], existing: modelValue })
    "
  >
    <label class="field"
      ><span>Название строя</span
      ><input v-model="form.name" required maxlength="48" placeholder="Например, My Drop F"
    /></label>
    <div class="count-control">
      <span>Количество струн</span>
      <div>
        <button
          type="button"
          aria-label="Уменьшить число струн"
          :disabled="form.strings.length <= 4"
          @click="changeCount(-1)"
        >
          <Minus :size="17" />
        </button>
        <strong>{{ form.strings.length }}</strong>
        <button
          type="button"
          aria-label="Увеличить число струн"
          :disabled="form.strings.length >= 9"
          @click="changeCount(1)"
        >
          <Plus :size="17" />
        </button>
      </div>
    </div>
    <div class="custom-strings">
      <div v-for="(midi, index) in form.strings" :key="index" class="custom-string-row">
        <span class="string-number">{{ form.strings.length - index }}</span>
        <span class="custom-string-kind">{{
          index === 0 ? 'Толстая' : index === form.strings.length - 1 ? 'Тонкая' : 'Струна'
        }}</span>
        <label
          ><span class="sr-only">Нота струны {{ form.strings.length - index }}</span
          ><select
            :value="((midi % 12) + 12) % 12"
            @change="setPitchClass(index, Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="pitch in pitchClasses" :key="pitch.value" :value="pitch.value">
              {{ pitch.name }} / {{ pitch.flatName }}
            </option>
          </select></label
        >
        <label
          ><span class="sr-only">Октава струны {{ form.strings.length - index }}</span
          ><select
            :value="midiToNote(midi).octave"
            @change="setOctave(index, Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="octave in octaves" :key="octave" :value="octave">{{ octave }}</option>
          </select></label
        >
      </div>
    </div>
    <p class="form-hint" :class="{ error: !isValidTuningStrings(form.strings) }">
      Диапазон C0–E6. Ноты должны возрастать от толстой струны к тонкой.
    </p>
    <div class="form-actions">
      <button type="button" class="button ghost" @click="emit('cancel')">Отмена</button
      ><button class="button primary" :disabled="!valid">
        {{ modelValue ? 'Сохранить' : 'Добавить строй' }}
      </button>
    </div>
  </form>
</template>
