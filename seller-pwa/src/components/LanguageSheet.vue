<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/AppDialog.vue'
import { useLanguage } from '@/composables/useLanguage'
import type { Language } from '@/i18n'

/** Popup P9: the language of the app. The name of every language is written in that language itself. */
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { language, languages, setLanguage } = useLanguage()

const NAMES: Record<Language, string> = { en: 'English', nl: 'Nederlands', fr: 'Français', de: 'Deutsch' }

async function pick(code: Language) {
  await setLanguage(code)
  emit('close')
}
</script>

<template>
  <AppDialog :title="t('language.title')" testid="language-sheet" @close="emit('close')">
    <ul class="flex flex-col">
      <li v-for="code in languages" :key="code" class="border-b border-default last:border-b-0">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 py-4 text-left text-body"
          :aria-current="language === code ? 'true' : undefined"
          :data-testid="`sheet-language-${code}`"
          @click="pick(code)"
        >
          <span class="flex items-center gap-4">
            <span
              :class="[
                'rounded-md px-2 py-1 text-caption',
                language === code ? 'bg-(--figma-primary-soft) text-(--figma-primary-text)' : 'bg-elevated text-muted',
              ]"
            >
              {{ code.toUpperCase() }}
            </span>
            <span :class="language === code ? 'font-semibold' : ''">{{ NAMES[code] }}</span>
          </span>
          <UIcon v-if="language === code" name="i-lucide-check" class="size-5 text-(--figma-primary-text)" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p class="text-caption text-muted">{{ t('language.note') }}</p>
  </AppDialog>
</template>
