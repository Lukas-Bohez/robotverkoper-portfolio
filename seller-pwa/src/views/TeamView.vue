<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Account } from '@/api/types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import SelectField from '@/components/SelectField.vue'
import YearChips, { type YearFilter } from '@/components/YearChips.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { relativeTime, shortDate, translationKey } from '@/lib/format'
import { useArchiveStore } from '@/stores/archive'
import { useMeStore } from '@/stores/me'
import { useTeamStore } from '@/stores/team'

/** Screen 09: our own staff: who has which role (picked from a list), archive, and the log with a filter per year */
const { t, te, locale } = useI18n()
const me = useMeStore()
const team = useTeamStore()
const archive = useArchiveStore()

const showArchived = ref(false)
const period = ref<YearFilter>({ year: new Date().getFullYear(), cold: false })
const form = reactive({ email: '', roleKey: '' })
const archiving = ref<Account | null>(null)
const saved = ref('')
const add = useAction()
const change = useAction()

const { loading, error, run } = useLoad(async () => {
  await Promise.all([
    team.loadAccounts(showArchived.value),
    team.loadRoles(),
    me.can('audit:read') ? team.loadAudit({ year: period.value.year, includeCold: period.value.cold }) : Promise.resolve(),
  ])
  if (!form.roleKey && team.roles.length) form.roleKey = (team.roles.find(r => r.key === 'technician') ?? team.roles[0])!.key
}, () => t('team.loadError'))

onMounted(() => {
  void run()
  void archive.loadYears().catch(() => undefined)
})
watch([showArchived, period], () => void run(true))
watch(locale, () => void run(true))

const roleOptions = computed(() => team.roles.map(role => ({ value: role.key, label: role.name })))
const hint = computed(() => {
  const key = `team.roleHints.${form.roleKey}`
  return te(key) ? t(key) : t('team.roleHintDefault')
})

function hintFor(key: string | undefined): string {
  const path = `team.roleHints.${key ?? ''}`
  return te(path) ? t(path) : t('team.roleHintDefault')
}

async function onSubmit() {
  saved.value = ''
  const email = form.email.trim()
  const account = await add.run(() => team.add(email, form.roleKey), t('team.add.error'))
  if (!account) return
  saved.value = t('team.add.done', { email: account.email })
  form.email = ''
  await run(true)
}

async function archiveAccount() {
  const account = archiving.value
  if (!account) return
  const done = await change.run(() => team.remove(account.email), t('team.removeError'))
  if (done) {
    archiving.value = null
    await run(true)
  }
}

async function restore(account: Account) {
  await change.run(() => team.restore(account.email), t('team.restoreError'))
  await run(true)
}

function action(key: string): string {
  const path = `team.audit.actions.${translationKey(key)}`
  return te(path) ? t(path) : key
}

function when(iso: string): string {
  return Date.now() - new Date(iso).getTime() < 86_400_000 ? relativeTime(iso, locale.value) : shortDate(iso, locale.value)
}
</script>

