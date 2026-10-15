<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import CompanyTabs from '@/components/CompanyTabs.vue'
import ReportDefectDialog from '@/components/ReportDefectDialog.vue'
import type { Company, List, Robot, RobotModel, Source } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { statusColor } from '@/lib/status'
import { useMeStore } from '@/stores/me'

const { t } = useI18n()
const route = useRoute()
const me = useMeStore()
const companyId = computed(() => String(route.params.id ?? ''))

const company = ref<Company | null>(null)
const robots = ref<Robot[]>([])
const models = ref<RobotModel[]>([])
const source = ref<Source>('platform')
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)

const form = reactive({ name: '', modelId: '' })
const saving = ref(false)
const formError = ref('')
const created = ref<{ robotId: string; robotName: string; apiKey: string } | null>(null)
const reporting = ref<Robot | null>(null)

const canSubmit = computed(() => form.name.trim().length >= 2 && form.modelId !== '' && !saving.value)

async function loadRobots() {
  const data = await api.get<List<Robot>>(`/companies/${encodeURIComponent(companyId.value)}/robots`)
  robots.value = data.items
  source.value = data.source ?? 'platform'
}

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const [companyData, modelData] = await Promise.all([
      api.get<Company>(`/companies/${encodeURIComponent(companyId.value)}`).catch((error: unknown) => {
        if (error instanceof Error && 'status' in error && error.status === 404) return null
        throw error
      }),
      api.get<List<RobotModel>>('/robot-models'),
    ])
    company.value = companyData
    models.value = modelData.items
    if (!company.value) {
      notFound.value = true
      return
    }
    await loadRobots()
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('robots.loadError'))
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  if (!canSubmit.value) return
  saving.value = true
  formError.value = ''
  try {
    const name = form.name.trim()
    const data = await api.post<{ robot: Robot; apiKey: string }>(
      `/companies/${encodeURIComponent(companyId.value)}/robots`,
      { name, modelId: form.modelId },
    )
    created.value = { robotId: data.robot.id, robotName: data.robot.name, apiKey: data.apiKey }
    form.name = ''
    await loadRobots()
  } catch (error) {
    formError.value = apiErrorMessage(error, t('robots.new.error'))
  } finally {
    saving.value = false
  }
}

async function onReported() {
  reporting.value = null
  try {
    await loadRobots()
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('robots.loadError'))
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
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

    <RouterLink :to="{ name: 'companies' }" class="text-sm text-primary underline">
      ← {{ t('robots.back') }}
    </RouterLink>
    <p v-if="loading" role="status" data-testid="robots-loading">{{ t('robots.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="robots-error" />
    <p v-else-if="notFound" data-testid="robots-not-found">{{ t('robots.notFound') }}</p>
    <template v-else>
      <h1 class="text-3xl font-semibold" data-testid="robots-title">
        {{ t('robots.title', { name: company?.name ?? '' }) }}
      </h1>
      <CompanyTabs :company-id="companyId" current="robots" />
      <UAlert v-if="source === 'cache'" color="warning" variant="subtle" :title="t('common.cache')" data-testid="robots-cache" />

      <div class="grid gap-8 lg:grid-cols-[1fr_28rem]">
        <section>
          <p v-if="robots.length === 0" data-testid="robots-empty">{{ t('robots.empty') }}</p>
          <div v-else class="overflow-x-auto rounded-xl border border-default">
            <table class="w-full text-left text-sm" data-testid="robots-table">
              <thead class="bg-elevated text-muted">
                <tr>
                  <th scope="col" class="px-4 py-3 font-medium">{{ t('robots.name') }}</th>
                  <th scope="col" class="px-4 py-3 font-medium">{{ t('robots.model') }}</th>
                  <th scope="col" class="px-4 py-3 font-medium">{{ t('robots.key') }}</th>
                  <th scope="col" class="px-4 py-3 font-medium">{{ t('robots.status') }}</th>
                  <th scope="col" class="px-4 py-3 font-medium">{{ t('robots.battery') }}</th>
                  <th v-if="me.can('defects:manage')" scope="col" class="px-4 py-3"><span class="sr-only">{{ t('robots.reportDefect') }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="robot in robots" :key="robot.id" class="border-t border-default" data-testid="robot-row">
                  <td class="px-4 py-3 font-medium">{{ robot.name }}</td>
                  <td class="px-4 py-3">
                    {{ robot.model?.name }}
                    <span v-if="robot.model" class="text-muted">({{ t(`robots.kinds.${robot.model.kind}`) }})</span>
                  </td>
                  <td class="px-4 py-3 text-muted">{{ t('robots.keyPrefix', { prefix: robot.apiKeyPrefix }) }}</td>
                  <td class="px-4 py-3">
                    <UBadge :color="statusColor(robot.status)" variant="subtle" data-testid="robot-status">
                      {{ t(`robots.states.${robot.status}`) }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3" data-testid="robot-battery">{{ robot.battery === null ? '' : `${Math.round(robot.battery)}%` }}</td>
                  <td v-if="me.can('defects:manage')" class="px-4 py-3 text-right">
                    <UButton
                      v-if="robot.status !== 'defect'"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      :aria-label="t('robots.reportDefectFor', { name: robot.name })"
                      data-testid="robot-report-defect"
                      @click="reporting = robot"
                    >
                      {{ t('robots.reportDefect') }}
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="company && me.can('robots:create')">
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold">{{ t('robots.new.title') }}</h2>
            </template>
            <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
              <UFormField :label="t('robots.new.name')" name="name">
                <UInput v-model="form.name" required minlength="2" maxlength="120" class="w-full" data-testid="robot-name" />
              </UFormField>
              <UFormField :label="t('robots.new.model')" :hint="t('robots.new.modelHint')" name="model">
                <select
                  v-model="form.modelId"
                  required
                  class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
                  data-testid="robot-model"
                >
                  <option value="" disabled>{{ t('robots.new.modelPlaceholder') }}</option>
                  <option v-for="model in models" :key="model.id" :value="model.id">
                    {{ model.name }} ({{ t(`robots.kinds.${model.kind}`) }})
                  </option>
                </select>
              </UFormField>
              <UAlert v-if="formError" color="error" variant="subtle" :title="formError" data-testid="robot-form-error" />
              <UButton type="submit" block :loading="saving" :disabled="!canSubmit" data-testid="robot-submit">
                {{ t('robots.new.submit') }}
              </UButton>
            </form>
          </UCard>
        </section>
      </div>
    </template>
  </div>
</template>
