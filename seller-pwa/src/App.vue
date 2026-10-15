<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/AppHeader.vue'

const { t } = useI18n()
</script>

<template>
  <UApp>
    <a
      href="#content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-default focus:p-2"
    >
      {{ t('app.skip') }}
    </a>
    <AppHeader />
    <main id="content" class="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <RouterView />
    </main>
  </UApp>
</template>
