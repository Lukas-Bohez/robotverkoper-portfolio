<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Permission } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const { t } = useI18n()
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
  return auth.user ? all.filter(link => me.can(link.permission)) : []
})

async function logout() {
  open.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <!-- The header of the design: 72 px high, the brand on the left and the menu on the right -->
  <header class="relative border-b border-default bg-default">
    <div class="mx-auto flex h-18 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-16">
      <RouterLink :to="{ name: 'companies' }" class="flex items-center gap-2" data-testid="brand">
        <span class="size-8 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span class="flex flex-col">
          <span class="text-body leading-6">{{ t('app.title') }}</span>
          <span class="hidden text-caption text-muted md:block">{{ t('app.tagline') }}</span>
        </span>
      </RouterLink>

      <!-- The menu is only for someone who is logged in -->
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
        :aria-label="t('app.menu')"
        :class="[
          open ? 'flex' : 'hidden',
          'absolute left-0 right-0 top-full z-40 flex-col gap-4 border-b border-default bg-default p-4 md:static md:flex md:flex-row md:items-center md:gap-6 md:border-0 md:p-0',
        ]"
      >
        <template v-if="auth.user">
          <RouterLink
            v-for="link in links"
            :key="link.name"
            :to="{ name: link.name }"
            class="text-small text-muted hover:text-default"
            active-class="!text-(--figma-primary-text)"
            data-testid="nav-link"
            @click="open = false"
          >
            {{ link.label }}
          </RouterLink>
          <span class="w-fit rounded-md bg-elevated px-2 py-1 text-caption text-muted" data-testid="user-email">{{ auth.email }}</span>
          <UButton size="sm" color="neutral" variant="outline" class="w-fit" data-testid="logout" @click="logout">
            {{ t('app.logout') }}
          </UButton>
        </template>
      </nav>
    </div>
  </header>
</template>
