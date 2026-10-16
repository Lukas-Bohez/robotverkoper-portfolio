<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <div class="flex w-full max-w-[448px] flex-col gap-4 md:mx-auto md:mt-6 md:rounded-2xl md:border md:border-default md:bg-default md:p-8">
    <h1 class="text-page font-semibold">{{ t('forbidden.title') }}</h1>
    <p class="text-small text-muted">
      {{ route.query.error ? t('forbidden.error') : route.query.reason === 'role' ? t('forbidden.role') : t('forbidden.text') }}
    </p>
  </div>
</template>
