<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMeStore } from '@/stores/me'

/** The three pages of one company: its robots, its accounts and roles, and the role preview */
defineProps<{ companyId: string; current: 'robots' | 'roles' | 'preview' }>()

const { t } = useI18n()
const me = useMeStore()
</script>

<template>
  <nav class="flex flex-wrap gap-2 border-b border-default" :aria-label="t('robots.tabs.robots')" data-testid="company-tabs">
    <RouterLink
      :to="{ name: 'company-robots', params: { id: companyId } }"
      :class="['border-b-2 px-3 py-2 text-sm', current === 'robots' ? 'border-primary font-semibold' : 'border-transparent text-muted']"
      :aria-current="current === 'robots' ? 'page' : undefined"
    >
      {{ t('robots.tabs.robots') }}
    </RouterLink>
    <template v-if="me.can('company-roles:manage')">
      <RouterLink
        :to="{ name: 'company-roles', params: { id: companyId } }"
        :class="['border-b-2 px-3 py-2 text-sm', current === 'roles' ? 'border-primary font-semibold' : 'border-transparent text-muted']"
        :aria-current="current === 'roles' ? 'page' : undefined"
      >
        {{ t('robots.tabs.roles') }}
      </RouterLink>
      <RouterLink
        :to="{ name: 'role-preview', params: { id: companyId } }"
        :class="['border-b-2 px-3 py-2 text-sm', current === 'preview' ? 'border-primary font-semibold' : 'border-transparent text-muted']"
        :aria-current="current === 'preview' ? 'page' : undefined"
      >
        {{ t('robots.tabs.preview') }}
      </RouterLink>
    </template>
  </nav>
</template>
