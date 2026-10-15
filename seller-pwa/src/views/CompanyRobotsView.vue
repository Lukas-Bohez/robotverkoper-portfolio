<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import {
  COMPANIES,
  COMPANY_ROBOTS,
  CREATE_ROBOT,
  ROBOT_MODELS,
  type Company,
  type Robot,
  type RobotModel,
  type TemperatureType,
} from '@/graphql/operations'
import { apiErrorMessage, graphql } from '@/lib/graphql'

const { t } = useI18n()
const route = useRoute()
const tenantId = computed(() => String(route.params.id ?? ''))

const company = ref<Company | null>(null)
const robots = ref<Robot[]>([])
const models = ref<RobotModel[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)

const TEMPERATURES: TemperatureType[] = ['WARM', 'COLD', 'NEUTRAL']
const form = reactive({ name: '', modelId: '', temperatureType: 'WARM' as TemperatureType })
const saving = ref(false)
const formError = ref('')
const created = ref<{ robotName: string; apiKey: string } | null>(null)

const selectedModel = computed(() => models.value.find((model) => model.id === form.modelId))
const needsTemperature = computed(() => selectedModel.value?.kind === 'FOOD')
const canSubmit = computed(() => form.name.trim().length >= 2 && form.modelId !== '' && !saving.value)

async function loadRobots() {
  const data = await graphql.query<{ robots: Robot[] }>(COMPANY_ROBOTS, { tenantId: tenantId.value })
  robots.value = data.robots
}

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const [companyData, modelData] = await Promise.all([
      graphql.query<{ tenants: Company[] }>(COMPANIES),
      graphql.query<{ robotModels: RobotModel[] }>(ROBOT_MODELS),
    ])
    company.value = companyData.tenants.find((item) => item.id === tenantId.value) ?? null
    models.value = modelData.robotModels
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
    const data = await graphql.mutate<{ createRobot: { apiKey: string; robot: { id: string; name: string } } }>(
      CREATE_ROBOT,
      {
        input: {
          tenantId: tenantId.value,
          modelId: form.modelId,
          name,
          // The API wants a temperature for food robots and refuses one for parcel robots
          ...(needsTemperature.value ? { temperatureType: form.temperatureType } : {}),
        },
      },
    )
    created.value = { robotName: data.createRobot.robot.name, apiKey: data.createRobot.apiKey }
    form.name = ''
    await loadRobots()
  } catch (error) {
    formError.value = apiErrorMessage(error, t('robots.new.error'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-8">
    <ApiKeyDialog
      v-if="created"
      :robot-name="created.robotName"
      :api-key="created.apiKey"
      @close="created = null"
    />

    <section class="flex flex-col gap-2">
      <RouterLink :to="{ name: 'companies' }" class="text-sm text-primary underline">
        {{ t('robots.back') }}
      </RouterLink>
      <p v-if="loading" role="status" data-testid="robots-loading">{{ t('robots.loading') }}</p>
      <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="robots-error" />
      <p v-else-if="notFound" data-testid="robots-not-found">{{ t('robots.notFound') }}</p>
      <template v-else>
        <h1 class="text-2xl font-semibold" data-testid="robots-title">
          {{ t('robots.title', { name: company?.name ?? '' }) }}
        </h1>
        <p v-if="robots.length === 0" data-testid="robots-empty">{{ t('robots.empty') }}</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm" data-testid="robots-table">
            <thead>
              <tr class="border-b border-default">
                <th scope="col" class="py-2 pr-4">{{ t('robots.name') }}</th>
                <th scope="col" class="py-2 pr-4">{{ t('robots.model') }}</th>
                <th scope="col" class="py-2 pr-4">{{ t('robots.key') }}</th>
                <th scope="col" class="py-2 pr-4">{{ t('robots.status') }}</th>
                <th scope="col" class="py-2">{{ t('robots.battery') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="robot in robots" :key="robot.id" class="border-b border-default" data-testid="robot-row">
                <td class="py-2 pr-4 font-medium">{{ robot.name }}</td>
                <td class="py-2 pr-4">
                  {{ robot.model?.name }}
                  <span v-if="robot.model" class="text-muted">({{ t(`robots.kinds.${robot.model.kind}`) }})</span>
                </td>
                <td class="py-2 pr-4 text-muted">{{ t('robots.keyPrefix', { prefix: robot.apiKeyPrefix }) }}</td>
                <td class="py-2 pr-4">{{ robot.online ? t('robots.online') : t('robots.offline') }}</td>
                <td class="py-2">{{ robot.battery === null ? '' : `${Math.round(robot.battery)}%` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <section v-if="company && !loading">
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">{{ t('robots.new.title') }}</h2>
        </template>
        <form class="flex max-w-lg flex-col gap-4" @submit.prevent="onSubmit">
          <UFormField :label="t('robots.new.name')" name="name">
            <UInput v-model="form.name" required minlength="2" maxlength="120" class="w-full" data-testid="robot-name" />
          </UFormField>
          <UFormField :label="t('robots.new.model')" name="model">
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
          <UFormField
            v-if="needsTemperature"
            :label="t('robots.new.temperature')"
            :hint="t('robots.new.temperatureHint')"
            name="temperature"
          >
            <select
              v-model="form.temperatureType"
              class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
              data-testid="robot-temperature"
            >
              <option v-for="value in TEMPERATURES" :key="value" :value="value">
                {{ t(`robots.temperatures.${value}`) }}
              </option>
            </select>
          </UFormField>
          <UAlert v-if="formError" color="error" variant="subtle" :title="formError" data-testid="robot-form-error" />
          <UButton type="submit" class="self-start" :loading="saving" :disabled="!canSubmit" data-testid="robot-submit">
            {{ t('robots.new.submit') }}
          </UButton>
        </form>
      </UCard>
    </section>
  </div>
</template>
