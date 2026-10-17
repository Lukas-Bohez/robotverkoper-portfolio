<script setup lang="ts">
/** One fact about a robot (tilted, battery, lid, ...) with an icon and a tone: a soft red or yellow shows what needs attention */
defineProps<{
  icon: string
  label: string
  value: string
  hint?: string
  tone?: 'ok' | 'warning' | 'danger'
}>()
</script>

<template>
  <div
    :class="[
      'flex flex-col gap-2 rounded-2xl p-4',
      tone === 'danger'
        ? 'bg-(--figma-danger-soft) text-(--figma-danger-text)'
        : tone === 'warning'
          ? 'bg-(--figma-warning-soft) text-(--figma-warning-text)'
          : 'border border-default bg-default',
    ]"
    :data-tone="tone ?? 'ok'"
  >
    <div class="flex items-center gap-2 text-caption" :class="tone && tone !== 'ok' ? '' : 'text-muted'">
      <UIcon :name="icon" class="size-5" aria-hidden="true" />
      <span>{{ label }}</span>
    </div>
    <span class="text-body font-semibold" :class="tone && tone !== 'ok' ? '' : 'text-default'">{{ value }}</span>
    <span v-if="hint" class="text-caption" :class="tone && tone !== 'ok' ? '' : 'text-muted'">{{ hint }}</span>
  </div>
</template>
