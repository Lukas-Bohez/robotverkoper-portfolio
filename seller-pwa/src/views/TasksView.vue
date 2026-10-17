<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Defect } from '@/api/types'
import PageTitle from '@/components/PageTitle.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useDefectsRealtime } from '@/composables/useRealtime'
import { byDistance, byUrgency, isMine } from '@/lib/defects'
import { dayLabel, distanceLabel, minutesBetween } from '@/lib/format'
import { isOpenStatus } from '@/lib/status'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'
import { usePlaceStore } from '@/stores/place'

/** Screen 17: the dashboard of the technician (a phone): my tasks, defects nearby, what needs to be done first */
const { t, locale } = useI18n()
const router = useRouter()
const me = useMeStore()
const defects = useDefectsStore()
const place = usePlaceStore()
const action = useAction()

const tab = ref<'mine' | 'near' | 'all'>('mine')
const resolvedToday = ref(0)
const email = computed(() => me.me?.email ?? '')

const { loading, error, run } = useLoad(() => defects.load({ onlyOpen: true }), () => t('tasks.loadError'))

async function loadAll() {
  await run()
  // "Vandaag opgelost": my own defects that were resolved today
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const open = [...defects.items]
  await defects.load({ onlyOpen: false, mine: true })
  resolvedToday.value = defects.items.filter(d => d.resolvedAt && new Date(d.resolvedAt) >= start).length
  defects.items = open
}

onMounted(() => {
  void loadAll()
  void place.locate().then(() => (place.point ? run(true) : undefined))
})
useDefectsRealtime(() => run(true))

const open = computed(() => defects.items.filter(d => isOpenStatus(d.status)))
const mine = computed(() => open.value.filter(d => isMine(d, email.value)))
const free = computed(() => open.value.filter(d => !d.assignedTo))
const near = computed(() => byDistance(free.value))
const cargo = computed(() => open.value.filter(d => d.condition?.hasCargo))
const urgent = computed(() => byUrgency(cargo.value)[0] ?? null)
const shown = computed(() => (tab.value === 'mine' ? mine.value : tab.value === 'near' ? near.value : byUrgency(open.value)))

function actionKey(d: Defect): 'claim' | 'arrive' | 'continue' {
  if (d.status === 'OPEN') return 'claim'
  return d.status === 'EN_ROUTE' ? 'arrive' : 'continue'
}

async function act(d: Defect) {
  const key = actionKey(d)
  if (key === 'continue') return void router.push({ name: 'on-site', params: { id: d.id } })
  if (key === 'claim') {
    await action.run(() => defects.claim(d.id), t('defect.claimError'))
    return
  }
  const done = await action.run(() => defects.arrive(d.id), t('defect.arriveError'))
  if (done) await router.push({ name: 'on-site', params: { id: d.id } })
}
</script>

<template>
  <PageTitle :title="t('tasks.title')" :subtitle="t('tasks.subtitle', { email, day: dayLabel(new Date(), locale) })" />

  <div class="grid grid-cols-2 gap-4" data-testid="stats">
    <StatTile tone="danger" :value="open.length" :label="t('tasks.statOpen')" />
    <StatTile :value="mine.length" :label="t('tasks.statMine')" />
    <StatTile tone="warning" :value="cargo.length" :label="t('tasks.statCargo')" />
    <StatTile tone="success" :value="resolvedToday" :label="t('tasks.statToday')" />
  </div>

  <UAlert
    v-if="urgent"
    color="warning"
    variant="subtle"
    :title="t('tasks.urgent', { robot: urgent.robot.name, minutes: urgent.condition?.cargoSince ? minutesBetween(urgent.condition.cargoSince) : 0 })"
    data-testid="tasks-urgent"
  />
  <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="tasks-action-error" />

  <div class="flex flex-wrap gap-2" role="group" :aria-label="t('tasks.filters')">
    <UButton
      v-for="key in (['mine', 'near', 'all'] as const)"
      :key="key"
      size="sm"
      class="rounded-full"
      :color="tab === key ? 'primary' : 'neutral'"
      :variant="tab === key ? 'subtle' : 'outline'"
      :aria-pressed="tab === key"
      :data-testid="`tab-${key}`"
      @click="tab = key"
    >
      {{ t(`tasks.tab.${key}`) }}
    </UButton>
  </div>

  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('tasks.loading')" data-testid="tasks-loading">
    <USkeleton v-for="n in 2" :key="n" class="h-36 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="tasks-error" />
  <template v-else>
    <h2 class="text-card font-semibold">{{ t(`tasks.heading.${tab}`) }}</h2>
    <p v-if="shown.length === 0" data-testid="tasks-empty">{{ t(`tasks.empty.${tab}`) }}</p>
    <ul class="flex flex-col gap-4" data-testid="task-list">
      <li
        v-for="d in shown"
        :key="d.id"
        :class="['flex flex-col gap-2 rounded-2xl border bg-default p-4', d.condition?.hasCargo ? 'border-(--figma-warning)' : 'border-default']"
        data-testid="task-card"
      >
        <div class="flex items-center justify-between gap-2">
          <RouterLink :to="{ name: 'defect', params: { id: d.id } }" class="text-body font-semibold" data-testid="task-link">{{ d.robot.name }}</RouterLink>
          <StatusBadge kind="defect" :value="d.status" />
        </div>
        <span class="text-small text-muted">
          {{ d.company.name }}<template v-if="d.distanceMeters != null"> · {{ distanceLabel(d.distanceMeters, locale) }}</template>
          <template v-if="d.createdAt"> · {{ t('tasks.minutesAgo', { n: minutesBetween(d.createdAt) }) }}</template>
        </span>
        <div class="flex flex-wrap gap-2">
          <UBadge color="error" variant="subtle">{{ d.summary }}</UBadge>
          <UBadge v-if="d.condition?.hasCargo" color="warning" variant="subtle">{{ t('defects.cargo') }}</UBadge>
        </div>
        <UButton
          v-if="me.can('defects:claim') && (d.status === 'OPEN' || isMine(d, email))"
          :color="d.status === 'OPEN' ? 'primary' : 'neutral'"
          :variant="d.status === 'OPEN' ? 'solid' : 'outline'"
          class="justify-center"
          :loading="action.busy.value"
          data-testid="task-action"
          @click="act(d)"
        >
          {{ t(`defect.next.${actionKey(d)}`) }}
        </UButton>
      </li>
    </ul>
  </template>
</template>
