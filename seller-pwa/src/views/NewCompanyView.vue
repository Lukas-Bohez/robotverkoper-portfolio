<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Company } from '@/api/types'
import { apiErrorMessage } from '@/lib/errors'
import { isValidSubdomain, slugify } from '@/lib/slug'
import { useCompaniesStore } from '@/stores/companies'

const { t } = useI18n()
const companies = useCompaniesStore()

const form = reactive({ name: '', subdomain: '', adminEmail: '' })
const subdomainEdited = ref(false)
const saving = ref(false)
const error = ref('')
const created = ref<Company | null>(null)

// The address follows the name until someone types an address themselves
watch(
  () => form.name,
  name => {
    if (!subdomainEdited.value) form.subdomain = slugify(name)
  },
)

const subdomainInvalid = computed(() => form.subdomain !== '' && !isValidSubdomain(form.subdomain))
const canSubmit = computed(
  () =>
    form.name.trim().length >= 2 &&
    isValidSubdomain(form.subdomain) &&
    form.adminEmail.trim() !== '' &&
    !saving.value,
)

async function onSubmit() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = ''
  created.value = null
  try {
    created.value = await companies.create({
      name: form.name.trim(),
      subdomain: form.subdomain,
      adminEmail: form.adminEmail.trim(),
    })
    form.name = ''
    form.subdomain = ''
    form.adminEmail = ''
    subdomainEdited.value = false
  } catch (e) {
    error.value = apiErrorMessage(e, t('newCompany.error'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Design 03: the title, a card of 640 px with the form and, after saving, a green line of confirmation -->
  <h1 class="text-page font-semibold">{{ t('newCompany.title') }}</h1>

  <div class="flex w-full max-w-[640px] flex-col gap-6 md:rounded-2xl md:border md:border-default md:bg-default md:p-8">
    <h2 class="hidden text-card font-semibold md:block">{{ t('newCompany.cardTitle') }}</h2>
    <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <UFormField :label="t('newCompany.name')" name="name">
        <UInput v-model="form.name" required minlength="2" maxlength="60" class="w-full" data-testid="company-name" />
      </UFormField>
      <UFormField
        :label="t('newCompany.subdomain')"
        :hint="t('newCompany.subdomainHint')"
        :error="subdomainInvalid ? t('newCompany.subdomainInvalid') : undefined"
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
      <UFormField :label="t('newCompany.adminEmail')" :hint="t('newCompany.adminHint')" name="adminEmail">
        <UInput v-model="form.adminEmail" type="email" required class="w-full" data-testid="company-admin-email" />
      </UFormField>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="company-form-error" />
      <div class="flex flex-col gap-4 md:flex-row">
        <UButton type="submit" class="justify-center" :loading="saving" :disabled="!canSubmit" data-testid="company-submit">
          {{ t('newCompany.submit') }}
        </UButton>
        <UButton :to="{ name: 'companies' }" class="justify-center" color="neutral" variant="outline" data-testid="company-cancel">
          {{ t('newCompany.cancel') }}
        </UButton>
      </div>
    </form>
  </div>

  <UAlert v-if="created" color="success" variant="subtle" :title="t('newCompany.done', { name: created.name })" data-testid="company-created">
    <template #description>
      <RouterLink :to="{ name: 'company-robots', params: { id: created.id } }" class="underline" data-testid="company-created-link">
        {{ t('newCompany.toRobots', { name: created.name }) }}
      </RouterLink>
    </template>
  </UAlert>
</template>
