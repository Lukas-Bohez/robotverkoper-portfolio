<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/AppDialog.vue'

/** Popup P7 (phone): the other things a technician can do with a defect */
defineProps<{ canReplace: boolean; canClose: boolean; canHelp: boolean; hasRoute: boolean }>()
const emit = defineEmits<{ close: []; replace: []; closeDefect: []; help: []; route: [] }>()

const { t } = useI18n()
</script>

<template>
  <AppDialog :title="t('moreActions.title')" testid="more-actions" @close="emit('close')">
    <ul class="flex flex-col">
      <li v-if="canReplace" class="border-b border-default">
        <button type="button" class="flex w-full items-center gap-4 py-4 text-left text-body" data-testid="more-replace" @click="emit('replace')">
          <UIcon name="i-lucide-qr-code" class="size-6" aria-hidden="true" />
          {{ t('moreActions.replace') }}
        </button>
      </li>
      <li v-if="canClose" class="border-b border-default">
        <button type="button" class="flex w-full items-center gap-4 py-4 text-left text-body" data-testid="more-close" @click="emit('closeDefect')">
          <UIcon name="i-lucide-check" class="size-6" aria-hidden="true" />
          {{ t('moreActions.close') }}
        </button>
      </li>
      <li v-if="canHelp" class="border-b border-default">
        <button type="button" class="flex w-full items-center gap-4 py-4 text-left text-body" data-testid="more-help" @click="emit('help')">
          <UIcon name="i-lucide-phone" class="size-6" aria-hidden="true" />
          {{ t('moreActions.help') }}
        </button>
      </li>
      <li v-if="hasRoute">
        <button type="button" class="flex w-full items-center gap-4 py-4 text-left text-body" data-testid="more-route" @click="emit('route')">
          <UIcon name="i-lucide-map-pin" class="size-6" aria-hidden="true" />
          {{ t('moreActions.route') }}
        </button>
      </li>
    </ul>
    <UButton color="neutral" variant="outline" class="justify-center" data-testid="more-cancel" @click="emit('close')">{{ t('common.cancel') }}</UButton>
  </AppDialog>
</template>
