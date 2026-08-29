<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Pencil, Plus, RotateCcw, Settings, Trash2, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger
} from 'reka-ui'
import type { CustomTuning } from '@/domain/types'
import { useTunerStore } from '@/stores/tuner'
import CustomTuningEditor from './CustomTuningEditor.vue'

const store = useTunerStore()
const open = defineModel<boolean>('open', { default: false })
const editorOpen = ref(false)
const editing = ref<CustomTuning | null>(null)
const wakeLockSupported = computed(() => 'wakeLock' in navigator)

function createTuning(): void {
  editing.value = null
  editorOpen.value = true
}
function editTuning(tuning: CustomTuning): void {
  editing.value = tuning
  editorOpen.value = true
}
function saveTuning(value: {
  name: string
  strings: number[]
  existing: CustomTuning | null
}): void {
  if (value.existing) {
    store.updateCustomTuning({
      ...value.existing,
      name: value.name,
      strings: value.strings,
      stringCount: value.strings.length
    })
  } else {
    const created = store.addCustomTuning({
      name: value.name,
      family: 'custom',
      strings: value.strings,
      stringCount: value.strings.length
    })
    store.setInstrument('custom')
    store.settings.tuningId = created.id
  }
  editorOpen.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger class="icon-button" aria-label="Открыть настройки"
      ><Settings :size="20"
    /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content">
        <div class="dialog-grabber" aria-hidden="true" />
        <header class="dialog-header">
          <div>
            <DialogTitle class="dialog-title">Настройки</DialogTitle
            ><DialogDescription class="dialog-description"
              >Оставьте только то, чем действительно пользуетесь</DialogDescription
            >
          </div>
          <DialogClose class="icon-button" aria-label="Закрыть настройки"
            ><X :size="20"
          /></DialogClose>
        </header>

        <div class="settings-scroll">
          <section class="settings-section">
            <h3>Режим интерфейса</h3>
            <fieldset class="interface-mode-switch">
              <legend class="sr-only">Режим интерфейса</legend>
              <label
                ><input
                  type="radio"
                  name="interface-mode"
                  value="standard"
                  :checked="store.settings.interfaceMode === 'standard'"
                  @change="store.setInterfaceMode('standard')"
                /><span><b>Стандартный</b><small>Только основное</small></span></label
              ><label
                ><input
                  type="radio"
                  name="interface-mode"
                  value="professional"
                  :checked="store.settings.interfaceMode === 'professional'"
                  @change="store.setInterfaceMode('professional')"
                /><span><b>Профессиональный</b><small>Ручной контроль</small></span></label
              >
            </fieldset>
            <div class="preference-list">
              <label class="toggle"
                ><input
                  v-model="store.settings.showGuidedSession"
                  type="checkbox"
                  :disabled="store.guidedSessionActive"
                /><span>Пошаговая настройка</span
                ><small>Кнопка для настройки всех струн по очереди</small></label
              ><label class="toggle"
                ><input v-model="store.settings.showStrings" type="checkbox" /><span
                  >Показывать струны</span
                ><small>Быстрый выбор отдельной струны</small></label
              ><label class="toggle"
                ><input v-model="store.settings.showSignalPanel" type="checkbox" /><span
                  >Показывать качество сигнала</span
                ><small>Уровень входа и стабильность распознавания</small></label
              >
            </div>
          </section>

          <section v-if="store.settings.interfaceMode === 'professional'" class="settings-section">
            <h3>Калибровка</h3>
            <label class="field range-field"
              ><span
                ><b>A4</b><output>{{ store.settings.a4 }} Hz</output></span
              ><input v-model.number="store.settings.a4" type="range" min="430" max="450" step="1"
            /></label>
            <label class="field"
              ><span>Названия нот</span
              ><select v-model="store.settings.accidental">
                <option value="sharp">Диезы · C♯</option>
                <option value="flat">Бемоли · D♭</option>
              </select></label
            >
            <label class="field range-field"
              ><span
                ><b>Порог шума</b><output>{{ store.settings.noiseGateDb }} dB</output></span
              ><input
                v-model.number="store.settings.noiseGateDb"
                type="range"
                min="-70"
                max="-30"
                step="1"
            /></label>
          </section>

          <section class="settings-section">
            <h3>Аудиовход</h3>
            <label class="field"
              ><span>Устройство</span
              ><select
                v-model="store.settings.inputDeviceId"
                :disabled="store.audioInputs.length === 0"
              >
                <option value="">Системный по умолчанию</option>
                <option
                  v-for="(device, index) in store.audioInputs"
                  :key="device.deviceId"
                  :value="device.deviceId"
                >
                  {{ device.label || `Аудиовход ${index + 1}` }}
                </option>
              </select></label
            >
            <p class="form-hint">Список устройств появляется после разрешения микрофона.</p>
            <label class="toggle"
              ><input
                v-model="store.settings.wakeLock"
                type="checkbox"
                :disabled="!wakeLockSupported"
              /><span>Не выключать экран</span
              ><small>{{
                wakeLockSupported ? 'Пока тюнер включён' : 'Не поддерживается браузером'
              }}</small></label
            >
          </section>

          <section v-if="store.settings.interfaceMode === 'professional'" class="settings-section">
            <div class="section-heading">
              <h3>Мои строи</h3>
              <button class="button compact" type="button" @click="createTuning">
                <Plus :size="16" /> Добавить
              </button>
            </div>
            <CustomTuningEditor
              v-if="editorOpen"
              :model-value="editing"
              @save="saveTuning"
              @cancel="editorOpen = false"
            />
            <div v-else-if="store.customTunings.length" class="custom-list">
              <article v-for="tuning in store.customTunings" :key="tuning.id">
                <div>
                  <strong>{{ tuning.name }}</strong
                  ><span>{{ tuning.stringCount }} струн</span>
                </div>
                <div class="row-actions">
                  <button
                    type="button"
                    aria-label="Редактировать строй"
                    @click="editTuning(tuning)"
                  >
                    <Pencil :size="17" /></button
                  ><button
                    type="button"
                    aria-label="Дублировать строй"
                    @click="store.duplicateCustomTuning(tuning.id)"
                  >
                    <Copy :size="17" /></button
                  ><button
                    type="button"
                    aria-label="Удалить строй"
                    @click="store.removeCustomTuning(tuning.id)"
                  >
                    <Trash2 :size="17" />
                  </button>
                </div>
              </article>
            </div>
            <p v-else-if="!editorOpen" class="empty-state">
              Создайте собственный строй на 4–9 струн.
            </p>
          </section>

          <button class="button danger wide" type="button" @click="store.resetSettings">
            <RotateCcw :size="17" /> Сбросить настройки
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
