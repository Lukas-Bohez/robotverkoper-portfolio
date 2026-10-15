<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Company, List, Source } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { shortDate } from '@/lib/format'
import { useMeStore } from '@/stores/me'

const { t, locale } = useI18n()
const me = useMeStore()

const companies = ref<Company[]>([])
const source = ref<Source>('platform')
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get<List<Company>>('/companies')
    companies.value = data.items
    source.value = data.source ?? 'platform'
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('companies.loadError'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-semibold">{{ t('companies.title') }}</h1>
        <p class="text-muted">{{ t('companies.intro') }}</p>
      </div>
      <UButton v-if="me.can('companies:create')" :to="{ name: 'company-new' }" data-testid="new-company">
        {{ t('companies.newCompany') }}
      </UButton>
    </section>

    <UAlert color="primary" variant="subtle" :title="t('companies.info')" data-testid="companies-info" />
    <UAlert v-if="source === 'cache'" color="warning" variant="subtle" :title="t('common.cache')" data-testid="companies-cache" />

    <p v-if="loading" role="status" data-testid="companies-loading">{{ t('companies.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="companies-error" />
    <p v-else-if="companies.length === 0" data-testid="companies-empty">{{ t('companies.empty') }}</p>
    <template v-else>
      <div class="hidden overflow-x-auto rounded-xl border border-default md:block">
        <table class="w-full text-left text-sm" data-testid="companies-table">
          <thead class="bg-elevated text-muted">
            <tr>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('companies.name') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('companies.subdomain') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('companies.robots') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('companies.defects') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('companies.created') }}</th>
              <th scope="col" class="px-4 py-3"><span class="sr-only">{{ t('companies.open') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in companies" :key="company.id" class="border-t border-default" data-testid="company-row">
              <td class="px-4 py-3 font-medium">{{ company.name }}</td>
              <td class="px-4 py-3">{{ company.subdomain }}</td>
              <td class="px-4 py-3" data-testid="company-robot-count">{{ company.robotCount }}</td>
              <td class="px-4 py-3">
                <UBadge
                  :color="company.openDefects > 0 ? 'error' : 'success'"
                  variant="subtle"
                  data-testid="company-defects"
                >
                  {{ company.openDefects > 0 ? t('companies.defectCount', company.openDefects) : t('companies.noDefects') }}
                </UBadge>
              </td>
              <td class="px-4 py-3">{{ shortDate(company.createdAt, locale) }}</td>
              <td class="px-4 py-3 text-right">
                <UButton
                  :to="{ name: 'company-robots', params: { id: company.id } }"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :aria-label="t('companies.openRobots', { name: company.name })"
                  data-testid="company-robots-link"
                >
                  {{ t('companies.open') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="flex flex-col gap-4 md:hidden" data-testid="companies-cards">
        <li
          v-for="company in companies"
          :key="company.id"
          class="flex flex-col gap-2 rounded-xl border border-default p-4"
          data-testid="company-card"
        >
          <span class="text-lg font-medium">{{ company.name }}</span>
          <span class="text-sm text-muted">
            {{ company.subdomain }} · {{ t('companies.robotCount', company.robotCount) }}
          </span>
          <UBadge
            class="self-start"
            :color="company.openDefects > 0 ? 'error' : 'success'"
            variant="subtle"
          >
            {{ company.openDefects > 0 ? t('companies.defectCount', company.openDefects) : t('companies.noDefects') }}
          </UBadge>
          <UButton
            :to="{ name: 'company-robots', params: { id: company.id } }"
            color="neutral"
            variant="outline"
            block
            :aria-label="t('companies.openRobots', { name: company.name })"
          >
            {{ t('companies.open') }}
          </UButton>
        </li>
      </ul>
    </template>
  </div>
</template>
