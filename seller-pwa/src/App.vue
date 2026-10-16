<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/AppHeader.vue'
import LanguageSwitch from '@/components/LanguageSwitch.vue'

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
    <!-- The page: 64 px at the sides on a computer, 16 px on a phone (the design of Figma) -->
    <main id="content" class="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 md:px-16 md:py-10">
      <RouterView />
    </main>
    <LanguageSwitch />
  </UApp>
</template>
