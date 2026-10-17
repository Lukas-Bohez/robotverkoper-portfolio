<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Defect, DefectSeverity } from '@/api/types'
import AppDialog from '@/components/AppDialog.vue'
import SelectField from '@/components/SelectField.vue'
import { useAction } from '@/composables/useLoad'
import { useDefectsStore } from '@/stores/defects'

/** Reports a defect of one robot: what is wrong and how bad it is (design 10). The API keeps the condition of the robot with it. */
const props = defineProps<{ robotId: string; robotName: string }>()
const emit = defineEmits<{ close: []; reported: [defect: Defect] }>()

const { t } = useI18n()
const defects = useDefectsStore()
const { busy, error, run } = useAction()

const SEVERITIES: DefectSeverity[] = ['LOW', 'MEDIUM', 'HIGH']
const form = reactive({ summary: '', severity: 'MEDIUM' as DefectSeverity })

const options = computed(() => SEVERITIES.map(value => ({ value, label: t(`severities.${value.toLowerCase()}`) })))
const canSubmit = computed(() => form.summary.trim().length >= 3 && !busy.value)

async function onSubmit() {
  if (!canSubmit.value) return
  const defect = await run(
    () => defects.report(props.robotId, { summary: form.summary.trim(), severity: form.severity }),
    t('defectDialog.error'),
  )
  if (defect) emit('reported', defect)
}
</script>

<template>
  <AppDialog :title="t('defectDialog.title', { name: robotName })" testid="defect-dialog" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <UFormField :label="t('defectDialog.summary')" :help="t('defectDialog.summaryHint')" name="summary">
        <UInput v-model="form.summary" required minlength="3" maxlength="200" class="w-full" size="xl" data-autofocus data-testid="defect-summary" />
      </UFormField>
      <SelectField v-model="form.severity" :label="t('defectDialog.severity')" :options="options" data-testid="defect-severity" />
      <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="defect-error" />
      <div class="flex flex-col gap-2 md:flex-row md:gap-4">
        <UButton type="submit" class="justify-center" :loading="busy" :disabled="!canSubmit" data-testid="defect-submit">
          {{ t('defectDialog.submit') }}
        </UButton>
        <UButton color="neutral" variant="outline" class="justify-center" data-testid="defect-cancel" @click="emit('close')">
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </form>
  </AppDialog>
</template>
