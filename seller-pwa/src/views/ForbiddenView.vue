<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <div class="mx-auto max-w-md pt-8">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">{{ t('forbidden.title') }}</h1>
      </template>
      <p>{{ route.query.error ? t('forbidden.error') : route.query.reason === 'role' ? t('forbidden.role') : t('forbidden.text') }}</p>
    </UCard>
  </div>
</template>
