<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import type { Defect, List, Robot } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { severityColor } from '@/lib/status'
import { useMeStore } from '@/stores/me'

const { t, locale } = useI18n()
const me = useMeStore()

const defects = ref<Defect[]>([])
const loading = ref(true)
const loadError = ref('')
const selected = ref<Defect | null>(null)
const form = reactive({ name: '' })
const saving = ref(false)
const panelError = ref('')
const message = ref('')
const created = ref<{ robotId: string; robotName: string; apiKey: string } | null>(null)

const canReplace = computed(() => me.can('robots:create') && me.can('defects:manage'))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    defects.value = (await api.get<List<Defect>>('/defects')).items
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('defects.loadError'))
  } finally {
    loading.value = false
  }
}

function choose(defect: Defect) {
  selected.value = defect
  form.name = `${defect.robot.name} (${t('defects.panel.suffix')})`
  panelError.value = ''
  message.value = ''
}

async function replace() {
  if (!selected.value || saving.value) return
  const defect = selected.value
  saving.value = true
  panelError.value = ''
  try {
    const data = await api.post<{ defect: Defect; robot: Robot; apiKey: string }>(
      `/defects/${encodeURIComponent(defect.id)}/replace`,
      { name: form.name.trim() },
    )
    message.value = t('defects.done', { name: defect.robot.name, newName: data.robot.name })
    created.value = { robotId: data.robot.id, robotName: data.robot.name, apiKey: data.apiKey }
    selected.value = null
    await load()
  } catch (error) {
    panelError.value = apiErrorMessage(error, t('defects.panel.error'))
  } finally {
    saving.value = false
  }
}

async function closeDefect() {
  if (!selected.value || saving.value) return
  const defect = selected.value
  saving.value = true
  panelError.value = ''
  try {
    await api.post(`/defects/${encodeURIComponent(defect.id)}/close`, {})
    message.value = t('defects.closed', { name: defect.robot.name })
    selected.value = null
    await load()
  } catch (error) {
    panelError.value = apiErrorMessage(error, t('defects.panel.error'))
  } finally {
    saving.value = false
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

    <section class="flex flex-col gap-2">
      <h1 class="text-3xl font-semibold">{{ t('defects.title') }}</h1>
      <p class="text-muted">{{ t('defects.intro') }}</p>
    </section>

    <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="defects-message" />
    <p v-if="loading" role="status" data-testid="defects-loading">{{ t('defects.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="defects-error" />

    <div v-else class="grid gap-8 lg:grid-cols-[1fr_28rem]">
      <section>
        <p v-if="defects.length === 0" data-testid="defects-empty">{{ t('defects.empty') }}</p>
        <div v-else class="overflow-x-auto rounded-xl border border-default">
          <table class="w-full text-left text-sm" data-testid="defects-table">
            <thead class="bg-elevated text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('defects.robot') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('defects.company') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('defects.defect') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('defects.since') }}</th>
                <th scope="col" class="px-4 py-3"><span class="sr-only">{{ t('defects.replace') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="defect in defects" :key="defect.id" class="border-t border-default" data-testid="defect-row">
                <td class="px-4 py-3 font-medium">{{ defect.robot.name }}</td>
                <td class="px-4 py-3">{{ defect.company.name }}</td>
                <td class="px-4 py-3">
                  <UBadge :color="severityColor(defect.severity)" variant="subtle">{{ defect.summary }}</UBadge>
                </td>
                <td class="px-4 py-3">{{ relativeTime(defect.createdAt, locale) }}</td>
                <td class="px-4 py-3 text-right">
                  <UButton
                    v-if="canReplace"
                    :color="selected?.id === defect.id ? 'primary' : 'neutral'"
                    :variant="selected?.id === defect.id ? 'solid' : 'outline'"
                    size="sm"
                    data-testid="defect-replace"
                    @click="choose(defect)"
                  >
                    {{ t('defects.replace') }}
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="selected">
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">{{ t('defects.panel.title') }}</h2>
            <p class="text-sm text-muted" data-testid="panel-for">
              {{ t('defects.panel.for', { robot: selected.robot.name, company: selected.company.name }) }}
            </p>
          </template>
          <form class="flex flex-col gap-4" @submit.prevent="replace">
            <UFormField :label="t('defects.panel.name')" name="name">
              <UInput v-model="form.name" required minlength="2" maxlength="120" class="w-full" data-testid="replace-name" />
            </UFormField>
            <UAlert color="primary" variant="subtle" :title="t('defects.panel.info')" />
            <UAlert v-if="panelError" color="error" variant="subtle" :title="panelError" data-testid="panel-error" />
            <UButton type="submit" block :loading="saving" :disabled="form.name.trim().length < 2" data-testid="replace-submit">
              {{ t('defects.panel.submit') }}
            </UButton>
            <UButton color="neutral" variant="outline" block :disabled="saving" data-testid="defect-close" @click="closeDefect">
              {{ t('defects.panel.close') }}
            </UButton>
            <UButton color="neutral" variant="ghost" block @click="selected = null">{{ t('defects.panel.cancel') }}</UButton>
          </form>
        </UCard>
      </section>
    </div>
  </div>
</template>
