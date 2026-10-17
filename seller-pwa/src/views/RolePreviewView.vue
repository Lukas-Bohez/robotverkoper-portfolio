<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Company } from '@/api/types'
import PageTitle from '@/components/PageTitle.vue'
import SelectField from '@/components/SelectField.vue'
import { useLoad } from '@/composables/useLoad'
import { sectionsFor } from '@/lib/preview'
import { useCompaniesStore } from '@/stores/companies'
import { useCompanyRolesStore } from '@/stores/companyRoles'

/** Screen 08: what a role would see in the app of the company ("bekijken als rol"). Only the permission keys are read. */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const companies = useCompaniesStore()
const store = useCompanyRolesStore()

const companyId = computed(() => String(route.params.id ?? ''))
const company = ref<Company | null>(null)
const selectedId = ref('')

const { loading, error, run } = useLoad(async () => {
  company.value = await companies.find(companyId.value)
  if (!company.value) return
  await store.load(companyId.value)
  const wanted = typeof route.query.role === 'string' ? route.query.role : ''
  selectedId.value = store.roles.find(r => r.id === wanted)?.id ?? store.roles[0]?.id ?? ''
}, () => t('preview.loadError'))
onMounted(() => void run())

const nameOf = (role: (typeof store.roles)[number]) => role.names?.[locale.value as 'nl'] || role.names?.en || role.name
const role = computed(() => store.roles.find(item => item.id === selectedId.value) ?? null)
const roleName = computed(() => (role.value ? (role.value.locked ? t('roles.admin') : nameOf(role.value)) : ''))
const sections = computed(() => (role.value ? sectionsFor(role.value.permissions) : []))
const landing = computed(() => sections.value[0] ?? null)
const options = computed(() => store.roles.map(item => ({ value: item.id, label: item.locked ? t('roles.admin') : nameOf(item) })))
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('preview.loading')" data-testid="preview-loading">
    <USkeleton class="h-10 w-72" />
    <USkeleton class="h-40 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="preview-error" />
  <p v-else-if="!company" data-testid="preview-not-found">{{ t('robots.notFound') }}</p>
  <template v-else>
    <RouterLink :to="{ name: 'company-roles', params: { id: companyId } }" class="text-small text-(--figma-primary-text)">← {{ t('preview.stop') }}</RouterLink>
    <PageTitle :title="t('preview.title')" />
    <div
      class="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-(--figma-warning-soft) px-4 py-3 text-small font-medium text-(--figma-warning-text)"
      role="status"
      data-testid="preview-banner"
    >
      <span>{{ t('preview.banner', { company: company.name, role: roleName }) }}</span>
      <div class="flex items-end gap-4">
        <SelectField v-model="selectedId" :label="t('preview.role')" :options="options" data-testid="preview-role" />
        <UButton color="neutral" variant="outline" size="sm" data-testid="preview-stop" @click="router.push({ name: 'company-roles', params: { id: companyId } })">{{ t('preview.stop') }}</UButton>
      </div>
    </div>

    <p v-if="!landing" data-testid="preview-none">{{ t('preview.none') }}</p>
    <template v-else>
      <nav class="flex flex-wrap gap-2" :aria-label="t('preview.menu')" data-testid="preview-menu">
        <span
          v-for="id in sections"
          :key="id"
          :class="['rounded-md px-3 py-1 text-small', id === landing ? 'bg-primary text-inverted' : 'bg-elevated text-muted']"
          data-testid="preview-section"
        >
          {{ t(`preview.sections.${id}`) }}
        </span>
      </nav>
      <section class="flex flex-col gap-4">
        <h2 class="text-section font-semibold" data-testid="preview-landing">{{ t(`preview.sections.${landing}`) }}</h2>
        <p class="text-muted">{{ t('preview.intro', { role: roleName }) }}</p>
        <UCard class="max-w-xl">
          <template #header><h3 class="text-card font-semibold">{{ t('preview.sample.order') }}</h3></template>
          <p class="text-muted">{{ t('preview.sample.items') }}</p>
          <template #footer>
            <div class="flex items-center gap-4">
              <UButton disabled>{{ t('preview.sample.start') }}</UButton>
              <span class="text-caption text-muted">{{ t('preview.readOnly') }} · {{ t('preview.sample.note') }}</span>
            </div>
          </template>
        </UCard>
      </section>
    </template>
  </template>
</template>
