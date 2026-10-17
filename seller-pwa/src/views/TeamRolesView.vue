<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SellerRole } from '@/api/types'
import PageTitle from '@/components/PageTitle.vue'
import RightsMatrix, { type MatrixRole } from '@/components/RightsMatrix.vue'
import RoleEditDialog from '@/components/RoleEditDialog.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { changedCells, changedRoles, languagesOf, matrixOf, missingLanguagesOf, rightRows, toggled, type Matrix, type RightRow } from '@/lib/roles'
import { useTeamStore } from '@/stores/team'

/** Screen 13: the table of rights of our own staff. Roles are data: the administrator changes what a technician may do. */
const { t, te, locale } = useI18n()
const team = useTeamStore()

const saved = ref<Matrix>({})
const current = ref<Matrix>({})
const editing = ref<SellerRole | null>(null)
const creating = ref(false)
const message = ref('')
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  await Promise.all([team.loadRoles(), team.loadPermissions()])
  saved.value = matrixOf(team.roles)
  current.value = matrixOf(team.roles)
}, () => t('teamRoles.loadError'))

onMounted(() => void run())
watch(locale, () => void run(true))

const rows = computed(() => rightRows(team.permissions, team.roles))
const roles = computed<MatrixRole[]>(() =>
  team.roles.map(role => ({
    id: role.id,
    name: role.name,
    locked: role.locked,
    languages: languagesOf(role).map(code => code.toUpperCase()).join(' · '),
    missing: missingLanguagesOf(role),
  })),
)
const cells = computed(() => changedCells(saved.value, current.value))

const rightLabel = (row: RightRow): string => {
  const path = row.extra ? `extraRights.${row.key.replace(':', '_')}` : `rights.${row.key.replace(':', '_')}`
  return te(path) ? t(path) : row.key
}
const groupLabel = (group: string): string => t(`rightGroups.${group}`)

async function save() {
  message.value = ''
  const ids = changedRoles(saved.value, current.value)
  const done = await action.run(async () => {
    for (const id of ids) await team.updateRole(id, { permissions: current.value[id] ?? [] })
    return true
  }, t('teamRoles.saveError'))
  if (done) {
    message.value = t('teamRoles.saved')
    await run(true)
  }
}

function undo() {
  current.value = matrixOf(team.roles)
  message.value = ''
}

async function afterEdit() {
  editing.value = null
  creating.value = false
  await run(true)
}
</script>

<template>
  <RouterLink :to="{ name: 'team' }" class="text-small text-(--figma-primary-text)">← {{ t('teamRoles.back') }}</RouterLink>
  <PageTitle :title="t('teamRoles.title')" :subtitle="t('teamRoles.intro')">
    <template #actions>
      <UButton data-testid="role-new" @click="creating = true">{{ t('teamRoles.newRole') }}</UButton>
    </template>
  </PageTitle>
  <UAlert color="primary" variant="subtle" :title="t('teamRoles.info')" />

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('teamRoles.loading')" data-testid="roles-loading">
    <USkeleton class="h-96 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="roles-error" />
  <template v-else>
    <div class="flex items-center justify-end">
      <span v-if="cells > 0" class="text-caption text-(--figma-warning-text)" data-testid="unsaved">{{ t('teamRoles.unsaved', { n: cells }) }}</span>
    </div>
    <RightsMatrix :roles="roles" :rows="rows" :matrix="current" :right-label="rightLabel" :group-label="groupLabel" @toggle="(id, key) => (current = toggled(current, id, key))">
      <template #role-actions="{ role }">
        <UButton size="xs" color="neutral" variant="outline" :data-testid="`role-edit-${role.id}`" @click="editing = team.roles.find(r => r.id === role.id) ?? null">
          {{ t('teamRoles.edit') }}
        </UButton>
      </template>
    </RightsMatrix>
    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="roles-save-error" />
    <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="roles-saved" />
    <div class="flex gap-4">
      <UButton :disabled="cells === 0" :loading="action.busy.value" data-testid="roles-save" @click="save">{{ t('common.save') }}</UButton>
      <UButton color="neutral" variant="outline" :disabled="cells === 0" data-testid="roles-undo" @click="undo">{{ t('teamRoles.undo') }}</UButton>
    </div>
  </template>

  <RoleEditDialog v-if="editing || creating" :role="editing" @close="((editing = null), (creating = false))" @saved="afterEdit" />
</template>
