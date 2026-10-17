<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import CallBanner from '@/components/CallBanner.vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const { t } = useI18n()
const auth = useAuthStore()
const me = useMeStore()

/** A technician gets the menu at the bottom of a phone and hears the calls; the administrator works on a computer */
const technician = computed(() => Boolean(auth.user) && me.isSeller && me.home === 'tasks')
</script>

<template>
  <UApp>
    <a
      href="#content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-default focus:p-2"
    >
      {{ t('app.skip') }}
    </a>
    <AppHeader />
    <CallBanner v-if="technician" />
    <!-- The page: 64 px at the sides on a computer, 16 px on a phone (the design of Figma) -->
    <main
      id="content"
      :class="[
        'mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 md:px-16 md:py-10',
        technician ? 'pb-24 md:pb-10' : '',
      ]"
    >
      <RouterView />
    </main>
    <BottomNav v-if="technician" />
  </UApp>
</template>
