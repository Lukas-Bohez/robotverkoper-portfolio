<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LanguageSheet from '@/components/LanguageSheet.vue'
import { useLanguage } from '@/composables/useLanguage'
import type { Language } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const { language, languages, setLanguage } = useLanguage()
const menuOpen = ref(false)
const sheetOpen = ref(false)

const links = computed(() => {
  const all: { name: string; label: string; show: boolean }[] = [
    { name: 'companies', label: t('app.companies'), show: me.can('companies:read') },
    { name: 'defects', label: t('app.defects'), show: me.can('defects:read') },
    { name: 'team', label: t('app.team'), show: me.can('accounts:manage') },
    // A technician starts at the dashboard; an administrator has the companies instead
    { name: 'tasks', label: t('app.tasks'), show: me.home === 'tasks' },
  ]
  return auth.user ? all.filter(link => link.show) : []
})

async function logout() {
  menuOpen.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}

async function pick(code: Language) {
  await setLanguage(code)
}
</script>

<template>
  <!-- The header of the design: 72 px high, the brand on the left and the menu on the right. The languages are only for
       someone who is logged in (the login page stays quiet). -->
  <header class="relative border-b border-default bg-default">
    <div class="mx-auto flex h-18 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-16">
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2" data-testid="brand">
        <span class="size-8 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span class="flex flex-col">
          <span class="text-body leading-6">{{ t('app.title') }}</span>
          <span class="hidden text-caption text-muted md:block">{{ t('app.tagline') }}</span>
        </span>
      </RouterLink>

      <!-- On a phone: the language and the menu as two small buttons -->
      <div v-if="auth.user" class="flex gap-2 md:hidden">
        <UButton color="neutral" variant="outline" size="sm" :aria-label="t('app.language')" data-testid="language-open" @click="sheetOpen = true">
          {{ language.toUpperCase() }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :aria-expanded="menuOpen"
          aria-controls="main-menu"
          data-testid="menu-toggle"
          @click="menuOpen = !menuOpen"
        >
          {{ t('app.menu') }}
        </UButton>
      </div>

      <nav
        id="main-menu"
        :aria-label="t('app.menu')"
        :class="[
          menuOpen ? 'flex' : 'hidden',
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
            @click="menuOpen = false"
          >
            {{ link.label }}
          </RouterLink>

          <!-- On a computer: the four languages as chips next to the menu -->
          <div class="hidden gap-1 md:flex" role="group" :aria-label="t('app.language')" data-testid="language-chips">
            <button
              v-for="code in languages"
              :key="code"
              type="button"
              :aria-pressed="language === code"
              :data-testid="`language-${code}`"
              :class="[
                'rounded-full px-2 py-1 text-caption',
                language === code ? 'bg-(--figma-primary-soft) text-(--figma-primary-text)' : 'bg-elevated text-muted hover:text-default',
              ]"
              @click="pick(code)"
            >
              {{ code.toUpperCase() }}
            </button>
          </div>

          <span class="w-fit rounded-md bg-elevated px-2 py-1 text-caption text-muted" data-testid="user-email">{{ auth.email }}</span>
          <UButton size="sm" color="neutral" variant="outline" class="w-fit" data-testid="logout" @click="logout">
            {{ t('app.logout') }}
          </UButton>
        </template>
      </nav>
    </div>

    <LanguageSheet v-if="sheetOpen" @close="sheetOpen = false" />
  </header>
</template>
