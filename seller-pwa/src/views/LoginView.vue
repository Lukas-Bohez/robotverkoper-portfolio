<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { safeRedirect } from '@/router/guard'
import { devLoginEnabled, loginErrorKey, useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const state = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(state.email.trim(), state.password)
    await router.push(safeRedirect(route.query.redirect) ?? { name: 'companies' })
  } catch (e) {
    error.value = t(loginErrorKey(e))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col justify-center pt-8">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-semibold">{{ t('login.title') }}</h1>
        <p class="mt-2 text-sm text-muted">{{ t('login.intro') }}</p>
      </template>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <UFormField :label="t('login.email')" name="email">
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            required
            class="w-full"
            data-testid="login-email"
          />
        </UFormField>
        <UFormField :label="t('login.password')" name="password">
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
            data-testid="login-password"
          />
        </UFormField>
        <UAlert v-if="devLoginEnabled" color="warning" variant="subtle" :title="t('login.devNote')" data-testid="login-dev-note" />
        <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="login-error" />
        <UButton type="submit" block :loading="loading" data-testid="login-submit">
          {{ t('login.submit') }}
        </UButton>
      </form>
    </UCard>
  </div>
</template>
