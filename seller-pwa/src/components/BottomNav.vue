<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import LanguageSheet from '@/components/LanguageSheet.vue'
import { useAuthStore } from '@/stores/auth'

/**
 * The menu of the technician on a phone (the BottomNav of the design): tasks, defects, scan, more. "More" holds the
 * language and logging out. It only shows on a phone: on a computer the header has the menu.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const more = ref(false)
const languages = ref(false)

const items = computed(() => [
  { key: 'tasks', icon: 'i-lucide-list', label: t('bottomNav.tasks'), active: route.name === 'tasks' },
  {
    key: 'defects',
    icon: 'i-lucide-triangle-alert',
    label: t('bottomNav.defects'),
    active: ['defects', 'defect', 'on-site'].includes(String(route.name)),
  },
  { key: 'scan', icon: 'i-lucide-scan-qr-code', label: t('bottomNav.scan'), active: ['scan', 'replace'].includes(String(route.name)) },
])

async function logout() {
  more.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <nav
    v-if="auth.user"
    :aria-label="t('bottomNav.label')"
    class="fixed inset-x-0 bottom-0 z-30 flex h-18 border-t border-default bg-default md:hidden"
    data-testid="bottom-nav"
  >
    <RouterLink
      v-for="item in items"
      :key="item.key"
      :to="{ name: item.key }"
      :class="['flex flex-1 flex-col items-center justify-center gap-1 text-caption', item.active ? 'font-medium text-(--figma-primary-text)' : 'text-muted']"
      :aria-current="item.active ? 'page' : undefined"
      :data-testid="`bottom-${item.key}`"
    >
      <UIcon :name="item.icon" class="size-6" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </RouterLink>
    <button
      type="button"
      class="flex flex-1 flex-col items-center justify-center gap-1 text-caption text-muted"
      :aria-expanded="more"
      data-testid="bottom-more"
      @click="more = !more"
    >
      <UIcon name="i-lucide-menu" class="size-6" aria-hidden="true" />
      <span>{{ t('bottomNav.more') }}</span>
    </button>

    <div
      v-if="more"
      class="absolute inset-x-0 bottom-full flex flex-col gap-2 border-t border-default bg-default p-4"
      data-testid="bottom-more-menu"
    >
      <span class="text-caption text-muted">{{ auth.email }}</span>
      <UButton color="neutral" variant="outline" class="justify-center" data-testid="more-language" @click="((languages = true), (more = false))">
        {{ t('app.language') }}
      </UButton>
      <UButton color="neutral" variant="outline" class="justify-center" data-testid="more-logout" @click="logout">
        {{ t('app.logout') }}
      </UButton>
    </div>
  </nav>
  <LanguageSheet v-if="languages" @close="languages = false" />
</template>
