<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Account, AuditEntry, List, SellerRole } from '@/api/types'
import { api, apiErrorMessage } from '@/lib/api'
import { relativeTime, translationKey } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const { t, te, locale } = useI18n()
const auth = useAuthStore()
const me = useMeStore()

const ROLES: SellerRole[] = ['admin', 'technician']
const accounts = ref<Account[]>([])
const audit = ref<AuditEntry[]>([])
const loading = ref(true)
const loadError = ref('')
const form = reactive({ email: '', role: 'technician' as SellerRole })
const saving = ref(false)
const formError = ref('')
const message = ref('')

const canSubmit = computed(() => form.email.trim() !== '' && !saving.value)

function actionLabel(action: string): string {
  const key = `team.audit.actions.${translationKey(action)}`
  return te(key) ? t(key) : action
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    accounts.value = (await api.get<List<Account>>('/accounts')).items
    audit.value = me.can('audit:read') ? (await api.get<List<AuditEntry>>('/audit?limit=20')).items : []
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('team.loadError'))
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
    const email = form.email.trim()
    await api.post('/accounts', { email, role: form.role })
    message.value = t('team.add.done', { email })
    form.email = ''
    await load()
  } catch (error) {
    formError.value = apiErrorMessage(error, t('team.add.error'))
  } finally {
    saving.value = false
  }
}

async function remove(account: Account) {
  formError.value = ''
  message.value = ''
  try {
    await api.delete(`/accounts/${encodeURIComponent(account.email)}`)
    message.value = t('team.removed', { email: account.email })
    await load()
  } catch (error) {
    formError.value = apiErrorMessage(error, t('team.removeError'))
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-2">
      <h1 class="text-3xl font-semibold">{{ t('team.title') }}</h1>
      <p class="text-muted">{{ t('team.intro') }}</p>
    </section>

    <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="team-message" />
    <UAlert v-if="formError" color="error" variant="subtle" :title="formError" data-testid="team-error" />
    <p v-if="loading" role="status" data-testid="team-loading">{{ t('team.loading') }}</p>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="team-load-error" />

    <template v-else>
      <div class="grid gap-8 lg:grid-cols-[1fr_28rem]">
        <section class="overflow-x-auto rounded-xl border border-default">
          <table class="w-full text-left text-sm" data-testid="accounts-table">
            <thead class="bg-elevated text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.email') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.role') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.addedBy') }}</th>
                <th scope="col" class="px-4 py-3"><span class="sr-only">{{ t('team.remove') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.email" class="border-t border-default" data-testid="account-row">
                <td class="px-4 py-3 font-medium">{{ account.email }}</td>
                <td class="px-4 py-3">
                  <UBadge :color="account.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">{{ t(`team.roles.${account.role}`) }}</UBadge>
                </td>
                <td class="px-4 py-3 text-muted">{{ account.createdBy ?? t('team.fromSettings') }}</td>
                <td class="px-4 py-3 text-right">
                  <UButton
                    v-if="account.createdBy !== null && account.email !== auth.email"
                    color="error"
                    variant="soft"
                    size="sm"
                    data-testid="account-remove"
                    @click="remove(account)"
                  >
                    {{ t('team.remove') }}
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <UCard class="self-start">
          <template #header>
            <h2 class="text-xl font-semibold">{{ t('team.add.title') }}</h2>
          </template>
          <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
            <UFormField :label="t('team.add.email')" name="email">
              <UInput v-model="form.email" type="email" required class="w-full" data-testid="account-email" />
            </UFormField>
            <UFormField :label="t('team.add.role')" :hint="t(`team.roleHints.${form.role}`)" name="role">
              <select
                v-model="form.role"
                class="w-full rounded-md border border-default bg-default px-3 py-2 text-sm"
                data-testid="account-role"
              >
                <option v-for="value in ROLES" :key="value" :value="value">{{ t(`team.roles.${value}`) }}</option>
              </select>
            </UFormField>
            <UButton type="submit" block :loading="saving" :disabled="!canSubmit" data-testid="account-submit">
              {{ t('team.add.submit') }}
            </UButton>
          </form>
        </UCard>
      </div>

      <section v-if="me.can('audit:read')" class="flex flex-col gap-4">
        <h2 class="text-2xl font-semibold">{{ t('team.audit.title') }}</h2>
        <p v-if="audit.length === 0" data-testid="audit-empty">{{ t('team.audit.empty') }}</p>
        <div v-else class="overflow-x-auto rounded-xl border border-default">
          <table class="w-full text-left text-sm" data-testid="audit-table">
            <thead class="bg-elevated text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.audit.when') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.audit.who') }}</th>
                <th scope="col" class="px-4 py-3 font-medium">{{ t('team.audit.what') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in audit" :key="entry.id" class="border-t border-default" data-testid="audit-row">
                <td class="px-4 py-3">{{ relativeTime(entry.at, locale) }}</td>
                <td class="px-4 py-3">{{ entry.actor }}</td>
                <td class="px-4 py-3">
                  {{ actionLabel(entry.action) }}
                  <span v-if="entry.detail" class="text-muted">· {{ entry.detail }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
