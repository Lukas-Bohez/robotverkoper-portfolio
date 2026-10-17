<script setup lang="ts">
/** The title of a page with an optional status next to it, a line under it and the main actions on the right (desktop) */
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-4">
        <h1 class="text-section font-semibold md:text-page" data-testid="page-title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="subtitle" class="text-small text-muted md:text-body" data-testid="page-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-4">
      <slot name="actions" />
    </div>
  </div>
</template>
