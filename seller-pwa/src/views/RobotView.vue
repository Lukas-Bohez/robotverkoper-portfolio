<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Defect, Robot } from '@/api/types'
import AppDialog from '@/components/AppDialog.vue'
import CargoCard from '@/components/CargoCard.vue'
import CloseDefectDialog from '@/components/CloseDefectDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import QrCode from '@/components/QrCode.vue'
import RobotCondition from '@/components/RobotCondition.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import YearChips, { type YearFilter } from '@/components/YearChips.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { minutesBetween, relativeTime, shortDate, timeOfDay } from '@/lib/format'
import { useArchiveStore } from '@/stores/archive'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'
import { useRobotsStore } from '@/stores/robots'

/** Screen 11: one robot: its condition, what is inside, its history, and what can be done with it */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const me = useMeStore()
const robots = useRobotsStore()
const defects = useDefectsStore()
const archive = useArchiveStore()

const id = computed(() => String(route.params.id ?? ''))
const robot = ref<Robot | null>(null)
const open = ref<Defect | null>(null)
const history = ref<Defect[]>([])
const period = ref<YearFilter>({ year: new Date().getFullYear(), cold: false })
const showQr = ref(false)
const closing = ref(false)
const calling = ref(false)
const removing = ref(false)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  robot.value = await robots.find(id.value)
  if (!robot.value) return
  await defects.load({ onlyOpen: false, year: period.value.year, includeCold: period.value.cold })
  history.value = defects.items.filter(d => d.robot.id === id.value)
  open.value = history.value.find(d => d.id === robot.value?.openDefectId) ?? null
}, () => t('robot.loadError'))

onMounted(() => {
  void run()
  void archive.loadYears().catch(() => undefined)
})
watch(period, () => void run(true))

const kind = computed(() => (robot.value?.model ? t(`robots.kindsShort.${robot.value.model.kind}`) : ''))
const condition = computed(() => robot.value?.condition ?? null)

function print() {
  window.print()
}

async function callTechnician() {
  const d = open.value
  if (!d) return
  const done = await action.run(() => defects.callTechnician(d.id), t('call.error'))
  if (done) calling.value = false
}

