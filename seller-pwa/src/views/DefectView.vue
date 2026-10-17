<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Defect, NearbyDefect } from '@/api/types'
import CargoCard from '@/components/CargoCard.vue'
import CloseDefectDialog from '@/components/CloseDefectDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DefectTimeline from '@/components/DefectTimeline.vue'
import MoreActionsSheet from '@/components/MoreActionsSheet.vue'
import PageTitle from '@/components/PageTitle.vue'
import RobotCondition from '@/components/RobotCondition.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useDefectRealtime } from '@/composables/useRealtime'
import { foodSafeUntil, routeUrl, walkingMinutes } from '@/lib/defects'
import { distanceLabel, minutesBetween, relativeTime, timeOfDay } from '@/lib/format'
import { isOpenStatus } from '@/lib/status'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'
import { usePlaceStore } from '@/stores/place'

/**
 * Screens 12 (computer) and 18 (phone): everything about one defect. What is wrong, in what condition the robot is
 * (food inside? tilted?), where it stands, who is on it, what happened so far, and other defects close by.
 * The administrator calls and decides here; the technician takes the defect and goes on site.
 */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const me = useMeStore()
const defects = useDefectsStore()
const place = usePlaceStore()

const id = computed(() => String(route.params.id ?? ''))
const defect = ref<Defect | null>(null)
const nearby = ref<NearbyDefect[]>([])
const notFound = ref(false)

const moreOpen = ref(false)
const closing = ref(false)
const callingTechnician = ref(false)
const askingHelp = ref(false)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  notFound.value = false
  defect.value = await defects.find(id.value)
  if (!defect.value) {
    notFound.value = true
    return
  }
  nearby.value = isOpenStatus(defect.value.status) ? await defects.nearby(id.value).catch(() => []) : []
}, () => t('defect.loadError'))

onMounted(async () => {
  await run()
  // Where the technician stands makes the distances work: ask once, then load again with them
  if (!place.point) void place.locate().then(() => (place.point ? run(true) : undefined))
})
useDefectRealtime(id.value, updated => (defect.value = { ...defect.value, ...updated }), () => run(true))

const open = computed(() => (defect.value ? isOpenStatus(defect.value.status) : false))
const mine = computed(() => defect.value?.assignedTo === me.me?.email)
const hasCargo = computed(() => defect.value?.condition?.hasCargo === true)
const minutesOpen = computed(() => (defect.value?.createdAt ? minutesBetween(defect.value.createdAt) : 0))
const place_ = computed(() => defect.value?.location ?? defect.value?.condition?.location ?? null)
const isTechnician = computed(() => me.home === 'tasks')

/** What the main button of a technician does next: take it, arrive, or go on with the work */
const next = computed<'claim' | 'arrive' | 'continue' | null>(() => {
  if (!defect.value || !open.value || !me.can('defects:claim')) return null
  if (defect.value.status === 'OPEN') return 'claim'
  if (!mine.value) return null
  return defect.value.status === 'EN_ROUTE' ? 'arrive' : 'continue'
})

async function doNext() {
  const current = defect.value
  if (!current || !next.value) return
  if (next.value === 'continue') return void router.push({ name: 'on-site', params: { id: current.id } })
  if (next.value === 'claim') {
    const done = await action.run(() => defects.claim(current.id), t('defect.claimError'))
    if (done) defect.value = done
    return
  }
  const arrived = await action.run(() => defects.arrive(current.id), t('defect.arriveError'))
  if (arrived) await router.push({ name: 'on-site', params: { id: current.id } })
}

async function callTechnician() {
  const current = defect.value
  if (!current) return
  const done = await action.run(() => defects.callTechnician(current.id), t('call.error'))
  if (done) {
    defect.value = done
    callingTechnician.value = false
  }
}

async function askHelp() {
  const current = defect.value
  if (!current) return
  const done = await action.run(() => defects.requestHelp(current.id), t('help.error'))
  if (done) {
    defect.value = done
    askingHelp.value = false
  }
}

async function takeAlong(other: NearbyDefect) {
  await action.run(() => defects.claim(other.defect.id), t('defect.claimError'))
  await run(true)
}

function openRoute() {
  moreOpen.value = false
  if (place_.value) window.open(routeUrl(place_.value), '_blank', 'noopener')
}

function onClosed(closedDefect: Defect) {
  closing.value = false
  defect.value = closedDefect
}

