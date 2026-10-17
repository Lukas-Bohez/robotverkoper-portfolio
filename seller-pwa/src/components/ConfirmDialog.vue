<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/AppDialog.vue'

/**
 * A confirmation before something that matters (the Dialog component of the design): call a technician, archive,
 * restore. The danger tone is for what takes something away (even though nothing is deleted for real).
 */
defineProps<{
  title: string
  message: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const { t } = useI18n()
</script>

<template>
  <AppDialog :title="title" :description="message" testid="confirm-dialog" @close="emit('cancel')">
    <slot />
    <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="confirm-error" />
    <div class="flex flex-col gap-2 md:flex-row md:gap-4">
      <UButton
        :color="tone === 'danger' ? 'error' : 'primary'"
        class="justify-center"
        :loading="busy"
        data-autofocus
        data-testid="confirm-yes"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </UButton>
      <UButton color="neutral" variant="outline" class="justify-center" data-testid="confirm-no" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </UButton>
    </div>
  </AppDialog>
</template>
