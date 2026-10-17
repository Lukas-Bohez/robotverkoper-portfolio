<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ArchivedItem, ArchiveKind } from '@/api/types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import YearChips, { type YearFilter } from '@/components/YearChips.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { shortDate } from '@/lib/format'
import { useArchiveStore } from '@/stores/archive'
import { useMeStore } from '@/stores/me'

/** Screen 16: the archive. Nothing is really deleted: everything archived is kept here and can be restored. */
const { t, locale } = useI18n()
const me = useMeStore()
const archive = useArchiveStore()

const KINDS: { key: string; kind: ArchiveKind | null }[] = [
  { key: 'accounts', kind: 'ACCOUNT' },
  { key: 'roles', kind: 'SELLER_ROLE' },
  { key: 'presets', kind: 'ROLE_PRESET' },
  { key: 'robots', kind: 'ROBOT' },
  { key: 'companies', kind: 'COMPANY' },
  { key: 'defects', kind: 'DEFECT' },
]
const kind = ref<ArchiveKind>('ACCOUNT')
const period = ref<YearFilter>({ year: new Date().getFullYear(), cold: false })
const restoring = ref<ArchivedItem | null>(null)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  await archive.load({ kind: kind.value, year: period.value.year })
}, () => t('archive.loadError'))
onMounted(() => {
  void run()
  void archive.loadYears().catch(() => undefined)
})
watch([kind, period], () => void run())

const summary = computed(() => t('archive.summary', { n: archive.items.length, year: period.value.year ?? t('years.cold').toLowerCase() }))

async function restore() {
  const item = restoring.value
  if (!item) return
  const done = await action.run(async () => (await archive.restore(item.kind, item.id), true), t('archive.restoreError'))
  if (done) restoring.value = null
}
</script>

<template>
  <PageTitle :title="t('archive.title')" :subtitle="t('archive.intro')" />
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('archive.kinds')" data-testid="kind-chips">
      <UButton
        v-for="item in KINDS"
        :key="item.key"
        size="sm"
        class="rounded-full"
        :color="kind === item.kind ? 'primary' : 'neutral'"
        :variant="kind === item.kind ? 'subtle' : 'outline'"
        :aria-pressed="kind === item.kind"
        :data-testid="`kind-${item.key}`"
        @click="kind = item.kind as ArchiveKind"
      >
        {{ t(`archive.kind.${item.key}`) }}
      </UButton>
    </div>
    <YearChips v-model="period" :years="archive.years" />
  </div>
  <UAlert color="primary" variant="subtle" :title="t('archive.coldInfo')" />

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('archive.loading')" data-testid="archive-loading">
    <USkeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="archive-error" />
  <p v-else-if="archive.items.length === 0" data-testid="archive-empty">{{ t('archive.empty') }}</p>
  <div v-else class="table-card">
    <table data-testid="archive-table">
      <thead>
        <tr>
          <th scope="col">{{ t('archive.what') }}</th>
          <th scope="col">{{ t('archive.type') }}</th>
          <th scope="col">{{ t('archive.when') }}</th>
          <th scope="col">{{ t('archive.by') }}</th>
          <th scope="col">{{ t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in archive.items" :key="`${item.kind}-${item.id}`" data-testid="archive-row">
          <td class="font-medium">{{ item.label }}</td>
          <td><UBadge color="neutral" variant="subtle">{{ t(`archive.kindOne.${item.kind.toLowerCase()}`) }}</UBadge></td>
          <td>{{ shortDate(item.archivedAt, locale) }}</td>
          <td>{{ item.archivedBy ?? '–' }}</td>
          <td>
            <UButton v-if="me.can('archive:restore')" color="neutral" variant="outline" size="sm" :aria-label="t('archive.restoreOf', { name: item.label })" data-testid="archive-restore" @click="restoring = item">
              {{ t('common.restore') }}
            </UButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p class="text-caption text-muted" data-testid="archive-summary">{{ summary }}</p>

  <ConfirmDialog
    v-if="restoring"
    :title="t('archive.restoreTitle', { name: restoring.label })"
    :message="t('archive.restoreMessage')"
    :confirm-label="t('common.restore')"
    :busy="action.busy.value"
    :error="action.error.value"
    @confirm="restore"
    @cancel="restoring = null"
  />
</template>
