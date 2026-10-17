<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Defect } from '@/api/types'
import { timeline } from '@/lib/defects'
import { timeOfDay } from '@/lib/format'

/** "Verloop": the story of a defect, from the report to the repair. The next step is shown lighter. */
const props = defineProps<{ defect: Defect }>()

const { t, locale } = useI18n()
const events = computed(() => timeline(props.defect))

function text(event: ReturnType<typeof timeline>[number]): string {
  const v = event.values
  switch (event.key) {
    case 'reported':
      return t('timeline.reported', { by: v.by ?? '' })
    case 'condition':
      return t(v.cargo && v.tilted ? 'timeline.conditionBoth' : v.cargo ? 'timeline.conditionCargo' : 'timeline.conditionTilted')
    case 'claimed':
      return t('timeline.claimed', { by: v.by ?? '' })
    case 'enroute':
      return v.minutes != null ? t('timeline.enrouteEta', { minutes: v.minutes }) : t('timeline.enroute')
    case 'onsite':
      return t('timeline.onsite')
    case 'resolved':
      return t(`timeline.resolved.${String(v.resolution || 'repaired').toLowerCase()}`)
    default:
      return t('timeline.next')
  }
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4 md:p-8" data-testid="timeline">
    <h2 class="text-card font-semibold">{{ t('timeline.title') }}</h2>
    <ol class="flex flex-col gap-4">
      <li v-for="(event, index) in events" :key="`${event.key}-${index}`" class="flex gap-3" :class="event.pending ? 'text-muted' : ''" data-testid="timeline-event">
        <span class="mt-1.5 size-3 shrink-0 rounded-full" :class="event.pending ? 'bg-accented' : 'bg-primary'" aria-hidden="true" />
        <div class="flex flex-col gap-0.5">
          <span class="text-small" :class="event.pending ? '' : 'text-default'">{{ text(event) }}</span>
          <span v-if="event.at || event.pending" class="text-caption text-muted">{{ event.at ? timeOfDay(event.at, locale) : t('timeline.soon') }}</span>
        </div>
      </li>
    </ol>
  </section>
</template>
