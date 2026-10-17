<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTechnicianCalls } from '@/composables/useRealtime'

/**
 * On the screen of a technician: someone calls for a technician (an administrator) or a colleague asks for help. It
 * comes in over the websocket, so nobody has to ask again, and it links to the defect with all the info. How the call
 * reaches the technician does not matter to the customer; this is the part that is in the app.
 */
const { t } = useI18n()
const { call, dismiss } = useTechnicianCalls()
</script>

<template>
  <div
    v-if="call"
    class="fixed inset-x-4 top-20 z-40 mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border border-(--figma-warning) bg-(--figma-warning-soft) p-4 text-(--figma-warning-text) shadow-lg"
    role="alert"
    data-testid="call-banner"
  >
    <p class="font-semibold">
      {{ call.kind === 'HELP' ? t('call.helpTitle', { who: call.requestedBy }) : t('call.callTitle') }}
    </p>
    <p class="text-small">
      {{ call.robotName }} · {{ call.companyName }} · {{ call.summary }}
      <strong v-if="call.hasCargo">{{ t('call.cargo') }}</strong>
    </p>
    <div class="flex gap-2">
      <UButton :to="{ name: 'defect', params: { id: call.defectId } }" size="sm" data-testid="call-open" @click="dismiss">
        {{ t('call.open') }}
      </UButton>
      <UButton color="neutral" variant="outline" size="sm" data-testid="call-dismiss" @click="dismiss">{{ t('call.dismiss') }}</UButton>
    </div>
  </div>
</template>
