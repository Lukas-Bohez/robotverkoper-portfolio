<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RoleCopyResult } from '@/api/types'
import PageTitle from '@/components/PageTitle.vue'
import SelectField from '@/components/SelectField.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useCompaniesStore } from '@/stores/companies'
import { useCompanyRolesStore } from '@/stores/companyRoles'

/** Screen 15: presets. A role made once (rights and names in every language) that is given to as many companies as you like. */
const { t, locale } = useI18n()
const companies = useCompaniesStore()
const store = useCompanyRolesStore()

const chosen = ref<string[]>([])
const from = ref('')
const to = ref('')
const outcome = ref<RoleCopyResult | null>(null)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  await Promise.all([store.loadPresets(), companies.load()])
  const active = companies.items.filter(c => !c.deletedAt)
  if (!from.value) from.value = active[0]?.id ?? ''
  if (!to.value) to.value = active[1]?.id ?? active[0]?.id ?? ''
}, () => t('presets.loadError'))
onMounted(() => void run())
watch(locale, () => void run(true))

const companyOptions = computed(() => companies.items.filter(c => !c.deletedAt).map(c => ({ value: c.id, label: c.name })))
const languages = (names: Record<string, unknown> | null | undefined) =>
  (['nl', 'en', 'fr', 'de'] as const).filter(code => typeof names?.[code] === 'string' && String(names?.[code]).trim() !== '')

function toggle(id: string) {
  chosen.value = chosen.value.includes(id) ? chosen.value.filter(x => x !== id) : [...chosen.value, id]
}

async function apply() {
  outcome.value = null
  const result = await action.run(() => store.applyPresets(chosen.value, [to.value]), t('presets.error'))
  if (result) outcome.value = result
}

async function remove(id: string) {
  await action.run(() => store.removePreset(id), t('presets.removeError'))
}
</script>

<template>
  <RouterLink :to="{ name: 'team' }" class="text-small text-(--figma-primary-text)">← {{ t('teamRoles.back') }}</RouterLink>
  <PageTitle :title="t('presets.title')" :subtitle="t('presets.intro')" />

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('presets.loading')" data-testid="presets-loading">
    <USkeleton class="h-48 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="presets-error" />
  <div v-else class="grid gap-8 lg:grid-cols-[1fr_448px] lg:items-start">
    <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8">
      <h2 class="text-card font-semibold">{{ t('presets.list') }}</h2>
      <p v-if="store.presets.length === 0" data-testid="presets-empty">{{ t('presets.empty') }}</p>
      <div v-else class="table-card">
        <table data-testid="presets-table">
          <thead><tr><th scope="col" /><th scope="col">{{ t('presets.role') }}</th><th scope="col">{{ t('presets.rights') }}</th><th scope="col">{{ t('presets.languages') }}</th><th scope="col" /></tr></thead>
          <tbody>
            <tr v-for="preset in store.presets" :key="preset.id" data-testid="preset-row">
              <td><UCheckbox :model-value="chosen.includes(preset.id)" :aria-label="t('presets.choose', { name: preset.name })" :data-testid="`preset-check-${preset.id}`" @update:model-value="toggle(preset.id)" /></td>
              <td class="font-medium">{{ preset.name }}</td>
              <td>{{ t('presets.rightCount', preset.permissions.length) }}</td>
              <td>
                <UBadge :color="preset.missingLanguages.length ? 'warning' : 'success'" variant="subtle">
                  {{ preset.missingLanguages.length ? t('presets.someLanguages', { n: 4 - preset.missingLanguages.length }) : t('presets.allLanguages') }}
                </UBadge>
                <span class="sr-only">{{ languages(preset.names as never).join(' ') }}</span>
              </td>
              <td><UButton size="sm" color="neutral" variant="ghost" :data-testid="`preset-remove-${preset.id}`" @click="remove(preset.id)">{{ t('roles.archive') }}</UButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-caption text-muted">{{ t('presets.note') }}</p>
    </section>

    <form class="flex flex-col gap-6 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="preset-form" @submit.prevent="apply">
      <h2 class="text-card font-semibold">{{ t('presets.copyTitle') }}</h2>
      <SelectField v-model="from" :label="t('presets.from')" :options="companyOptions" data-testid="preset-from" />
      <SelectField v-model="to" :label="t('presets.to')" :options="companyOptions" data-testid="preset-to" />
      <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="preset-error" />
      <UAlert v-if="outcome" :color="outcome.skipped.length ? 'warning' : 'success'" variant="subtle" :title="t('roles.outcome', { copied: outcome.copied, skipped: outcome.skipped.join(', ') || '–' })" data-testid="preset-outcome" />
      <div class="flex gap-4">
        <UButton type="submit" :loading="action.busy.value" :disabled="chosen.length === 0 || !to" data-testid="preset-apply">{{ t('presets.copy') }}</UButton>
        <UButton color="neutral" variant="outline" :to="{ name: 'team' }">{{ t('common.cancel') }}</UButton>
      </div>
    </form>
  </div>
</template>
