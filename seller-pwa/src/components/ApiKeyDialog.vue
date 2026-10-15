<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The API key of a new robot, shown once. The platform keeps only a hash, so this is
 * the one moment to copy it (into the simulator or the robot).
 */
defineProps<{ robotName: string; apiKey: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const copied = ref(false)

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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="api-key-title"
    aria-describedby="api-key-warning"
    data-testid="api-key-dialog"
  >
    <UCard class="w-full max-w-lg">
      <template #header>
        <h2 id="api-key-title" class="text-lg font-semibold">{{ t('apiKey.title', { name: robotName }) }}</h2>
      </template>
      <div class="flex flex-col gap-4">
        <p id="api-key-warning" class="text-sm">{{ t('apiKey.warning') }}</p>
        <code class="block break-all rounded bg-elevated p-3 text-sm select-all" data-testid="api-key-value">{{ apiKey }}</code>
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="outline" data-testid="api-key-copy" @click="copy(apiKey)">
            {{ copied ? t('apiKey.copied') : t('apiKey.copy') }}
          </UButton>
          <UButton data-testid="api-key-done" @click="emit('close')">{{ t('apiKey.done') }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
