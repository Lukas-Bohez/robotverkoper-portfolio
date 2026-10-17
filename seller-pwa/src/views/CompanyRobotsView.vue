<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Company, Robot } from '@/api/types'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import ReportDefectDialog from '@/components/ReportDefectDialog.vue'
import SelectField from '@/components/SelectField.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { useDefectsRealtime } from '@/composables/useRealtime'
import { useCompaniesStore } from '@/stores/companies'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'
import { useRobotsStore } from '@/stores/robots'

const { t } = useI18n()
const route = useRoute()
const me = useMeStore()
const companies = useCompaniesStore()
const robots = useRobotsStore()
const defects = useDefectsStore()

const companyId = computed(() => String(route.params.id ?? ''))
const company = ref<Company | null>(null)
const notFound = ref(false)
const showOutOfService = ref(false)

const form = reactive({ name: '', modelId: '' })
const create = useAction()
const created = ref<{ robotId: string; robotName: string; apiKey: string } | null>(null)
const reporting = ref<Robot | null>(null)
const calling = ref<Robot | null>(null)
const change = useAction()

const canSubmit = computed(() => form.name.trim().length >= 2 && form.modelId !== '' && !create.busy.value)
const modelOptions = computed(() =>
  robots.models.map(model => ({ value: model.id, label: `${model.name} (${t(`robots.kinds.${model.kind}`)})` })),
)
const summary = computed(() =>
  t('robots.summary', {
    robots: robots.items.filter(robot => !robot.deletedAt).length,
    defects: robots.items.filter(robot => robot.status === 'DEFECT').length,
  }),
)

const { loading, error, run } = useLoad(async () => {
  notFound.value = false
  company.value = await companies.find(companyId.value)
  if (!company.value) {
    notFound.value = true
    return
  }
  await Promise.all([robots.loadModels(), robots.load(companyId.value, showOutOfService.value)])
  if (!form.modelId && robots.models[0]) form.modelId = robots.models[0].id
}, () => t('robots.loadError'))

onMounted(() => void run())
watch(showOutOfService, () => void run(true))
watch(companyId, () => void run())
useDefectsRealtime(() => run(true))

async function onSubmit() {
  if (!canSubmit.value) return
  const made = await create.run(() => robots.create(companyId.value, { name: form.name.trim(), modelId: form.modelId }), t('robots.new.error'))
  if (!made) return
  created.value = { robotId: made.robot.id, robotName: made.robot.name, apiKey: made.apiKey }
  form.name = ''
  await run(true)
}

async function callTechnician() {
  const robot = calling.value
  if (!robot?.openDefectId) return
  const defectId = robot.openDefectId
  const done = await change.run(() => defects.callTechnician(defectId), t('robots.callError'))
  if (done) calling.value = null
}

async function restore(robot: Robot) {
  await change.run(() => robots.restore(robot.id), t('robots.restoreError'))
  await run(true)
}

function onReported() {
  reporting.value = null
  void run(true)
}
</script>

