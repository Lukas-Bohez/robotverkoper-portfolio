<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CompanyTabs from '@/components/CompanyTabs.vue'
import type { Company, CompanyRole, List } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { permissionArea, permissionKey } from '@/lib/format'

const { t } = useI18n()
const route = useRoute()
const companyId = computed(() => String(route.params.id ?? ''))
const base = computed(() => `/companies/${encodeURIComponent(companyId.value)}`)

const company = ref<Company | null>(null)
const roles = ref<CompanyRole[]>([])
const permissions = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)

const showForm = ref(false)
const form = reactive({ name: '', permissions: [] as string[] })
const saving = ref(false)
const formError = ref('')
const message = ref('')
const removeError = ref('')

const canSubmit = computed(() => form.name.trim().length >= 2 && !saving.value)

/** The permissions grouped by area, so a role is built from understandable blocks */
const groups = computed(() => {
  const byArea = new Map<string, string[]>()
  for (const key of permissions.value) {
    const area = permissionArea(key)
    byArea.set(area, [...(byArea.get(area) ?? []), key])
  }
  return [...byArea.entries()].map(([area, keys]) => ({ area, keys }))
})

function describe(role: CompanyRole): string {
  if (role.locked) return t('roles.adminText')
  if (role.permissions.length === 0) return t('roles.noPermissions')
  return role.permissions.map((key) => t(`permissions.${permissionKey(key)}`)).join(', ')
}

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    company.value = await api.get<Company>(base.value).catch((error: unknown) => {
      if (error instanceof Error && 'status' in error && error.status === 404) return null
      throw error
    })
    if (!company.value) {
      notFound.value = true
      return
    }
    const [roleData, permissionData] = await Promise.all([
      api.get<List<CompanyRole>>(`${base.value}/roles`),
      api.get<List<string>>('/company-permissions'),
    ])
    roles.value = roleData.items
    permissions.value = permissionData.items
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('roles.loadError'))
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  if (!canSubmit.value) return
  saving.value = true
  formError.value = ''
  message.value = ''
  try {
    const name = form.name.trim()
    await api.post(`${base.value}/roles`, { name, permissions: form.permissions })
    message.value = t('roles.form.done', { name })
    form.name = ''
    form.permissions = []
    showForm.value = false
    roles.value = (await api.get<List<CompanyRole>>(`${base.value}/roles`)).items
  } catch (error) {
    formError.value = apiErrorMessage(error, t('roles.form.error'))
  } finally {
    saving.value = false
  }
}

async function remove(role: CompanyRole) {
  removeError.value = ''
  message.value = ''
  try {
    await api.delete(`${base.value}/roles/${encodeURIComponent(role.id)}`)
    message.value = t('roles.removed', { name: role.name })
    roles.value = roles.value.filter((item) => item.id !== role.id)
  } catch (error) {
    removeError.value = apiErrorMessage(error, t('roles.removeError'))
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <RouterLink :to="{ name: 'companies' }" class="text-sm text-primary underline">← {{ t('robots.back') }}</RouterLink>
    <p v-if="loading" role="status" data-testid="roles-loading">{{ t('roles.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="roles-error" />
    <p v-else-if="notFound" data-testid="roles-not-found">{{ t('robots.notFound') }}</p>
    <template v-else>
      <h1 class="text-3xl font-semibold" data-testid="roles-title">{{ t('roles.title', { name: company?.name ?? '' }) }}</h1>
      <CompanyTabs :company-id="companyId" current="roles" />
      <UAlert color="primary" variant="subtle" :title="t('roles.info')" />
      <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="roles-message" />
      <UAlert v-if="removeError" color="error" variant="subtle" :title="removeError" data-testid="roles-remove-error" />

      <div class="grid gap-8 lg:grid-cols-[1fr_28rem]">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-xl font-semibold">{{ t('roles.title2') }}</h2>
              <UButton color="neutral" variant="outline" size="sm" data-testid="new-role" @click="showForm = !showForm">
                {{ t('roles.newRole') }}
              </UButton>
            </div>
          </template>

          <form v-if="showForm" class="mb-6 flex flex-col gap-4 border-b border-default pb-6" data-testid="role-form" @submit.prevent="onSubmit">
            <UFormField :label="t('roles.form.name')" name="name">
              <UInput v-model="form.name" required minlength="2" maxlength="40" class="w-full" data-testid="role-name" />
            </UFormField>
            <fieldset class="flex flex-col gap-4">
              <legend class="mb-2 text-sm font-medium">{{ t('roles.form.permissions') }}</legend>
              <div v-for="group in groups" :key="group.area" class="flex flex-col gap-1">
                <span class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t(`permissionGroups.${group.area}`) }}</span>
                <label v-for="key in group.keys" :key="key" class="flex items-center gap-2 text-sm">
                  <input v-model="form.permissions" type="checkbox" :value="key" :data-testid="`perm-${permissionKey(key)}`" />
                  {{ t(`permissions.${permissionKey(key)}`) }}
                </label>
              </div>
            </fieldset>
            <UAlert v-if="formError" color="error" variant="subtle" :title="formError" data-testid="role-form-error" />
            <div class="flex gap-4">
              <UButton type="submit" :loading="saving" :disabled="!canSubmit" data-testid="role-submit">{{ t('roles.form.submit') }}</UButton>
              <UButton color="neutral" variant="outline" @click="showForm = false">{{ t('roles.form.cancel') }}</UButton>
            </div>
          </form>

          <ul class="flex flex-col divide-y divide-default" data-testid="roles-list">
            <li v-for="role in roles" :key="role.id" class="flex flex-wrap items-center justify-between gap-4 py-4" data-testid="role-row">
              <div class="flex min-w-0 flex-col gap-1">
                <span class="flex items-center gap-2 font-medium">
                  {{ role.locked ? t('roles.admin') : role.name }}
                  <UBadge v-if="role.locked" color="neutral" variant="subtle" data-testid="role-locked">🔒</UBadge>
                </span>
                <span class="text-sm text-muted">{{ describe(role) }}</span>
              </div>
              <div class="flex gap-2">
                <UButton
                  :to="{ name: 'role-preview', params: { id: companyId }, query: { role: role.id } }"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  data-testid="role-preview"
                >
                  {{ t('roles.preview') }}
                </UButton>
                <UButton
                  v-if="!role.locked"
                  color="error"
                  variant="soft"
                  size="sm"
                  data-testid="role-remove"
                  @click="remove(role)"
                >
                  {{ t('roles.remove') }}
                </UButton>
              </div>
            </li>
          </ul>
        </UCard>

        <UCard class="self-start">
          <template #header>
            <h2 class="text-xl font-semibold">{{ t('roles.firstAdmin.title') }}</h2>
          </template>
          <p class="text-sm text-muted">{{ t('roles.firstAdmin.text') }}</p>
        </UCard>
      </div>
    </template>
  </div>
</template>
