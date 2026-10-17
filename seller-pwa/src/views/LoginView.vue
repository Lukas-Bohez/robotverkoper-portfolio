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
    await router.push(safeRedirect(route.query.redirect) ?? { name: 'home' })
  } catch (e) {
    error.value = t(loginErrorKey(e))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Design 01: a card of 448 px on a computer, the bare form on a phone -->
  <div
    class="flex flex-col gap-6 md:mx-auto md:mt-6 md:w-full md:max-w-[448px] md:rounded-2xl md:border md:border-default md:bg-default md:p-8"
  >
    <div class="flex flex-col gap-4">
      <h1 class="text-page font-semibold">{{ t('login.title') }}</h1>
      <p class="text-small text-muted">{{ t('login.intro') }}</p>
    </div>
    <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <UFormField :label="t('login.email')" name="email">
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          required
          placeholder="naam@robotmaker.be"
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
  </div>
</template>
