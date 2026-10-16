<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'

const { t, locale } = useI18n()
</script>

<template>
  <!-- At the bottom of the page: the header stays exactly as in the Figma design -->
  <footer class="mx-auto flex w-full max-w-[1440px] items-center justify-end gap-2 px-4 pb-6 text-caption text-muted md:px-16">
    <span id="language-label">{{ t('app.language') }}</span>
    <div class="flex gap-1" role="group" aria-labelledby="language-label">
      <UButton
        v-for="code in LANGUAGES"
        :key="code"
        size="xs"
        :variant="locale === code ? 'solid' : 'ghost'"
        :color="locale === code ? 'primary' : 'neutral'"
        :aria-pressed="locale === code"
        :data-testid="`language-${code}`"
        @click="setLanguage(code as Language)"
      >
        {{ code.toUpperCase() }}
      </UButton>
    </div>
  </footer>
</template>
