<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiErrorMessage } from '@/lib/errors'
import { shortDate } from '@/lib/format'
import { useCompaniesStore } from '@/stores/companies'
import { useMeStore } from '@/stores/me'

const { t, locale } = useI18n()
const me = useMeStore()
const companies = useCompaniesStore()

const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await companies.load()
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('companies.loadError'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <!-- Design 02: title with "Nieuw bedrijf", a line of information and the table (cards on a phone) -->
  <section class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="flex flex-col gap-2">
      <h1 class="text-page font-semibold">{{ t('companies.title') }}</h1>
      <p class="hidden text-body text-muted md:block">{{ t('companies.intro') }}</p>
    </div>
    <UButton v-if="me.can('companies:create')" :to="{ name: 'company-new' }" class="justify-center" data-testid="new-company">
      {{ t('companies.newCompany') }}
    </UButton>
  </section>

  <UAlert class="hidden md:block" color="primary" variant="subtle" :title="t('companies.info')" data-testid="companies-info" />
  <UAlert
    v-if="companies.source === 'CACHE'"
    color="warning"
    variant="subtle"
    :title="t('common.cache')"
    data-testid="companies-cache"
  />

  <p v-if="loading" role="status" data-testid="companies-loading">{{ t('companies.loading') }}</p>
  <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="companies-error" />
  <p v-else-if="companies.items.length === 0" data-testid="companies-empty">{{ t('companies.empty') }}</p>
  <template v-else>
    <div class="table-card hidden md:block">
      <table data-testid="companies-table">
        <thead>
          <tr>
            <th scope="col" class="w-[18%]">{{ t('companies.name') }}</th>
            <th scope="col" class="w-[16%]">{{ t('companies.subdomain') }}</th>
            <th scope="col" class="w-[8%]">{{ t('companies.robots') }}</th>
            <th scope="col" class="w-[12%]">{{ t('companies.defects') }}</th>
            <th scope="col" class="w-[13%]">{{ t('companies.created') }}</th>
            <th scope="col"><span class="sr-only">{{ t('companies.open') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="company in companies.items" :key="company.id" data-testid="company-row">
            <td class="font-medium">{{ company.name }}</td>
            <td>{{ company.subdomain }}</td>
            <td data-testid="company-robot-count">{{ company.robotCount }}</td>
            <td>
              <UBadge :color="company.openDefects > 0 ? 'error' : 'success'" variant="subtle" data-testid="company-defects">
                {{ company.openDefects > 0 ? t('companies.defectCount', company.openDefects) : t('companies.noDefects') }}
              </UBadge>
            </td>
            <td>{{ shortDate(company.createdAt, locale) }}</td>
            <td>
              <div class="flex gap-2">
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
                <UButton
                  v-if="me.can('company-roles:manage')"
                  :to="{ name: 'company-roles', params: { id: company.id } }"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :aria-label="t('companies.openRolesOf', { name: company.name })"
                  data-testid="company-roles-link"
                >
                  {{ t('companies.openRoles') }}
                </UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul class="flex flex-col gap-4 md:hidden" data-testid="companies-cards">
      <li
        v-for="company in companies.items"
        :key="company.id"
        class="flex flex-col gap-2 rounded-2xl border border-default bg-default p-4"
        data-testid="company-card"
      >
        <span class="text-body">{{ company.name }}</span>
        <span class="text-small text-muted">{{ company.subdomain }} · {{ t('companies.robotCount', company.robotCount) }}</span>
        <UBadge class="self-start" :color="company.openDefects > 0 ? 'error' : 'success'" variant="subtle">
          {{ company.openDefects > 0 ? t('companies.defectCount', company.openDefects) : t('companies.noDefectsCard') }}
        </UBadge>
        <div class="mt-1 flex gap-3">
          <UButton
            :to="{ name: 'company-robots', params: { id: company.id } }"
            class="flex-1 justify-center"
            color="neutral"
            variant="outline"
            :aria-label="t('companies.openRobots', { name: company.name })"
          >
            {{ t('companies.open') }}
          </UButton>
          <UButton
            v-if="me.can('company-roles:manage')"
            :to="{ name: 'company-roles', params: { id: company.id } }"
            class="flex-1 justify-center"
            color="neutral"
            variant="outline"
            :aria-label="t('companies.openRolesOf', { name: company.name })"
            data-testid="company-card-roles-link"
          >
            {{ t('companies.openRoles') }}
          </UButton>
        </div>
      </li>
    </ul>
  </template>
</template>
