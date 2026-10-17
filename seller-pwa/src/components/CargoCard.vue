<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RobotCondition } from '@/api/types'
import { foodSafeUntil } from '@/lib/defects'
import { minutesBetween, timeOfDay } from '@/lib/format'

/** What is still inside the robot ("Lading: eten aan boord"): the order, since when, and until when it stays safe */
const props = defineProps<{ condition: RobotCondition }>()

const { t, locale } = useI18n()

const since = computed(() =>
  props.condition.cargoSince
    ? t('cargo.since', {
        time: timeOfDay(props.condition.cargoSince, locale.value),
        minutes: minutesBetween(props.condition.cargoSince),
      })
    : null,
)
const safeUntil = computed(() =>
  props.condition.cargoSince ? t('cargo.safeUntil', { time: timeOfDay(foodSafeUntil(props.condition.cargoSince), locale.value) }) : null,
)
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="cargo-card">
    <h2 class="flex items-center gap-2 text-card font-semibold">
      <UIcon name="i-lucide-utensils" class="size-6 text-(--figma-warning-text)" aria-hidden="true" />
      {{ t('cargo.title') }}
    </h2>
    <p v-if="condition.cargoSummary" class="text-body font-semibold" data-testid="cargo-summary">{{ condition.cargoSummary }}</p>
    <div v-if="since || safeUntil" class="flex flex-wrap gap-2">
      <UBadge v-if="since" color="warning" variant="subtle" data-testid="cargo-since">{{ since }}</UBadge>
      <UBadge v-if="safeUntil" color="warning" variant="subtle" data-testid="cargo-safe">{{ safeUntil }}</UBadge>
    </div>
  </section>
</template>