const reportedAgo = computed(() => (defect.value?.createdAt ? relativeTime(defect.value.createdAt, locale.value) : ''))
const technicianLine = computed(() => {
  const d = defect.value
  if (!d?.assignedTo) return t('defect.nobody')
  if (d.status === 'ON_SITE') return t('defect.technicianOnSite')
  if (d.status === 'EN_ROUTE')
    return d.distanceMeters != null ? t('defect.technicianEta', { minutes: walkingMinutes(d.distanceMeters) }) : t('defect.technicianEnRoute')
  return t(`defects.states.${d.status.toLowerCase()}`)
})
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('defect.loading')" data-testid="defect-loading">
    <USkeleton class="h-10 w-72" />
    <USkeleton class="h-40 w-full rounded-2xl" />
    <USkeleton class="h-64 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="defect-error" />
  <p v-else-if="notFound || !defect" data-testid="defect-not-found">{{ t('defect.notFound') }}</p>
  <template v-else>
    <RouterLink :to="{ name: isTechnician ? 'tasks' : 'defects' }" class="text-small text-(--figma-primary-text)" data-testid="back">
      ← {{ isTechnician ? t('defect.backTasks') : t('defect.backDefects') }}
    </RouterLink>

    <PageTitle :title="t('defect.title', { robot: defect.robot.name })" :subtitle="t('defect.subtitle', { company: defect.company.name, kind: defect.robot.model ? t(`robots.kindsShort.${defect.robot.model.kind}`) : '', ago: reportedAgo })">
      <template #badge><StatusBadge kind="defect" :value="defect.status" /></template>
      <template v-if="open && !isTechnician" #actions>
        <UButton v-if="me.can('robots:replace')" color="neutral" variant="outline" :to="{ name: 'replace', params: { id: defect.id } }" data-testid="action-replace">
          {{ t('defect.replace') }}
        </UButton>
        <UButton v-if="me.can('defects:close')" color="neutral" variant="outline" data-testid="action-close" @click="closing = true">
          {{ t('defect.close') }}
        </UButton>
      </template>
    </PageTitle>

    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="defect-action-error" />

    <!-- Food inside: the first thing anyone must know. The administrator calls, the technician takes it out. -->
    <UAlert
      v-if="hasCargo && open && defect.condition"
      color="warning"
      variant="subtle"
      :title="
        t(isTechnician ? 'defect.cargoAlertTechnician' : 'defect.cargoAlertAdmin', {
          time: timeOfDay(defect.condition.cargoSince, locale),
          minutes: defect.condition.cargoSince ? minutesBetween(defect.condition.cargoSince) : minutesOpen,
          until: defect.condition.cargoSince ? timeOfDay(foodSafeUntil(defect.condition.cargoSince), locale) : '',
        })
      "
      data-testid="cargo-alert"
    />

    <div class="grid gap-8 lg:grid-cols-[1fr_448px] lg:items-start">
      <div class="flex flex-col gap-8">
        <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="what-is-wrong">
          <h2 class="text-card font-semibold">{{ t('defect.whatTitle') }}</h2>
          <p class="text-body">{{ defect.summary }}</p>
          <div class="flex flex-wrap gap-2">
            <StatusBadge kind="severity" :value="defect.severity" />
            <UBadge v-if="defect.condition?.errorCode" color="neutral" variant="subtle">{{ defect.condition.errorCode }}</UBadge>
            <UBadge v-if="defect.condition?.tilted" color="neutral" variant="subtle">{{ t('defect.tiltSensor') }}</UBadge>
          </div>
          <p class="text-caption text-muted">{{ t('defect.reportedBy', { by: defect.reportedBy, time: timeOfDay(defect.createdAt, locale) }) }}</p>
          <p v-if="defect.resolutionNote" class="text-small" data-testid="defect-note">{{ t('defect.note', { note: defect.resolutionNote }) }}</p>
        </section>

        <section class="flex flex-col gap-4 md:rounded-2xl md:border md:border-default md:bg-default md:p-8" data-testid="condition-section">
          <h2 class="text-card font-semibold">{{ t('condition.title') }}</h2>
          <RobotCondition :condition="defect.condition ?? null" />
          <p v-if="!defect.condition" class="text-small text-muted" data-testid="condition-unknown">{{ t('condition.noneKnown') }}</p>
        </section>

        <CargoCard v-if="hasCargo && defect.condition" :condition="defect.condition" />
        <DefectTimeline :defect="defect" />
      </div>

      <div class="flex flex-col gap-8">
        <!-- Who is on it (computer: the administrator calls; the technician sees it on the dashboard) -->
        <section v-if="!isTechnician" class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-8" data-testid="technician-card">
          <h2 class="text-card font-semibold">{{ t('defect.technician') }}</h2>
          <p v-if="defect.assignedTo" class="text-small">{{ defect.assignedTo }}</p>
          <p class="text-small text-muted" data-testid="technician-line">{{ technicianLine }}</p>
          <p v-if="defect.callRequestedAt" class="text-caption text-muted">{{ t('defect.calledAt', { time: timeOfDay(defect.callRequestedAt, locale), by: defect.calledBy ?? '' }) }}</p>
          <p v-if="defect.helpRequestedAt" class="text-caption text-(--figma-warning-text)" data-testid="help-requested">{{ t('defect.helpAsked', { time: timeOfDay(defect.helpRequestedAt, locale) }) }}</p>
          <div v-if="open && me.can('defects:call')" class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" size="sm" data-testid="call-open" @click="callingTechnician = true">
              {{ defect.callRequestedAt ? t('defect.callAgain') : t('call.button') }}
            </UButton>
          </div>
        </section>

        <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="location-card">
          <h2 class="text-card font-semibold">{{ t('defect.location') }}</h2>
          <div v-if="place_" class="flex flex-col gap-4">
            <!-- The map is a placeholder with a pin (like the design); "Route openen" hands the address to the maps app -->
            <div class="flex h-32 items-center justify-center rounded-lg bg-elevated md:h-36" role="img" :aria-label="place_.address">
              <UIcon name="i-lucide-map-pin" class="size-8 text-(--figma-primary-text)" aria-hidden="true" />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-small font-medium" data-testid="location-address">{{ place_.address }}</span>
              <span class="text-caption text-muted">
                {{ defect.company.name }}<template v-if="defect.distanceMeters != null"> · {{ t('defect.away', { distance: distanceLabel(defect.distanceMeters, locale) }) }}</template>
              </span>
            </div>
            <UButton color="neutral" variant="outline" class="justify-center" data-testid="route-open" @click="openRoute">{{ t('moreActions.route') }}</UButton>
          </div>
          <p v-else class="text-small text-muted" data-testid="location-unknown">{{ t('defect.noLocation') }}</p>
        </section>

        <section v-if="nearby.length" class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="nearby-card">
          <h2 class="text-card font-semibold">{{ t('defect.nearbyTitle') }}</h2>
          <p class="text-caption text-muted">{{ t('defect.nearbyHint') }}</p>
          <ul class="flex flex-col gap-3">
            <li v-for="item in nearby" :key="item.defect.id" class="flex items-center justify-between gap-4 border-b border-default pb-3 last:border-b-0 last:pb-0" data-testid="nearby-item">
              <div class="flex flex-col gap-0.5">
                <span class="text-small font-medium">{{ item.defect.robot.name }}</span>
                <span class="text-caption text-muted">{{ item.defect.company.name }} · {{ item.defect.summary }} · {{ distanceLabel(item.distanceMeters, locale) }}</span>
              </div>
              <UButton v-if="isTechnician && me.can('defects:claim')" color="neutral" variant="outline" size="sm" data-testid="nearby-take" @click="takeAlong(item)">
                {{ t('defect.takeAlong') }}
              </UButton>
              <UButton v-else :to="{ name: 'defect', params: { id: item.defect.id } }" color="neutral" variant="outline" size="sm" data-testid="nearby-details">
                {{ t('defects.details') }}
              </UButton>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- The buttons of the technician stay at the bottom of the phone -->
    <div
      v-if="isTechnician && (next || open)"
      class="fixed inset-x-0 bottom-18 z-20 flex flex-col gap-2 border-t border-default bg-default p-4 md:static md:border-0 md:bg-transparent md:p-0"
      data-testid="technician-actions"
    >
      <UButton v-if="next" size="xl" class="justify-center" :loading="action.busy.value" data-testid="next-action" @click="doNext">
        {{ t(`defect.next.${next}`) }}
      </UButton>
      <UButton v-if="open" color="neutral" variant="outline" size="xl" class="justify-center" data-testid="more-actions-open" @click="moreOpen = true">
        {{ t('defect.moreActions') }}
      </UButton>
    </div>

    <MoreActionsSheet
      v-if="moreOpen"
      :can-replace="me.can('robots:replace')"
      :can-close="me.can('defects:close')"
      :can-help="me.can('defects:claim')"
      :has-route="Boolean(place_)"
      @close="moreOpen = false"
      @replace="router.push({ name: 'replace', params: { id: defect.id } })"
      @close-defect="((moreOpen = false), (closing = true))"
      @help="((moreOpen = false), (askingHelp = true))"
      @route="openRoute"
    />
    <CloseDefectDialog v-if="closing" :defect="defect" @close="closing = false" @closed="onClosed" />
    <ConfirmDialog
      v-if="callingTechnician"
      :title="t('call.confirmTitle')"
      :message="t('call.confirmMessage')"
      :confirm-label="t('call.confirm')"
      :busy="action.busy.value"
      :error="action.error.value"
      @confirm="callTechnician"
      @cancel="callingTechnician = false"
    />
    <ConfirmDialog
      v-if="askingHelp"
      :title="t('help.title')"
      :message="t('help.message', { robot: defect.robot.name })"
      :confirm-label="t('help.confirm')"
      :busy="action.busy.value"
      :error="action.error.value"
      @confirm="askHelp"
      @cancel="askingHelp = false"
    />
  </template>
</template>
