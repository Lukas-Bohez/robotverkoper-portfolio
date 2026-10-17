<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Company } from '@/api/types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useDefectsRealtime } from '@/composables/useRealtime'
import { shortDate } from '@/lib/format'
import { useCompaniesStore } from '@/stores/companies'
import { useMeStore } from '@/stores/me'

const { t, locale } = useI18n()
const me = useMeStore()
const companies = useCompaniesStore()

const showArchived = ref(false)
const archiving = ref<Company | null>(null)
const restoring = ref<string | null>(null)
const action = useAction()

const { loading, error, run } = useLoad(() => companies.load(showArchived.value), () => t('companies.loadError'))
onMounted(() => void run())
watch(showArchived, () => void run())
// The numbers of open defects follow the API
useDefectsRealtime(() => run(true))

const summary = computed(() => {
  const active = companies.items.filter(company => !company.deletedAt)
  return t('companies.summary', {
    companies: active.length,
    defects: active.reduce((sum, company) => sum + company.openDefects, 0),
  })
})

async function archive() {
  const company = archiving.value
  if (!company) return
  const done = await action.run(() => companies.remove(company.id), t('companies.archiveError'))
  if (done) archiving.value = null
}

async function restore(company: Company) {
  restoring.value = company.id
  await action.run(() => companies.restore(company.id), t('companies.restoreError'))
  restoring.value = null
  await run(true)
}
</script>

<template>
  <!-- Design 02: title with "Nieuw bedrijf", a line of information and the table (cards on a phone) -->
  <PageTitle :title="t('companies.title')" :subtitle="t('companies.intro')">
    <template v-if="me.can('companies:create')" #actions>
      <UButton :to="{ name: 'company-new' }" class="justify-center" data-testid="new-company">{{ t('companies.newCompany') }}</UButton>
    </template>
  </PageTitle>

  <UAlert class="hidden md:block" color="primary" variant="subtle" :title="t('companies.info')" data-testid="companies-info" />
  <UAlert v-if="companies.source === 'CACHE'" color="warning" variant="subtle" :title="t('common.cache')" data-testid="companies-cache" />

  <div class="flex flex-wrap items-center justify-between gap-2">
    <USwitch v-model="showArchived" :label="t('companies.showArchived')" data-testid="show-archived" />
    <span class="text-caption text-muted" data-testid="companies-summary">{{ summary }}</span>
  </div>
  <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="companies-action-error" />

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('companies.loading')" data-testid="companies-loading">
    <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="companies-error" />
  <p v-else-if="companies.items.length === 0" data-testid="companies-empty">{{ t('companies.empty') }}</p>
  <template v-else>
    <div class="table-card hidden md:block">
      <table data-testid="companies-table">
        <thead>
          <tr>
            <th scope="col" class="w-[18%]">{{ t('companies.name') }}</th>
            <th scope="col" class="w-[14%]">{{ t('companies.subdomain') }}</th>
            <th scope="col" class="w-[8%]">{{ t('companies.robots') }}</th>
            <th scope="col" class="w-[12%]">{{ t('companies.defects') }}</th>
            <th scope="col" class="w-[13%]">{{ t('companies.created') }}</th>
            <th scope="col">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="company in companies.items" :key="company.id" data-testid="company-row">
            <td class="font-medium">
              {{ company.name }}
              <UBadge v-if="company.deletedAt" color="warning" variant="subtle" class="ml-2" data-testid="company-archived">{{ t('common.archived') }}</UBadge>
            </td>
            <td>{{ company.subdomain }}</td>
            <td data-testid="company-robot-count">{{ company.robotCount }}</td>
            <td>
              <UBadge :color="company.openDefects > 0 ? 'error' : 'success'" variant="subtle" data-testid="company-defects">
                {{ company.openDefects > 0 ? t('companies.defectCount', company.openDefects) : t('companies.noDefects') }}
              </UBadge>
            </td>
            <td>{{ shortDate(company.createdAt, locale) }}</td>
            <td>
              <div class="flex flex-wrap gap-2">
                <template v-if="!company.deletedAt">
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
                  <UButton
                    v-if="me.can('companies:archive')"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :aria-label="t('companies.archiveOf', { name: company.name })"
                    data-testid="company-archive"
                    @click="archiving = company"
                  >
                    {{ t('companies.archive') }}
                  </UButton>
                </template>
                <UButton
                  v-else-if="me.can('archive:restore')"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="restoring === company.id"
                  :aria-label="t('companies.restoreOf', { name: company.name })"
                  data-testid="company-restore"
                  @click="restore(company)"
                >
                  {{ t('common.restore') }}
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
        <div v-if="!company.deletedAt" class="mt-1 flex gap-3">
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
        <UBadge v-else color="warning" variant="subtle" class="self-start">{{ t('common.archived') }}</UBadge>
      </li>
    </ul>
  </template>

  <ConfirmDialog
    v-if="archiving"
    :title="t('companies.archiveTitle', { name: archiving.name })"
    :message="t('companies.archiveMessage')"
    :confirm-label="t('companies.archive')"
    tone="danger"
    :busy="action.busy.value"
    :error="action.error.value"
    @confirm="archive"
    @cancel="archiving = null"
  />
</template>
