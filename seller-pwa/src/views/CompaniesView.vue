<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { COMPANIES, CREATE_COMPANY, type Company } from '@/graphql/operations'
import { apiErrorMessage, graphql } from '@/lib/graphql'
import { isValidSubdomain, slugify } from '@/lib/slug'

const { t, locale } = useI18n()

const companies = ref<Company[]>([])
const loading = ref(true)
const loadError = ref('')

const form = reactive({ name: '', subdomain: '', adminEmail: '' })
const subdomainEdited = ref(false)
const saving = ref(false)
const formError = ref('')
const message = ref('')

// The address follows the name until someone types an address themselves
watch(
  () => form.name,
  (name) => {
    if (!subdomainEdited.value) form.subdomain = slugify(name)
  },
)

const subdomainInvalid = computed(
  () => form.subdomain !== '' && !isValidSubdomain(form.subdomain),
)
const canSubmit = computed(
  () =>
    form.name.trim().length >= 2 &&
    isValidSubdomain(form.subdomain) &&
    form.adminEmail.trim() !== '' &&
    !saving.value,
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await graphql.query<{ tenants: Company[] }>(COMPANIES)
    companies.value = data.tenants
  } catch (error) {
    loadError.value = apiErrorMessage(error, t('companies.loadError'))
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
    await graphql.mutate(CREATE_COMPANY, {
      input: { name, subdomain: form.subdomain, adminEmail: form.adminEmail.trim() },
    })
    message.value = t('companies.new.done', { name })
    form.name = ''
    form.subdomain = ''
    form.adminEmail = ''
    subdomainEdited.value = false
    await load()
  } catch (error) {
    formError.value = apiErrorMessage(error, t('companies.new.error'))
  } finally {
    saving.value = false
  }
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(locale.value) : ''
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold">{{ t('companies.title') }}</h1>
      <p class="text-muted">{{ t('companies.intro') }}</p>

      <p v-if="loading" role="status" data-testid="companies-loading">{{ t('companies.loading') }}</p>
      <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" data-testid="companies-error" />
      <p v-else-if="companies.length === 0" data-testid="companies-empty">{{ t('companies.empty') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm" data-testid="companies-table">
          <thead>
            <tr class="border-b border-default">
              <th scope="col" class="py-2 pr-4">{{ t('companies.name') }}</th>
              <th scope="col" class="py-2 pr-4">{{ t('companies.subdomain') }}</th>
              <th scope="col" class="py-2 pr-4">{{ t('companies.created') }}</th>
              <th scope="col" class="py-2"><span class="sr-only">{{ t('companies.robots') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in companies" :key="company.id" class="border-b border-default" data-testid="company-row">
              <td class="py-2 pr-4 font-medium">{{ company.name }}</td>
              <td class="py-2 pr-4">{{ company.subdomain }}</td>
              <td class="py-2 pr-4">{{ date(company.createdAt) }}</td>
              <td class="py-2 text-right">
                <RouterLink
                  :to="{ name: 'company-robots', params: { id: company.id } }"
                  class="text-primary underline"
                  :aria-label="t('companies.openRobots', { name: company.name })"
                  data-testid="company-robots-link"
                >
                  {{ t('companies.robots') }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">{{ t('companies.new.title') }}</h2>
        </template>
        <form class="flex max-w-lg flex-col gap-4" @submit.prevent="onSubmit">
          <UFormField :label="t('companies.new.name')" name="name">
            <UInput v-model="form.name" required minlength="2" maxlength="60" class="w-full" data-testid="company-name" />
          </UFormField>
          <UFormField
            :label="t('companies.new.subdomain')"
            :hint="t('companies.new.subdomainHint')"
            :error="subdomainInvalid ? t('companies.new.subdomainInvalid') : undefined"
            name="subdomain"
          >
            <UInput
              v-model="form.subdomain"
              required
              maxlength="30"
              class="w-full"
              data-testid="company-subdomain"
              @update:model-value="subdomainEdited = true"
            />
          </UFormField>
          <UFormField :label="t('companies.new.adminEmail')" :hint="t('companies.new.adminHint')" name="adminEmail">
            <UInput v-model="form.adminEmail" type="email" required class="w-full" data-testid="company-admin-email" />
          </UFormField>
          <UAlert v-if="message" color="success" variant="subtle" :title="message" data-testid="company-created" />
          <UAlert v-if="formError" color="error" variant="subtle" :title="formError" data-testid="company-form-error" />
          <UButton type="submit" class="self-start" :loading="saving" :disabled="!canSubmit" data-testid="company-submit">
            {{ t('companies.new.submit') }}
          </UButton>
        </form>
      </UCard>
    </section>
  </div>
</template>