<template>
  <PageTitle :title="t('team.title')" :subtitle="t('team.intro')">
    <template #actions>
      <UButton v-if="me.can('roles:manage')" color="neutral" variant="outline" :to="{ name: 'team-roles' }" data-testid="to-roles">{{ t('team.adjustRoles') }}</UButton>
      <UButton v-if="me.can('company-roles:manage')" color="neutral" variant="outline" :to="{ name: 'presets' }" data-testid="to-presets">{{ t('team.presets') }}</UButton>
      <UButton v-if="me.can('archive:read')" color="neutral" variant="outline" :to="{ name: 'archive' }" data-testid="to-archive">{{ t('team.archive') }}</UButton>
    </template>
  </PageTitle>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <USwitch v-model="showArchived" :label="t('team.showArchived')" data-testid="show-archived" />
    <span class="text-caption text-muted">{{ t('team.archivedNote') }}</span>
  </div>
  <UAlert v-if="change.error.value" color="error" variant="subtle" :title="change.error.value" data-testid="team-change-error" />

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('team.loading')" data-testid="team-loading">
    <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="team-error" />
  <div v-else class="grid gap-8 lg:grid-cols-[1fr_448px] lg:items-start">
    <div class="table-card">
      <table data-testid="accounts-table">
        <thead>
          <tr>
            <th scope="col">{{ t('team.email') }}</th>
            <th scope="col">{{ t('team.role') }}</th>
            <th scope="col">{{ t('team.addedBy') }}</th>
            <th scope="col">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in team.accounts" :key="account.id" data-testid="account-row">
            <td class="font-medium">
              {{ account.email }}
              <UBadge v-if="account.deletedAt" color="warning" variant="subtle" class="ml-2">{{ t('common.archived') }}</UBadge>
            </td>
            <td>
              <div class="flex flex-col items-start gap-1">
                <UBadge :color="account.role?.key === 'admin' ? 'primary' : 'neutral'" variant="subtle" data-testid="account-role">{{ account.role?.name ?? '–' }}</UBadge>
                <span class="text-small text-muted">{{ hintFor(account.role?.key) }}</span>
              </div>
            </td>
            <td class="text-small">{{ account.createdBy ?? t('team.fromSettings') }}</td>
            <td>
              <UButton
                v-if="account.deletedAt && me.can('archive:restore')"
                color="neutral"
                variant="outline"
                size="sm"
                data-testid="account-restore"
                @click="restore(account)"
              >
                {{ t('common.restore') }}
              </UButton>
              <UButton
                v-else-if="!account.deletedAt && account.createdBy && account.email !== me.me?.email"
                color="neutral"
                variant="outline"
                size="sm"
                :aria-label="t('team.archiveOf', { email: account.email })"
                data-testid="account-archive"
                @click="archiving = account"
              >
                {{ t('team.archiveButton') }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <form class="flex flex-col gap-6 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="account-form" @submit.prevent="onSubmit">
      <h2 class="text-card font-semibold">{{ t('team.add.title') }}</h2>
      <UFormField :label="t('team.add.email')" name="email">
        <UInput v-model="form.email" type="email" required class="w-full" size="xl" placeholder="nieuw@fabrikant.be" data-testid="account-email" />
      </UFormField>
      <SelectField v-model="form.roleKey" :label="t('team.add.role')" :options="roleOptions" :hint="hint" data-testid="account-role-select" />
      <UAlert v-if="add.error.value" color="error" variant="subtle" :title="add.error.value" data-testid="account-form-error" />
      <UAlert v-if="saved" color="success" variant="subtle" :title="saved" data-testid="account-saved" />
      <UButton type="submit" size="lg" class="justify-center" :loading="add.busy.value" :disabled="!form.email.trim() || !form.roleKey" data-testid="account-submit">
        {{ t('team.add.submit') }}
      </UButton>
    </form>
  </div>

  <section v-if="me.can('audit:read')" class="flex flex-col gap-4" data-testid="audit">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-section font-semibold">{{ t('team.audit.title') }}</h2>
      <YearChips v-model="period" :years="archive.years" />
    </div>
    <p v-if="team.audit.length === 0" data-testid="audit-empty">{{ t('team.audit.empty') }}</p>
    <div v-else class="table-card">
      <table>
        <thead>
          <tr><th scope="col">{{ t('team.audit.when') }}</th><th scope="col">{{ t('team.audit.who') }}</th><th scope="col">{{ t('team.audit.what') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="entry in team.audit" :key="entry.id" data-testid="audit-row">
            <td class="font-medium">{{ when(entry.createdAt) }}</td>
            <td>{{ entry.actor }}</td>
            <td>{{ action(entry.action) }}<template v-if="entry.detail"> · {{ entry.detail }}</template></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-caption text-muted">{{ t('team.audit.coldNote') }}</p>
  </section>

  <ConfirmDialog
    v-if="archiving"
    :title="t('team.archiveTitle')"
    :message="t('team.archiveMessage', { email: archiving.email })"
    :confirm-label="t('team.archiveButton')"
    tone="danger"
    :busy="change.busy.value"
    :error="change.error.value"
    @confirm="archiveAccount"
    @cancel="archiving = null"
  />
</template>
