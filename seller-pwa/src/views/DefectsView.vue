<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Defect } from '@/api/types'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import CloseDefectDialog from '@/components/CloseDefectDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import YearChips, { type YearFilter } from '@/components/YearChips.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useDefectsRealtime } from '@/composables/useRealtime'
import { distanceLabel } from '@/lib/format'
import { isOpenStatus } from '@/lib/status'
import { useArchiveStore } from '@/stores/archive'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'
import { usePlaceStore } from '@/stores/place'

const { t, locale } = useI18n()
const me = useMeStore()
const defects = useDefectsStore()
const archive = useArchiveStore()
const place = usePlaceStore()

type StatusFilter = 'open' | 'enroute' | 'resolved'
const filter = ref<StatusFilter>('open')
const period = ref<YearFilter>({ year: new Date().getFullYear(), cold: false })

/** The numbers on the chips come from the open defects, also while the resolved ones are shown */
const counts = ref({ open: 0, enroute: 0 })

const selected = ref<Defect | null>(null)
const replacementName = ref('')
const closing = ref<Defect | null>(null)
const calling = ref<Defect | null>(null)
const created = ref<{ robotId: string; robotName: string; apiKey: string } | null>(null)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  if (filter.value === 'resolved') {
    await defects.load({ onlyOpen: false, year: period.value.year, includeCold: period.value.cold })
    defects.items = defects.items.filter(defect => !isOpenStatus(defect.status))
  } else {
    await defects.load({ onlyOpen: true })
    counts.value = {
      open: defects.items.length,
      enroute: defects.items.filter(defect => defect.status === 'EN_ROUTE' || defect.status === 'ON_SITE').length,
    }
    if (filter.value === 'enroute') {
      defects.items = defects.items.filter(defect => defect.status === 'EN_ROUTE' || defect.status === 'ON_SITE')
    }
  }
  if (selected.value) selected.value = defects.items.find(defect => defect.id === selected.value?.id) ?? null
}, () => t('defects.loadError'))

onMounted(async () => {
  void place.locate().then(() => run(true))
  await Promise.all([run(), archive.loadYears().catch(() => undefined)])
})
watch([filter, period], () => void run())
useDefectsRealtime(() => run(true))

function choose(defect: Defect) {
  selected.value = defect
  replacementName.value = `${defect.robot.name}${t('defects.panel.suffix')}`
}

async function replaceWithNewRobot() {
  const defect = selected.value
  if (!defect) return
  const made = await action.run(
    () => defects.replace(defect.id, { name: replacementName.value.trim() || undefined }),
    t('defects.panel.error'),
  )
  if (!made) return
  created.value = { robotId: made.robot.id, robotName: made.robot.name, apiKey: made.apiKey }
  selected.value = null
  void run(true)
}

async function callTechnician() {
  const defect = calling.value
  if (!defect) return
  const done = await action.run(() => defects.callTechnician(defect.id), t('call.error'))
  if (done) calling.value = null
}

function onClosed() {
  closing.value = null
  selected.value = null
  void run(true)
}

const chips = computed(() => [
  { key: 'open' as const, label: counts.value.open ? t('defects.filters.openCount', { n: counts.value.open }) : t('defects.filters.open') },
  { key: 'enroute' as const, label: counts.value.enroute ? t('defects.filters.enrouteCount', { n: counts.value.enroute }) : t('defects.filters.enroute') },
  { key: 'resolved' as const, label: t('defects.filters.resolved') },
])

const hasPanel = computed(() => selected.value !== null && (me.can('robots:replace') || me.can('defects:close')))
</script>

