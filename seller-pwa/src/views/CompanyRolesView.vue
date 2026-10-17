<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Company, CompanyRole, RoleCopyResult } from '@/api/types'
import AppDialog from '@/components/AppDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import RightsMatrix, { type MatrixRole } from '@/components/RightsMatrix.vue'
import SelectField from '@/components/SelectField.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { changedCells, changedRoles, matrixOf, toggled, type Matrix, type RightRow } from '@/lib/roles'
import { permissionKey } from '@/lib/format'
import { useCompaniesStore } from '@/stores/companies'
import { useCompanyRolesStore } from '@/stores/companyRoles'

/**
 * Screen 06: the roles of one company as a table of rights (the company decides who gets which role). Roles have a name in
 * every language, can be copied to other companies, saved as a preset, and archived (never deleted).
 */
const { t, te, locale } = useI18n()
const route = useRoute()
const companies = useCompaniesStore()
const store = useCompanyRolesStore()

const companyId = computed(() => String(route.params.id ?? ''))
const company = ref<Company | null>(null)
const showArchived = ref(false)
const saved = ref<Matrix>({})
const current = ref<Matrix>({})
const message = ref('')
const copying = ref<CompanyRole | null>(null)
const target = ref('')
const applying = ref(false)
const presetId = ref('')
const creating = ref(false)
const newName = reactive({ nl: '', en: '' })
const outcome = ref<RoleCopyResult | null>(null)
const action = useAction()
const dialogAction = useAction()

const { loading, error, run } = useLoad(async () => {
  company.value = await companies.find(companyId.value)
  if (!company.value) return
  await Promise.all([store.load(companyId.value, showArchived.value), store.loadPermissions(), companies.load()])
  saved.value = matrixOf(store.roles)
  current.value = matrixOf(store.roles)
}, () => t('roles.loadError'))

onMounted(() => void run())
watch(showArchived, () => void run(true))
watch(locale, () => void run(true))

const nameOf = (role: CompanyRole): string => role.names?.[locale.value as 'nl'] || role.names?.en || role.name
const rows = computed<RightRow[]>(() =>
  store.permissions.map(key => ({ key, group: key.split(':')[0] ?? key, extra: false })),
)
const roles = computed<MatrixRole[]>(() =>
  store.roles.map(role => {
    const have = (['nl', 'en', 'fr', 'de'] as const).filter(code => (role.names?.[code] ?? '').trim() !== '')
    return {
      id: role.id,
      name: nameOf(role),
      locked: role.locked,
      languages: have.map(code => code.toUpperCase()).join(' · '),
      missing: role.locked ? [] : (['nl', 'en', 'fr', 'de'] as const).filter(code => !have.includes(code)),
    }
  }),
)
const cells = computed(() => changedCells(saved.value, current.value))
const otherCompanies = computed(() => companies.items.filter(c => c.id !== companyId.value && !c.deletedAt).map(c => ({ value: c.id, label: c.name })))
const presetOptions = computed(() => store.presets.map(p => ({ value: p.id, label: p.name })))

const rightLabel = (row: RightRow): string => (te(`permissions.${permissionKey(row.key)}`) ? t(`permissions.${permissionKey(row.key)}`) : row.key)
const groupLabel = (group: string): string => (te(`permissionGroups.${group}`) ? t(`permissionGroups.${group}`) : group)

async function save() {
  message.value = ''
  const ids = changedRoles(saved.value, current.value)
  const done = await action.run(async () => {
    for (const id of ids) await store.update(companyId.value, id, { permissions: current.value[id] ?? [] })
    return true
  }, t('roles.saveError'))
  if (done) {
    message.value = t('roles.saved')
    await run(true)
  }
}

function undo() {
  current.value = matrixOf(store.roles)
}

async function createRole() {
  const name = newName.nl.trim() || newName.en.trim()
  const made = await dialogAction.run(
    () => store.create(companyId.value, { name, names: { nl: newName.nl.trim() || null, en: newName.en.trim() || null }, permissions: [] }),
    t('roles.form.error'),
  )
  if (!made) return
  creating.value = false
  newName.nl = ''
  newName.en = ''
  await run(true)
}

