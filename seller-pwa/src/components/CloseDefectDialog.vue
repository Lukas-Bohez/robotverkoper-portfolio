<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Defect } from '@/api/types'
import AppDialog from '@/components/AppDialog.vue'
import SelectField from '@/components/SelectField.vue'
import { useAction } from '@/composables/useLoad'
import { cargoCleared } from '@/lib/defects'
import { useDefectsStore } from '@/stores/defects'

/**
 * Popup P4: closes a defect. How was it solved (a list, not a text field) and what did the technician do. Food that is
 * still in the robot has to come out first: the API refuses otherwise, and this dialog says so before it is asked.
 */
const props = defineProps<{ defect: Defect }>()
const emit = defineEmits<{ close: []; closed: [defect: Defect] }>()

const { t } = useI18n()
const defects = useDefectsStore()
const { busy, error, run } = useAction()

type Resolution = 'REPAIRED' | 'FALSE_ALARM'
const form = reactive({ resolution: 'REPAIRED' as Resolution, note: '' })

const options = computed(() => [
  { value: 'REPAIRED', label: t('closeDefect.repaired') },
  { value: 'FALSE_ALARM', label: t('closeDefect.falseAlarm') },
])

/** A false alarm needs no check: the robot was fine. A repair does: the food must be out. */
const blocked = computed(() => form.resolution === 'REPAIRED' && !cargoCleared(props.defect))

async function onSubmit() {
  if (blocked.value) return
  const closed = await run(
    () => defects.close(props.defect.id, { resolution: form.resolution, ...(form.note.trim() ? { note: form.note.trim() } : {}) }),
    t('closeDefect.error'),
  )
  if (closed) emit('closed', closed)
}
</script>

<template>
  <AppDialog :title="t('closeDefect.title')" testid="close-defect-dialog" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <SelectField v-model="form.resolution" :label="t('closeDefect.how')" :options="options" data-testid="close-resolution" />
      <UFormField :label="t('closeDefect.note')" name="note">
        <UInput v-model="form.note" maxlength="300" class="w-full" size="xl" data-testid="close-note" />
      </UFormField>
      <UAlert v-if="blocked" color="warning" variant="subtle" :title="t('closeDefect.cargoFirst')" data-testid="close-cargo" />
      <UAlert v-else color="success" variant="subtle" :title="t('closeDefect.after', { company: defect.company.name })" data-testid="close-after" />
      <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="close-error" />
      <div class="flex flex-col gap-2 md:flex-row md:gap-4">
        <UButton type="submit" class="justify-center" :loading="busy" :disabled="blocked" data-testid="close-submit">
          {{ t('closeDefect.submit') }}
        </UButton>
        <UButton color="neutral" variant="outline" class="justify-center" data-testid="close-cancel" @click="emit('close')">
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </form>
  </AppDialog>
</template>