<template>
  <!-- Design 07: the defects of all companies on the left, and the panel "Robot vervangen" on the right -->
  <PageTitle :title="t('defects.title')" :subtitle="t('defects.intro')" />

  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('defects.filters.label')" data-testid="status-chips">
      <UButton
        v-for="chip in chips"
        :key="chip.key"
        size="sm"
        :color="filter === chip.key ? 'primary' : 'neutral'"
        :variant="filter === chip.key ? 'subtle' : 'outline'"
        class="rounded-full"
        :aria-pressed="filter === chip.key"
        :data-testid="`status-${chip.key}`"
        @click="filter = chip.key"
      >
        {{ chip.label }}
      </UButton>
    </div>
    <YearChips v-model="period" :years="archive.years" />
  </div>

  <UAlert v-if="action.error.value && !selected" color="error" variant="subtle" :title="action.error.value" data-testid="defects-action-error" />

  <div :class="['grid gap-8', hasPanel ? 'lg:grid-cols-[1fr_448px] lg:items-start' : '']">
    <section class="flex flex-col gap-4">
      <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('defects.loading')" data-testid="defects-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-2xl" />
      </div>
      <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="defects-error" />
      <p v-else-if="defects.items.length === 0" data-testid="defects-empty">{{ filter === 'resolved' ? t('defects.emptyResolved') : t('defects.empty') }}</p>
      <template v-else>
        <div class="table-card hidden md:block">
          <table data-testid="defects-table">
            <thead>
              <tr>
                <th scope="col">{{ t('defects.robot') }}</th>
                <th scope="col">{{ t('defects.company') }}</th>
                <th scope="col">{{ t('defects.defect') }}</th>
                <th scope="col">{{ t('defects.status') }}</th>
                <th scope="col">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="defect in defects.items" :key="defect.id" data-testid="defect-row">
                <td class="font-medium">{{ defect.robot.name }}</td>
                <td>{{ defect.company.name }}</td>
                <td>
                  <div class="flex flex-col items-start gap-1">
                    <UBadge color="warning" variant="subtle">{{ defect.summary }}</UBadge>
                    <UBadge v-if="defect.condition?.hasCargo && isOpenStatus(defect.status)" color="warning" variant="subtle" data-testid="defect-cargo">
                      {{ t('defects.cargo') }}
                    </UBadge>
                  </div>
                </td>
                <td><StatusBadge kind="defect" :value="defect.status" /></td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <UButton :to="{ name: 'defect', params: { id: defect.id } }" color="neutral" variant="outline" size="sm" data-testid="defect-details">
                      {{ t('defects.details') }}
                    </UButton>
                    <UButton
                      v-if="isOpenStatus(defect.status) && (me.can('robots:replace') || me.can('defects:close'))"
                      :color="selected?.id === defect.id || defect.status !== 'OPEN' ? 'neutral' : 'primary'"
                      :variant="selected?.id === defect.id || defect.status !== 'OPEN' ? 'outline' : 'solid'"
                      size="sm"
                      :aria-label="t('defects.replaceFor', { name: defect.robot.name })"
                      data-testid="defect-replace"
                      @click="choose(defect)"
                    >
                      {{ t('defects.replace') }}
                    </UButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="flex flex-col gap-4 md:hidden" data-testid="defects-cards">
          <li v-for="defect in defects.items" :key="defect.id" class="flex flex-col gap-2 rounded-2xl border border-default bg-default p-4" data-testid="defect-card">
            <div class="flex items-center justify-between gap-2">
              <span class="text-body">{{ defect.robot.name }}</span>
              <StatusBadge kind="defect" :value="defect.status" />
            </div>
            <span class="text-small text-muted">
              {{ defect.company.name }}
              <template v-if="defect.distanceMeters != null"> · {{ distanceLabel(defect.distanceMeters, locale) }}</template>
            </span>
            <div class="flex flex-wrap gap-2">
              <UBadge color="warning" variant="subtle">{{ defect.summary }}</UBadge>
              <UBadge v-if="defect.condition?.hasCargo && isOpenStatus(defect.status)" color="warning" variant="subtle">{{ t('defects.cargo') }}</UBadge>
            </div>
            <UButton :to="{ name: 'defect', params: { id: defect.id } }" color="neutral" variant="outline" class="justify-center">{{ t('defects.details') }}</UButton>
          </li>
        </ul>
        <p class="text-caption text-muted">{{ t('defects.footnote') }}</p>
      </template>
    </section>

    <!-- The panel "Robot vervangen" (computer): replace with a new robot, close, or call a technician -->
    <aside v-if="hasPanel && selected" class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-8" data-testid="replace-panel">
      <h2 class="text-card font-semibold">{{ t('defects.panel.title') }}</h2>
      <p class="text-caption text-muted">{{ t('defects.panel.for', { robot: selected.robot.name, company: selected.company.name }) }}</p>
      <template v-if="me.can('robots:replace')">
        <UFormField :label="t('defects.panel.name')" name="name">
          <UInput v-model="replacementName" class="w-full" size="xl" data-testid="replace-name" />
        </UFormField>
        <UAlert color="primary" variant="subtle" :title="t('defects.panel.info')" />
        <UButton size="lg" class="justify-center" :loading="action.busy.value" data-testid="replace-submit" @click="replaceWithNewRobot">
          {{ t('defects.panel.submit') }}
        </UButton>
      </template>
      <UButton v-if="me.can('defects:close')" color="neutral" variant="outline" size="lg" class="justify-center" data-testid="replace-close" @click="closing = selected">
        {{ t('defects.panel.close') }}
      </UButton>
      <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="replace-error" />
      <template v-if="me.can('defects:call')">
        <p class="text-caption text-muted">{{ t('defects.panel.technician') }}</p>
        <UButton color="neutral" variant="outline" size="lg" class="justify-center" data-testid="replace-call" @click="calling = selected">
          {{ t('call.button') }}
        </UButton>
      </template>
      <UButton color="neutral" variant="ghost" size="sm" class="justify-center" data-testid="replace-cancel" @click="selected = null">
        {{ t('common.cancel') }}
      </UButton>
    </aside>
  </div>

  <ApiKeyDialog v-if="created" :robot-id="created.robotId" :robot-name="created.robotName" :api-key="created.apiKey" @close="created = null" />
  <CloseDefectDialog v-if="closing" :defect="closing" @close="closing = null" @closed="onClosed" />
  <ConfirmDialog
    v-if="calling"
    :title="t('call.confirmTitle')"
    :message="t('call.confirmMessage')"
    :confirm-label="t('call.confirm')"
    :busy="action.busy.value"
    :error="action.error.value"
    @confirm="callTechnician"
    @cancel="calling = null"
  />
</template>
