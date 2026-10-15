<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <UApp>
    <a
      href="#content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-default focus:p-2"
    >
      {{ t('app.skip') }}
    </a>
    <header class="border-b border-default">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <RouterLink :to="{ name: 'companies' }" class="flex flex-col leading-tight">
          <span class="text-lg font-semibold">{{ t('app.title') }}</span>
          <span class="text-xs text-muted">{{ t('app.tagline') }}</span>
        </RouterLink>
        <nav class="flex flex-wrap items-center gap-3 text-sm" aria-label="Menu">
          <RouterLink v-if="auth.user" :to="{ name: 'companies' }" class="underline-offset-4 hover:underline">
            {{ t('app.companies') }}
          </RouterLink>
          <div class="flex gap-1" role="group" aria-label="Language">
            <UButton
              v-for="code in LANGUAGES"
              :key="code"
              size="xs"
              :variant="locale === code ? 'solid' : 'ghost'"
              color="neutral"
              :data-testid="`language-${code}`"
              @click="setLanguage(code as Language)"
            >
              {{ code.toUpperCase() }}
            </UButton>
          </div>
          <template v-if="auth.user">
            <span class="hidden text-muted sm:inline" data-testid="user-email">{{ auth.email }}</span>
            <UButton size="xs" color="neutral" variant="outline" data-testid="logout" @click="logout">
              {{ t('app.logout') }}
            </UButton>
          </template>
        </nav>
      </div>
    </header>
    <main id="content" class="mx-auto max-w-5xl p-4">
      <RouterView />
    </main>
  </UApp>
</template>
