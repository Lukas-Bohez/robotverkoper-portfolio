<script setup lang="ts">
/** A number with a label on the dashboard of the technician ("3 Open defecten") */
defineProps<{ value: number | string; label: string; tone?: 'neutral' | 'danger' | 'warning' | 'success' }>()
</script>

<template>
  <div
    :class="[
      'flex flex-col gap-1 rounded-2xl p-4',
      tone === 'danger'
        ? 'bg-(--figma-danger-soft) text-(--figma-danger-text)'
        : tone === 'warning'
          ? 'bg-(--figma-warning-soft) text-(--figma-warning-text)'
          : tone === 'success'
            ? 'bg-(--figma-success-soft) text-(--figma-success-text)'
            : 'border border-default bg-default text-muted',
    ]"
  >
    <span :class="['text-section font-semibold', !tone || tone === 'neutral' ? 'text-default' : '']" data-testid="stat-value">{{ value }}</span>
    <span class="text-small">{{ label }}</span>
  </div>
</template>
