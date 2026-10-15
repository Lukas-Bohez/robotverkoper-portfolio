<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CompanyTabs from '@/components/CompanyTabs.vue'
import type { Company, CompanyRole, List } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { sectionsFor } from '@/lib/preview'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const companyId = computed(() => String(route.params.id ?? ''))
const base = computed(() => `/companies/${encodeURIComponent(companyId.value)}`)

const company = ref<Company | null>(null)
const roles = ref<CompanyRole[]>([])
const selectedId = ref('')
const loading = ref(true)
const loadError = ref('')

const role = computed(() => roles.value.find((item) => item.id === selectedId.value) ?? null)
const roleName = computed(() => (role.value?.locked ? t('roles.admin') : (role.value?.name ?? '')))
const sections = computed(() => (role.value ? sectionsFor(role.value.permissions) : []))
const landing = computed(() => sections.value[0] ?? null)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    company.value = await api.get<Company>(base.value)
    roles.value = (await api.get<List<CompanyRole>>(`${base.value}/roles`)).items
    const wanted = typeof route.query.role === 'string' ? route.query.role : ''
    selectedId.value = roles.value.find((item) => item.id === wanted)?.id ?? roles.value[0]?.id ?? ''
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('preview.loadError'))
  } finally {
    loading.value = false
  }
}

function stop() {
  void router.push({ name: 'company-roles', params: { id: companyId.value } })
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <RouterLink :to="{ name: 'companies' }" class="text-sm text-primary underline">← {{ t('robots.back') }}</RouterLink>
    <p v-if="loading" role="status" data-testid="preview-loading">{{ t('preview.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="preview-error" />
    <template v-else>
      <h1 class="text-3xl font-semibold">{{ t('preview.title') }}</h1>
      <CompanyTabs :company-id="companyId" current="preview" />

      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning"
        role="status"
        data-testid="preview-banner"
      >
        <span>{{ t('preview.banner', { company: company?.name ?? '', role: roleName }) }}</span>
        <span class="flex items-center gap-4">
          <label class="flex items-center gap-2">
            <span>{{ t('preview.role') }}</span>
            <select v-model="selectedId" class="rounded-md border border-default bg-default px-2 py-1 text-default" data-testid="preview-role">
              <option v-for="item in roles" :key="item.id" :value="item.id">{{ item.locked ? t('roles.admin') : item.name }}</option>
            </select>
          </label>
          <UButton color="neutral" variant="outline" size="sm" data-testid="preview-stop" @click="stop">{{ t('preview.stop') }}</UButton>
        </span>
      </div>

      <p v-if="!landing" data-testid="preview-none">{{ t('preview.none') }}</p>
      <template v-else>
        <nav class="flex flex-wrap gap-2" :aria-label="t('preview.menu')" data-testid="preview-menu">
          <span
            v-for="id in sections"
            :key="id"
            :class="['rounded-md px-3 py-1 text-sm', id === landing ? 'bg-primary text-inverted' : 'bg-elevated text-muted']"
            data-testid="preview-section"
          >
            {{ t(`preview.sections.${id}`) }}
          </span>
        </nav>
        <section class="flex flex-col gap-4">
          <h2 class="text-2xl font-semibold" data-testid="preview-landing">{{ t(`preview.sections.${landing}`) }}</h2>
          <p class="text-muted">{{ t('preview.intro', { role: roleName }) }}</p>
          <UCard class="max-w-xl">
            <template #header>
              <h3 class="text-lg font-semibold">{{ t('preview.sample.order') }}</h3>
            </template>
            <p class="text-muted">{{ t('preview.sample.items') }}</p>
            <template #footer>
              <div class="flex items-center gap-4">
                <UButton disabled>{{ t('preview.sample.start') }}</UButton>
                <span class="text-xs text-muted">{{ t('preview.readOnly') }} · {{ t('preview.sample.note') }}</span>
              </div>
            </template>
          </UCard>
        </section>
      </template>
    </template>
  </div>
</template>