async function copyRole() {
  const role = copying.value
  if (!role || !target.value) return
  const result = await dialogAction.run(() => store.copy(companyId.value, role.id, [target.value]), t('roles.copy.error'))
  if (result) {
    outcome.value = result
    copying.value = null
  }
}

async function applyPreset() {
  if (!presetId.value) return
  const result = await dialogAction.run(() => store.applyPresets([presetId.value], [companyId.value]), t('roles.apply.error'))
  if (result) {
    outcome.value = result
    applying.value = false
    await run(true)
  }
}

async function openApply() {
  await store.loadPresets()
  presetId.value = store.presets[0]?.id ?? ''
  applying.value = true
}

function openCopy(roleId: string) {
  copying.value = store.roles.find(r => r.id === roleId) ?? null
  target.value = otherCompanies.value[0]?.value ?? ''
}

async function archive(roleId: string) {
  await action.run(() => store.remove(companyId.value, roleId), t('roles.archiveError'))
  await run(true)
}

async function restore(roleId: string) {
  await action.run(() => store.restore(companyId.value, roleId), t('roles.restoreError'))
  await run(true)
}

async function saveAsPreset(roleId: string) {
  const made = await action.run(() => store.saveAsPreset(companyId.value, roleId), t('roles.presetError'))
  if (made) message.value = t('roles.presetSaved', { name: made.name })
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('roles.loading')" data-testid="roles-loading">
    <USkeleton class="h-10 w-72" />
    <USkeleton class="h-96 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="roles-error" />
  <p v-else-if="!company" data-testid="roles-not-found">{{ t('robots.notFound') }}</p>
  <template v-else>
    <RouterLink :to="{ name: 'companies' }" class="text-small text-(--figma-primary-text)">← {{ t('robots.back') }}</RouterLink>
    <PageTitle :title="t('roles.title', { name: company.name })" :subtitle="t('roles.intro')">
      <template #actions>
        <UButton color="neutral" variant="outline" data-testid="roles-apply" @click="openApply">{{ t('roles.applyPreset') }}</UButton>
        <UButton data-testid="role-new" @click="creating = true">{{ t('roles.newRole') }}</UButton>
      </template>
    </PageTitle>
    <UAlert color="primary" variant="subtle" :title="t('roles.info')" data-testid="roles-info" />
    <div class="flex flex-wrap items-center justify-between gap-2">
      <USwitch v-model="showArchived" :label="t('roles.showArchived')" data-testid="show-archived" />
      <div class="flex items-center gap-4">
        <RouterLink :to="{ name: 'role-preview', params: { id: company.id } }" class="text-small text-(--figma-primary-text)" data-testid="to-preview">{{ t('roles.preview') }}</RouterLink>
        <span v-if="cells > 0" class="text-caption text-(--figma-warning-text)" data-testid="unsaved">{{ t('teamRoles.unsaved', { n: cells }) }}</span>
        <span v-else class="text-caption text-muted">{{ t('roles.archiveNote') }}</span>
      </div>
    </div>

    <RightsMatrix :roles="roles" :rows="rows" :matrix="current" :right-label="rightLabel" :group-label="groupLabel" show-keys @toggle="(id, key) => (current = toggled(current, id, key))">
      <template #role-actions="{ role }">
        <template v-if="!role.locked">
          <template v-if="store.roles.find(r => r.id === role.id)?.archivedAt">
            <UBadge color="warning" variant="subtle">{{ t('common.archived') }}</UBadge>
            <UButton size="xs" color="neutral" variant="outline" :data-testid="`role-restore-${role.id}`" @click="restore(role.id)">{{ t('common.restore') }}</UButton>
          </template>
          <template v-else>
            <UButton size="xs" color="neutral" variant="outline" :data-testid="`role-copy-${role.id}`" @click="openCopy(role.id)">{{ t('roles.copy.button') }}</UButton>
            <UButton size="xs" color="neutral" variant="outline" :data-testid="`role-preset-${role.id}`" @click="saveAsPreset(role.id)">{{ t('roles.saveAsPreset') }}</UButton>
            <UButton size="xs" color="neutral" variant="ghost" :data-testid="`role-archive-${role.id}`" @click="archive(role.id)">{{ t('roles.archive') }}</UButton>
          </template>
        </template>
      </template>
    </RightsMatrix>

    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="roles-action-error" />
    <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="roles-message" />
    <UAlert v-if="outcome" :color="outcome.skipped.length ? 'warning' : 'success'" variant="subtle" :title="t('roles.outcome', { copied: outcome.copied, skipped: outcome.skipped.join(', ') || '–' })" data-testid="roles-outcome" />
    <div class="flex gap-4">
      <UButton :disabled="cells === 0" :loading="action.busy.value" data-testid="roles-save" @click="save">{{ t('common.save') }}</UButton>
      <UButton color="neutral" variant="outline" :disabled="cells === 0" data-testid="roles-undo" @click="undo">{{ t('teamRoles.undo') }}</UButton>
    </div>
  </template>

  <AppDialog v-if="creating" :title="t('roles.form.title')" testid="role-create" @close="creating = false">
    <form class="flex flex-col gap-4" @submit.prevent="createRole">
      <UFormField :label="t('roles.form.nameNl')"><UInput v-model="newName.nl" required maxlength="40" class="w-full" size="xl" data-testid="new-role-nl" /></UFormField>
      <UFormField :label="t('roles.form.nameEn')" :help="t('roleEdit.fallback')"><UInput v-model="newName.en" maxlength="40" class="w-full" size="xl" data-testid="new-role-en" /></UFormField>
      <UAlert v-if="dialogAction.error.value" color="error" variant="subtle" :title="dialogAction.error.value" />
      <div class="flex gap-4">
        <UButton type="submit" :loading="dialogAction.busy.value" :disabled="newName.nl.trim().length < 2" data-testid="new-role-submit">{{ t('roles.form.submit') }}</UButton>
        <UButton color="neutral" variant="outline" @click="creating = false">{{ t('common.cancel') }}</UButton>
      </div>
    </form>
  </AppDialog>

  <AppDialog v-if="copying" :title="t('roles.copy.title')" testid="role-copy-dialog" @close="copying = null">
    <div class="flex flex-col gap-4">
      <p class="text-small">{{ t('roles.copy.role', { name: nameOf(copying) }) }}</p>
      <SelectField v-model="target" :label="t('roles.copy.to')" :options="otherCompanies" data-testid="copy-target" />
      <UAlert color="primary" variant="subtle" :title="t('roles.copy.info')" />
      <UAlert v-if="dialogAction.error.value" color="error" variant="subtle" :title="dialogAction.error.value" />
      <div class="flex gap-4">
        <UButton :loading="dialogAction.busy.value" :disabled="!target" data-testid="copy-submit" @click="copyRole">{{ t('roles.copy.submit') }}</UButton>
        <UButton color="neutral" variant="outline" @click="copying = null">{{ t('common.cancel') }}</UButton>
      </div>
    </div>
  </AppDialog>

  <AppDialog v-if="applying" :title="t('roles.apply.title')" testid="preset-apply-dialog" @close="applying = false">
    <div class="flex flex-col gap-4">
      <p v-if="presetOptions.length === 0" class="text-small text-muted">{{ t('roles.apply.none') }}</p>
      <SelectField v-else v-model="presetId" :label="t('roles.apply.preset')" :options="presetOptions" data-testid="apply-preset" />
      <UAlert v-if="dialogAction.error.value" color="error" variant="subtle" :title="dialogAction.error.value" />
      <div class="flex gap-4">
        <UButton :loading="dialogAction.busy.value" :disabled="!presetId" data-testid="apply-submit" @click="applyPreset">{{ t('roles.apply.submit') }}</UButton>
        <UButton color="neutral" variant="outline" @click="applying = false">{{ t('common.cancel') }}</UButton>
      </div>
    </div>
  </AppDialog>
</template>