async function putOutOfService() {
  const r = robot.value
  if (!r) return
  const done = await action.run(() => robots.remove(r.id), t('robots.outOfServiceError'))
  if (done) await router.push({ name: 'company-robots', params: { id: r.companyId ?? '' } })
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('robot.loading')" data-testid="robot-loading">
    <USkeleton class="h-10 w-72" />
    <USkeleton class="h-64 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="robot-error" />
  <p v-else-if="!robot" data-testid="robot-not-found">{{ t('robot.notFound') }}</p>
  <template v-else>
    <RouterLink
      v-if="robot.companyId"
      :to="{ name: 'company-robots', params: { id: robot.companyId } }"
      class="text-small text-(--figma-primary-text)"
      data-testid="back"
    >
      ← {{ t('robot.back') }}
    </RouterLink>
    <PageTitle :title="robot.name" :subtitle="t('robot.subtitle', { kind, serial: robot.serial, key: robot.apiKeyPrefix ?? '–' })">
      <template #badge><StatusBadge kind="robot" :value="robot.status" /></template>
    </PageTitle>

    <UAlert
      v-if="condition?.hasCargo"
      color="warning"
      variant="subtle"
      :title="t('robot.cargoAlert', { time: timeOfDay(condition.cargoSince, locale), minutes: condition.cargoSince ? minutesBetween(condition.cargoSince) : 0 })"
      data-testid="robot-cargo-alert"
    />
    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="robot-action-error" />

    <div class="grid gap-8 lg:grid-cols-[1fr_448px] lg:items-start">
      <div class="flex flex-col gap-8">
        <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8">
          <h2 class="text-card font-semibold">{{ t('condition.title') }}</h2>
          <RobotCondition :condition="condition" :battery="robot.battery" />
          <p v-if="!condition" class="text-small text-muted" data-testid="condition-unknown">{{ t('condition.noneKnown') }}</p>
        </section>
        <CargoCard v-if="condition?.hasCargo" :condition="condition" />
        <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="robot-history">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 class="text-card font-semibold">{{ t('robot.history') }}</h2>
            <YearChips v-model="period" :years="archive.years" />
          </div>
          <p v-if="history.length === 0" class="text-small text-muted" data-testid="history-empty">{{ t('robot.historyEmpty') }}</p>
          <ul v-else class="flex flex-col gap-3">
            <li v-for="d in history" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-default pb-3 last:border-b-0" data-testid="history-row">
              <div class="flex flex-col">
                <RouterLink :to="{ name: 'defect', params: { id: d.id } }" class="text-small font-medium">{{ d.summary }}</RouterLink>
                <span class="text-caption text-muted">{{ d.createdAt ? (new Date().getTime() - new Date(d.createdAt).getTime() < 86400000 ? relativeTime(d.createdAt, locale) : shortDate(d.createdAt, locale)) : '' }} · {{ d.reportedBy }}</span>
              </div>
              <StatusBadge kind="defect" :value="d.status" />
            </li>
          </ul>
        </section>
      </div>

      <aside class="flex flex-col gap-6 rounded-2xl border border-default bg-default p-8" data-testid="robot-actions">
        <h2 class="text-card font-semibold">{{ t('robot.actions') }}</h2>
        <template v-if="open">
          <p class="text-caption text-muted">{{ t('robot.repair') }}</p>
          <div v-if="me.can('defects:call')" class="flex flex-col gap-2">
            <strong class="text-small">{{ t('call.button') }}</strong>
            <span class="text-caption text-muted">{{ t('robot.callHint') }}</span>
            <UButton class="justify-center" size="lg" data-testid="robot-call" @click="calling = true">{{ t('call.button') }}</UButton>
          </div>
          <div v-if="me.can('robots:replace')" class="flex flex-col gap-2">
            <strong class="text-small">{{ t('robot.replaceTitle') }}</strong>
            <span class="text-caption text-muted">{{ t('robot.replaceHint') }}</span>
            <UButton color="neutral" variant="outline" size="lg" class="justify-center" :to="{ name: 'replace', params: { id: open.id } }" data-testid="robot-replace">{{ t('robot.replace') }}</UButton>
          </div>
          <div v-if="me.can('defects:close')" class="flex flex-col gap-2">
            <strong class="text-small">{{ t('defect.close') }}</strong>
            <span class="text-caption text-muted">{{ t('robot.closeHint') }}</span>
            <UButton color="neutral" variant="outline" size="lg" class="justify-center" data-testid="robot-close" @click="closing = true">{{ t('defect.close') }}</UButton>
          </div>
        </template>
        <p v-else class="text-small text-muted" data-testid="robot-no-defect">{{ t('robot.noDefect') }}</p>
        <hr class="border-default" />
        <p class="text-caption text-muted">{{ t('robot.manage') }}</p>
        <div class="flex flex-col gap-2">
          <strong class="text-small">{{ t('robot.qrTitle') }}</strong>
          <span class="text-caption text-muted">{{ t('robot.qrHint') }}</span>
          <UButton color="neutral" variant="outline" size="lg" class="justify-center" data-testid="robot-qr" @click="showQr = true">{{ t('robot.qrTitle') }}</UButton>
        </div>
        <div v-if="me.can('robots:archive') && !robot.deletedAt && !open" class="flex flex-col gap-2">
          <strong class="text-small">{{ t('robots.outOfService') }}</strong>
          <span class="text-caption text-muted">{{ t('robot.outHint') }}</span>
          <UButton color="neutral" variant="outline" size="lg" class="justify-center" data-testid="robot-remove" @click="removing = true">{{ t('robots.outOfService') }}</UButton>
        </div>
      </aside>
    </div>

    <AppDialog v-if="showQr" :title="t('robot.qrDialog', { name: robot.name })" testid="qr-dialog" @close="showQr = false">
      <div class="flex flex-col items-center gap-3 text-center">
        <QrCode :text="robot.qrCode" :label="t('robot.qrLabel', { serial: robot.serial })" />
        <strong>{{ robot.serial }}</strong>
        <span class="text-caption text-muted">{{ t('robot.qrStick') }}</span>
      </div>
      <div class="flex gap-4">
        <UButton data-testid="qr-print" @click="print">{{ t('robot.print') }}</UButton>
        <UButton color="neutral" variant="outline" data-testid="qr-close" @click="showQr = false">{{ t('common.close') }}</UButton>
      </div>
    </AppDialog>
    <CloseDefectDialog v-if="closing && open" :defect="open" @close="closing = false" @closed="((closing = false), run(true))" />
    <ConfirmDialog v-if="calling" :title="t('call.confirmTitle')" :message="t('call.confirmMessage')" :confirm-label="t('call.confirm')" :busy="action.busy.value" :error="action.error.value" @confirm="callTechnician" @cancel="calling = false" />
    <ConfirmDialog v-if="removing" :title="t('robots.outOfServiceTitle', { name: robot.name })" :message="t('robots.outOfServiceMessage')" :confirm-label="t('robots.outOfService')" tone="danger" :busy="action.busy.value" :error="action.error.value" @confirm="putOutOfService" @cancel="removing = false" />
  </template>
</template>
