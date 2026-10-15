<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSimulatorHandoff } from '@/lib/handoff'

/**
 * The API key of a new robot, shown once. The platform keeps only a hash, so this is the one
 * moment to get it. It goes to a waiting simulator by itself; copying is the fallback.
 */
const props = defineProps<{ robotId: string; robotName: string; apiKey: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const copied = ref(false)
const { waiting, sentTo, sending, failed, send } = useSimulatorHandoff(props.robotId, props.apiKey)

async function copy(key: string) {
  try {
    await navigator.clipboard.writeText(key)
    copied.value = true
  } catch {
    copied.value = false // The key is still on screen: select it by hand
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="api-key-title"
    aria-describedby="api-key-warning"
    data-testid="api-key-dialog"
  >
    <UCard class="w-full max-w-xl">
      <template #header>
        <h2 id="api-key-title" class="text-xl font-semibold">{{ t('apiKey.title', { name: robotName }) }}</h2>
      </template>
      <div class="flex flex-col gap-6">
        <UAlert id="api-key-warning" color="warning" variant="subtle" :title="t('apiKey.warning')" />

        <UAlert
          v-if="sentTo"
          color="success"
          variant="subtle"
          :title="t('apiKey.simulator.sent', { device: sentTo.device })"
          data-testid="handoff-sent"
        />
        <div v-else class="flex flex-col gap-2" data-testid="handoff">
          <p v-if="waiting.length === 0" class="text-sm text-muted" data-testid="handoff-none">
            {{ t('apiKey.simulator.none') }}
          </p>
          <template v-else>
            <p class="text-sm">{{ t('apiKey.simulator.choose') }}</p>
            <UButton
              v-for="pairing in waiting"
              :key="pairing.id"
              color="primary"
              variant="soft"
              :loading="sending"
              data-testid="handoff-send"
              @click="send(pairing)"
            >
              {{ t('apiKey.simulator.send', { device: pairing.device, code: pairing.code }) }}
            </UButton>
          </template>
          <UAlert v-if="failed" color="error" variant="subtle" :title="t('apiKey.simulator.error')" data-testid="handoff-error" />
        </div>

        <code class="block break-all rounded-lg bg-elevated p-4 text-sm select-all" data-testid="api-key-value">{{ apiKey }}</code>
        <div class="flex flex-wrap gap-4">
          <UButton color="neutral" variant="outline" data-testid="api-key-copy" @click="copy(apiKey)">
            {{ copied ? t('apiKey.copied') : t('apiKey.copy') }}
          </UButton>
          <UButton data-testid="api-key-done" @click="emit('close')">{{ t('apiKey.done') }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
