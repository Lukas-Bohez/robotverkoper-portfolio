<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The filter per year (chips of the design): this year is shown at once; a year from cold storage (older than 12 months)
 * is loaded when chosen, and "Koude opslag" shows everything that is in cold storage. Data in cold storage is never
 * lost, it only loads a little slower.
 */
export interface YearFilter {
  year: number | null
  /** Include what is in cold storage */
  cold: boolean
}

const props = defineProps<{ years: number[]; now?: Date }>()
const model = defineModel<YearFilter>({ required: true })

const { t } = useI18n()
const thisYear = computed(() => (props.now ?? new Date()).getFullYear())
const olderYears = computed(() => props.years.filter(year => year !== thisYear.value))

function isActive(year: number | null, cold: boolean): boolean {
  return model.value.year === year && model.value.cold === cold
}
</script>

<template>
  <div class="flex flex-wrap gap-2" role="group" :aria-label="t('years.label')" data-testid="year-chips">
    <UButton
      size="sm"
      :color="isActive(thisYear, false) ? 'primary' : 'neutral'"
      :variant="isActive(thisYear, false) ? 'subtle' : 'outline'"
      class="rounded-full"
      :aria-pressed="isActive(thisYear, false)"
      data-testid="year-current"
      @click="model = { year: thisYear, cold: false }"
    >
      {{ thisYear }}
    </UButton>
    <UButton
      v-for="year in olderYears"
      :key="year"
      size="sm"
      :color="isActive(year, true) ? 'primary' : 'neutral'"
      :variant="isActive(year, true) ? 'subtle' : 'outline'"
      class="rounded-full"
      :aria-pressed="isActive(year, true)"
      :data-testid="`year-${year}`"
      @click="model = { year, cold: true }"
    >
      {{ year }}
    </UButton>
    <UButton
      size="sm"
      :color="isActive(null, true) ? 'primary' : 'neutral'"
      :variant="isActive(null, true) ? 'subtle' : 'outline'"
      class="rounded-full"
      :aria-pressed="isActive(null, true)"
      data-testid="year-cold"
      @click="model = { year: null, cold: true }"
    >
      {{ t('years.cold') }}
    </UButton>
  </div>
</template>
