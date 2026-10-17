<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Matrix, RightRow } from '@/lib/roles'
import { has } from '@/lib/roles'

/**
 * The table of rights (screens 06 and 13): the rights are the rows, the roles the columns, and a cell is a checkbox.
 * A locked role (the administrator) shows everything ticked and cannot be changed. Used for the roles of a company and
 * for the roles of our own staff; the screen decides what a change does.
 */
export interface MatrixRole {
  id: string
  name: string
  locked: boolean
  /** "NL · EN · FR · DE": the languages in which the role has a name */
  languages: string
  /** The languages that still miss a name (a warning under the role) */
  missing: string[]
}

const props = defineProps<{
  roles: MatrixRole[]
  rows: RightRow[]
  matrix: Matrix
  rightLabel: (row: RightRow) => string
  groupLabel: (group: string) => string
  /** Show the key under the label (`tenant:manage`): handy for developers, hidden for customers */
  showKeys?: boolean
}>()
const emit = defineEmits<{ toggle: [roleId: string, key: string] }>()

const { t } = useI18n()

/** The rows grouped, in order: a heading row, then its rights */
function groups(): { group: string; rows: RightRow[] }[] {
  const result: { group: string; rows: RightRow[] }[] = []
  for (const row of props.rows) {
    const last = result.at(-1)
    if (last && last.group === row.group) last.rows.push(row)
    else result.push({ group: row.group, rows: [row] })
  }
  return result
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-default bg-default" data-testid="rights-matrix">
    <table class="w-full min-w-[720px] text-left text-small">
      <thead>
        <tr class="align-top">
          <th scope="col" class="w-[40%] px-6 py-4 text-caption font-normal text-muted">{{ t('matrix.right') }}</th>
          <th v-for="role in roles" :key="role.id" scope="col" class="px-2 py-4 text-center font-normal" data-testid="matrix-role">
            <div class="flex flex-col items-center gap-2">
              <span class="font-semibold" data-testid="matrix-role-name">{{ role.name }}</span>
              <span class="text-caption text-muted">{{ role.languages }}</span>
              <UBadge v-if="role.locked" color="neutral" variant="subtle">{{ t('matrix.locked') }}</UBadge>
              <UBadge v-else-if="role.missing.length" color="warning" variant="subtle" data-testid="matrix-missing">
                {{ t('matrix.missing', { languages: role.missing.map(code => code.toUpperCase()).join(' / ') }) }}
              </UBadge>
              <slot name="role-actions" :role="role" />
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="block in groups()" :key="block.group">
          <tr class="bg-elevated">
            <th scope="colgroup" :colspan="roles.length + 1" class="px-6 py-2 text-small font-semibold" data-testid="matrix-group">
              {{ groupLabel(block.group) }}
            </th>
          </tr>
          <tr v-for="row in block.rows" :key="row.key" class="border-t border-default" data-testid="matrix-row" :data-right="row.key">
            <th scope="row" class="px-6 py-3 font-normal">
              <div class="flex items-center gap-2">
                <div class="flex flex-col gap-0.5">
                  <span>{{ rightLabel(row) }}</span>
                  <span v-if="showKeys" class="text-caption text-muted">{{ row.key }}</span>
                </div>
                <UBadge v-if="row.extra" color="primary" variant="subtle">{{ t('matrix.extra') }}</UBadge>
              </div>
            </th>
            <td v-for="role in roles" :key="role.id" class="px-2 py-3 text-center">
              <UCheckbox
                :model-value="role.locked || has(matrix, role.id, row.key)"
                :disabled="role.locked"
                :aria-label="t('matrix.cell', { right: rightLabel(row), role: role.name })"
                :data-testid="`cell-${role.id}-${row.key}`"
                class="justify-center"
                @update:model-value="emit('toggle', role.id, row.key)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
