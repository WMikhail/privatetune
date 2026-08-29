<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <aside v-if="needRefresh" class="update-prompt" role="status">
    <span>Доступна новая версия</span>
    <button type="button" @click="updateServiceWorker(true)">Обновить</button>
    <button type="button" aria-label="Закрыть" @click="needRefresh = false">×</button>
  </aside>
</template>
