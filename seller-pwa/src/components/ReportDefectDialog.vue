<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Defect, DefectSeverity } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'

/** Reports a defect of one robot: what is wrong and how bad it is */
const props = defineProps<{ robotId: string; robotName: string }>()
const emit = defineEmits<{ close: []; reported: [defect: Defect] }>()

const { t } = useI18n()
const SEVERITIES: DefectSeverity[] = ['low', 'medium', 'high']
const form = reactive({ summary: '', severity: 'medium' as DefectSeverity })
const saving = ref(false)
const error = ref('')

const canSubmit = computed(() => form.summary.trim().length >= 3 && !saving.value)

async function onSubmit() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = ''
  try {
    const defect = await api.post<Defect>(`/robots/${encodeURIComponent(props.robotId)}/defects`, {
      summary: form.summary.trim(),
      severity: form.severity,
    })
    emit('reported', defect)
  } catch (e) {
    error.value = apiErrorMessage(e, t('defectDialog.error'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="defect-title"
    data-testid="defect-dialog"
  >
    <UCard class="w-full max-w-lg">
      <template #header>
        <h2 id="defect-title" class="text-xl font-semibold">{{ t('defectDialog.title', { name: robotName }) }}</h2>
      </template>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <UFormField :label="t('defectDialog.summary')" :hint="t('defectDialog.summaryHint')" name="summary">
          <UInput v-model="form.summary" required minlength="3" maxlength="200" class="w-full" data-testid="defect-summary" />
        </UFormField>
        <UFormField :label="t('defectDialog.severity')" name="severity">
          <select
            v-model="form.severity"
            class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
            data-testid="defect-severity"
          >
            <option v-for="value in SEVERITIES" :key="value" :value="value">{{ t(`severities.${value}`) }}</option>
          </select>
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="defect-error" />
        <div class="flex gap-4">
          <UButton type="submit" :loading="saving" :disabled="!canSubmit" data-testid="defect-submit">
            {{ t('defectDialog.submit') }}
          </UButton>
          <UButton color="neutral" variant="outline" data-testid="defect-cancel" @click="emit('close')">
            {{ t('defectDialog.cancel') }}
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
