<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Defect, Robot } from '@/api/types'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import QrScanner from '@/components/QrScanner.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { parseRobotCode } from '@/lib/qr'
import { useDefectsStore } from '@/stores/defects'
import { useRobotsStore } from '@/stores/robots'

/**
 * Screens 20 to 23: replacing a robot with QR codes. Step 1 scan the old robot (so we know the technician stands at the
 * right one), step 2 scan the new robot from the warehouse, step 3 confirm. The new robot takes the name and company of
 * the old one and gets a new key; the old key stops working.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const defects = useDefectsStore()
const robots = useRobotsStore()

const id = computed(() => String(route.params.id ?? ''))
const defect = ref<Defect | null>(null)
const step = ref<1 | 2 | 3 | 4>(1)
const newRobot = ref<Robot | null>(null)
const message = ref('')
const action = useAction()
const result = ref<{ robotName: string; robotId: string; apiKey: string } | null>(null)
const keyDialog = ref(false)

const { loading, error, run } = useLoad(async () => {
  defect.value = await defects.find(id.value)
}, () => t('defect.loadError'))
onMounted(() => void run())

const oldSerial = computed(() => defect.value?.robot.serial ?? '')
const sameKind = computed(() => newRobot.value?.model?.kind === defect.value?.robot.model?.kind)

async function scannedOld(text: string) {
  message.value = ''
  const code = parseRobotCode(text)
  if (!code) return void (message.value = t('replace.notOurs'))
  if (code !== oldSerial.value) return void (message.value = t('replace.wrongOld', { serial: oldSerial.value }))
  step.value = 2
}

async function scannedNew(text: string) {
  message.value = ''
  const code = parseRobotCode(text)
  if (!code) return void (message.value = t('replace.notOurs'))
  const robot = await action.run(() => robots.byCode(code), t('replace.lookupError'))
  if (!robot) return void (message.value = t('replace.unknown', { serial: code }))
  if (!robot.inStock) return void (message.value = t('replace.notInStock', { serial: code }))
  newRobot.value = robot
}

async function confirm() {
  const current = defect.value
  const robot = newRobot.value
  if (!current || !robot) return
  const done = await action.run(() => defects.replace(current.id, { code: robot.serial }), t('replace.error'))
  if (!done) return
  result.value = { robotName: done.robot.name, robotId: done.robot.id, apiKey: done.apiKey }
  step.value = 4
  keyDialog.value = true
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('defect.loading')">
    <USkeleton class="h-10 w-48" />
    <USkeleton class="h-72 w-full rounded-3xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" />
  <p v-else-if="!defect" data-testid="replace-not-found">{{ t('defect.notFound') }}</p>
  <template v-else-if="step === 4 && result">
    <!-- Screen 23: done -->
    <div class="flex flex-col items-center gap-4 pt-6 text-center" data-testid="replace-done">
      <span class="flex size-20 items-center justify-center rounded-3xl bg-(--figma-success-soft)">
        <UIcon name="i-lucide-check" class="size-10 text-(--figma-success-text)" aria-hidden="true" />
      </span>
      <h1 class="text-section font-semibold">{{ t('replace.doneTitle') }}</h1>
      <p class="text-small text-muted">{{ t('replace.doneText', { robot: defect.robot.name, company: defect.company.name }) }}</p>
    </div>
    <div class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4">
      <div class="flex items-center justify-between"><span class="text-muted">{{ t('replace.oldRobot') }}</span><UBadge color="neutral" variant="subtle">{{ t('replace.retired') }}</UBadge></div>
      <div class="flex items-center justify-between"><span class="text-muted">{{ t('replace.newRobot') }}</span><UBadge color="success" variant="subtle">{{ t('robots.states.online') }}</UBadge></div>
      <div class="flex items-center justify-between"><span class="text-muted">{{ t('replace.defect') }}</span><UBadge color="primary" variant="subtle">{{ t('replace.defectClosed') }}</UBadge></div>
    </div>
    <UButton size="xl" class="justify-center" data-testid="replace-back-tasks" @click="router.push({ name: 'home' })">{{ t('replace.backToStart') }}</UButton>
    <UButton color="neutral" variant="outline" size="xl" class="justify-center" @click="router.push({ name: 'defects' })">{{ t('replace.nextDefect') }}</UButton>
    <ApiKeyDialog v-if="keyDialog" :robot-id="result.robotId" :robot-name="result.robotName" :api-key="result.apiKey" @close="keyDialog = false" />
  </template>
  <template v-else>
    <RouterLink v-if="step === 1" :to="{ name: 'defect', params: { id: defect.id } }" class="text-small text-(--figma-primary-text)">← {{ t('replace.backDefect') }}</RouterLink>
    <button v-else type="button" class="w-fit text-small text-(--figma-primary-text)" @click="step = (step - 1) as 1 | 2 | 3">← {{ t('replace.backStep') }}</button>
    <PageTitle :title="t('replace.title')" :subtitle="`${defect.robot.name} · ${defect.company.name}`" />

    <div class="flex flex-col gap-2" data-testid="stepper">
      <div class="flex gap-2"><span v-for="n in 3" :key="n" :class="['h-1 flex-1 rounded-full', n <= step ? 'bg-primary' : 'bg-accented']" /></div>
      <p class="text-small"><strong>{{ t('replace.step', { n: step }) }}</strong> <span class="text-muted">{{ t(`replace.steps.${step}`) }}</span></p>
    </div>

    <UAlert v-if="message" color="warning" variant="subtle" :title="message" data-testid="replace-message" />
    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="replace-error" />

    <template v-if="step === 1">
      <QrScanner :prompt="t('replace.scanOld')" :manual-label="t('scanner.enter')" @scanned="scannedOld" />
      <UAlert color="primary" variant="subtle" :title="t('replace.whyOld')" />
    </template>

    <template v-else-if="step === 2">
      <template v-if="!newRobot">
        <QrScanner :prompt="t('replace.scanNew')" :manual-label="t('scanner.enter')" @scanned="scannedNew" />
      </template>
      <template v-else>
        <div class="flex flex-col items-center gap-3 rounded-3xl bg-slate-900 p-8 text-white">
          <span class="flex size-16 items-center justify-center rounded-2xl bg-green-600"><UIcon name="i-lucide-check" class="size-8" aria-hidden="true" /></span>
          <strong>{{ t('replace.found', { serial: newRobot.serial }) }}</strong>
        </div>
        <section class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4" data-testid="new-robot-card">
          <h2 class="text-card font-semibold">{{ t('replace.newRobot') }}</h2>
          <div class="flex justify-between"><span class="text-muted">{{ t('replace.serial') }}</span><strong>{{ newRobot.serial }}</strong></div>
          <div class="flex justify-between"><span class="text-muted">{{ t('robots.model') }}</span><strong>{{ newRobot.model?.name }}</strong></div>
          <div class="flex justify-between"><span class="text-muted">{{ t('robots.status') }}</span><strong>{{ t('robots.states.stock') }}</strong></div>
          <div class="flex justify-between"><span class="text-muted">{{ t('robots.battery') }}</span><strong>{{ newRobot.battery == null ? '–' : `${newRobot.battery}%` }}</strong></div>
        </section>
        <UAlert v-if="sameKind" color="success" variant="subtle" :title="t('replace.sameKind', { robot: defect.robot.name })" data-testid="replace-same-kind" />
        <UAlert v-else color="error" variant="subtle" :title="t('replace.otherKind')" data-testid="replace-other-kind" />
        <UButton size="xl" class="justify-center" :disabled="!sameKind" data-testid="replace-next" @click="step = 3">{{ t('replace.next') }}</UButton>
        <UButton color="neutral" variant="outline" size="xl" class="justify-center" data-testid="replace-rescan" @click="newRobot = null">{{ t('replace.rescan') }}</UButton>
      </template>
    </template>

    <template v-else>
      <section class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4">
        <div class="flex items-center justify-between"><h2 class="text-card font-semibold">{{ t('replace.oldRobot') }}</h2><UBadge color="error" variant="subtle">{{ t('replace.willRetire') }}</UBadge></div>
        <p class="font-semibold">{{ defect.robot.name }} ({{ defect.robot.serial }})</p>
        <p class="text-small text-muted">{{ t('replace.oldKeyStops') }}</p>
      </section>
      <section v-if="newRobot" class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4">
        <div class="flex items-center justify-between"><h2 class="text-card font-semibold">{{ t('replace.newRobot') }}</h2><UBadge color="success" variant="subtle">{{ t('replace.takesOver') }}</UBadge></div>
        <p class="font-semibold">{{ newRobot.serial }}</p>
        <p class="text-small text-muted">{{ t('replace.newGets', { robot: defect.robot.name, company: defect.company.name }) }}</p>
      </section>
      <UAlert color="primary" variant="subtle" :title="t('replace.dataStays')" />
      <UButton size="xl" class="justify-center" :loading="action.busy.value" data-testid="replace-confirm" @click="confirm">{{ t('replace.confirm') }}</UButton>
      <UButton color="neutral" variant="outline" size="xl" class="justify-center" @click="step = 2">{{ t('replace.back') }}</UButton>
    </template>
  </template>
</template>
