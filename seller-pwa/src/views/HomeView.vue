<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMeStore } from '@/stores/me'

/** Nothing to see: sends a person to where their role starts (the dashboard of a technician, else the companies) */
const router = useRouter()
const me = useMeStore()

onMounted(() => void router.replace({ name: me.home }))
</script>

<template>
  <span class="sr-only" role="status" data-testid="home-redirect">…</span>
</template>
