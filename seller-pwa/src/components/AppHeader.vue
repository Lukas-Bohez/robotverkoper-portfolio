<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Permission } from '@/api/types'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const open = ref(false)

const links = computed(() => {
  const all: { name: string; label: string; permission: Permission }[] = [
    { name: 'companies', label: t('app.companies'), permission: 'companies:read' },
    { name: 'defects', label: t('app.defects'), permission: 'defects:read' },
    { name: 'team', label: t('app.team'), permission: 'accounts:manage' },
  ]
  return auth.user ? all.filter((link) => me.can(link.permission)) : []
})

async function logout() {
  open.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="border-b border-default bg-default">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
      <RouterLink :to="{ name: 'companies' }" class="flex items-center gap-3" data-testid="brand">
        <span class="size-8 rounded-full bg-primary" aria-hidden="true" />
        <span class="flex flex-col leading-tight">
          <span class="text-base font-semibold">{{ t('app.title') }}</span>
          <span class="hidden text-xs text-muted sm:block">{{ t('app.tagline') }}</span>
        </span>
      </RouterLink>

      <UButton
        v-if="auth.user"
        class="md:hidden"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-expanded="open"
        aria-controls="main-menu"
        data-testid="menu-toggle"
        @click="open = !open"
      >
        {{ t('app.menu') }}
      </UButton>

      <nav
        id="main-menu"
        :class="[open ? 'flex' : 'hidden', 'absolute left-0 right-0 top-14 z-40 flex-col gap-4 border-b border-default bg-default p-4 md:static md:flex md:flex-row md:items-center md:gap-6 md:border-0 md:p-0']"
        :aria-label="t('app.menu')"
      >
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="text-sm text-muted underline-offset-4 hover:underline"
          active-class="font-semibold !text-primary"
          data-testid="nav-link"
          @click="open = false"
        >
          {{ link.label }}
        </RouterLink>
        <div class="flex gap-1" role="group" :aria-label="t('app.language')">
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
          <span class="rounded-md bg-elevated px-2 py-1 text-xs text-muted" data-testid="user-email">{{ auth.email }}</span>
          <UButton size="sm" color="neutral" variant="outline" data-testid="logout" @click="logout">
            {{ t('app.logout') }}
          </UButton>
        </template>
      </nav>
    </div>
  </header>
</template>