<template>
  <template v-if="loading">
    <div class="flex flex-col gap-3" role="status" :aria-label="t('robots.loading')" data-testid="robots-loading">
      <USkeleton class="h-10 w-72" />
      <USkeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-2xl" />
    </div>
  </template>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" data-testid="robots-error" />
  <template v-else-if="notFound">
    <p data-testid="robots-not-found">{{ t('robots.notFound') }}</p>
    <RouterLink :to="{ name: 'companies' }" class="text-(--figma-primary-text)">{{ t('robots.back') }}</RouterLink>
  </template>
  <template v-else-if="company">
    <!-- Design 04: a list of robots on the left and the form "Robot toekennen" on the right (below it on a phone) -->
    <RouterLink :to="{ name: 'companies' }" class="text-small text-(--figma-primary-text)" data-testid="back">← {{ t('robots.back') }}</RouterLink>
    <PageTitle :title="t('robots.title', { name: company.name })" />

    <UAlert v-if="robots.source === 'CACHE'" color="warning" variant="subtle" :title="t('common.cache')" data-testid="robots-cache" />
    <UAlert v-if="change.error.value" color="error" variant="subtle" :title="change.error.value" data-testid="robots-change-error" />

    <div class="grid gap-8 lg:grid-cols-[1fr_448px] lg:items-start">
      <section class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-caption text-muted" data-testid="robots-summary">{{ summary }}</span>
          <USwitch v-model="showOutOfService" :label="t('robots.showOutOfService')" data-testid="show-out-of-service" />
        </div>

        <p v-if="robots.items.length === 0" data-testid="robots-empty">{{ t('robots.empty') }}</p>
        <template v-else>
          <div class="table-card hidden md:block">
            <table data-testid="robots-table">
              <thead>
                <tr>
                  <th scope="col">{{ t('robots.name') }}</th>
                  <th scope="col">{{ t('robots.model') }}</th>
                  <th scope="col">{{ t('robots.status') }}</th>
                  <th scope="col">{{ t('robots.battery') }}</th>
                  <th scope="col">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="robot in robots.items" :key="robot.id" data-testid="robot-row">
                  <td class="font-medium">{{ robot.name }}</td>
                  <td>{{ robot.model ? t(`robots.kindsShort.${robot.model.kind}`) : '' }}</td>
                  <td><StatusBadge kind="robot" :value="robot.status" /></td>
                  <td>{{ robot.battery == null ? '–' : `${robot.battery}%` }}</td>
                  <td>
                    <div class="flex flex-wrap gap-2">
                      <template v-if="!robot.deletedAt">
                        <UButton :to="{ name: 'robot', params: { id: robot.id } }" color="neutral" variant="outline" size="sm" data-testid="robot-details">
                          {{ t('robots.details') }}
                        </UButton>
                        <UButton
                          v-if="robot.openDefectId && me.can('defects:call')"
                          size="sm"
                          :aria-label="t('robots.callFor', { name: robot.name })"
                          data-testid="robot-call"
                          @click="calling = robot"
                        >
                          {{ t('robots.call') }}
                        </UButton>
                        <UButton
                          v-else-if="!robot.openDefectId && me.can('defects:report')"
                          color="neutral"
                          variant="outline"
                          size="sm"
                          :aria-label="t('robots.reportDefectFor', { name: robot.name })"
                          data-testid="report-defect"
                          @click="reporting = robot"
                        >
                          {{ t('robots.reportDefect') }}
                        </UButton>
                      </template>
                      <UButton
                        v-else-if="me.can('archive:restore')"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        :aria-label="t('robots.restoreOf', { name: robot.name })"
                        data-testid="robot-restore"
                        @click="restore(robot)"
                      >
                        {{ t('common.restore') }}
                      </UButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="flex flex-col gap-4 md:hidden" data-testid="robots-cards">
            <li v-for="robot in robots.items" :key="robot.id" class="flex flex-col gap-2 rounded-2xl border border-default bg-default p-4" data-testid="robot-card">
              <div class="flex items-center justify-between gap-2">
                <span class="text-body">{{ robot.name }}</span>
                <StatusBadge kind="robot" :value="robot.status" />
              </div>
              <span class="text-small text-muted">{{ robot.model ? t(`robots.kindsShort.${robot.model.kind}`) : '' }} · {{ robot.battery == null ? '–' : `${robot.battery}%` }}</span>
              <div v-if="!robot.deletedAt" class="flex gap-2">
                <UButton :to="{ name: 'robot', params: { id: robot.id } }" color="neutral" variant="outline" class="flex-1 justify-center">{{ t('robots.details') }}</UButton>
                <UButton
                  v-if="!robot.openDefectId && me.can('defects:report')"
                  color="neutral"
                  variant="outline"
                  class="flex-1 justify-center"
                  data-testid="report-defect-card"
                  @click="reporting = robot"
                >
                  {{ t('robots.reportDefect') }}
                </UButton>
              </div>
            </li>
          </ul>
        </template>
      </section>

      <!-- Robot toekennen: a new robot for this company; its key is shown once afterwards -->
      <form
        v-if="me.can('robots:create')"
        class="flex flex-col gap-6 rounded-2xl border border-default bg-default p-4 md:p-8"
        data-testid="robot-form"
        @submit.prevent="onSubmit"
      >
        <h2 class="text-card font-semibold">{{ t('robots.new.title') }}</h2>
        <UFormField :label="t('robots.new.name')" name="name">
          <UInput v-model="form.name" required minlength="2" maxlength="120" class="w-full" size="xl" data-testid="robot-name" />
        </UFormField>
        <SelectField
          v-model="form.modelId"
          :label="t('robots.new.model')"
          :options="modelOptions"
          :placeholder="t('robots.new.modelPlaceholder')"
          :hint="t('robots.new.modelHint')"
          data-testid="robot-model"
        />
        <UAlert v-if="create.error.value" color="error" variant="subtle" :title="create.error.value" data-testid="robot-form-error" />
        <UButton type="submit" size="lg" class="justify-center" :loading="create.busy.value" :disabled="!canSubmit" data-testid="robot-submit">
          {{ t('robots.new.submit') }}
        </UButton>
      </form>
    </div>
  </template>

  <ApiKeyDialog
    v-if="created"
    :robot-id="created.robotId"
    :robot-name="created.robotName"
    :api-key="created.apiKey"
    @close="created = null"
  />
  <ReportDefectDialog
    v-if="reporting"
    :robot-id="reporting.id"
    :robot-name="reporting.name"
    @close="reporting = null"
    @reported="onReported"
  />
  <ConfirmDialog
    v-if="calling"
    :title="t('call.confirmTitle')"
    :message="t('call.confirmMessage')"
    :confirm-label="t('call.confirm')"
    :busy="change.busy.value"
    :error="change.error.value"
    @confirm="callTechnician"
    @cancel="calling = null"
  />
</template>
