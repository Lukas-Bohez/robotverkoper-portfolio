<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RobotCondition } from '@/api/types'
import InfoTile from '@/components/InfoTile.vue'
import { batteryHoursLeft } from '@/lib/defects'
import { relativeTime, timeOfDay } from '@/lib/format'

/**
 * Everything a technician wants to know about a robot before touching it, as the tiles of the design: tilted, battery,
 * lid, temperature, connection and error code. Red or yellow shows what needs attention. Nothing is guessed: a value
 * that the platform does not know shows a dash.
 */
const props = defineProps<{ condition: RobotCondition | null; battery?: number | null }>()

const { t, locale } = useI18n()

const tilt = computed(() => {
  const c = props.condition
  if (!c) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  return c.tilted
    ? {
        value: t('condition.tiltedYes', { degrees: c.tiltDegrees ?? '?' }),
        hint: t('condition.tiltSensor', { time: timeOfDay(c.capturedAt, locale.value) }),
        tone: 'danger' as const,
      }
    : { value: t('condition.tiltedNo'), hint: t('condition.tiltSensor', { time: timeOfDay(c.capturedAt, locale.value) }), tone: 'ok' as const }
})

const battery = computed(() => {
  const percent = props.condition?.battery ?? props.battery ?? null
  if (percent == null) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  return {
    value: `${percent}%`,
    hint: t('condition.batteryLeft', { hours: batteryHoursLeft(percent) }),
    tone: percent < 20 ? ('warning' as const) : ('ok' as const),
  }
})

const lid = computed(() => {
  const state = props.condition?.lid
  if (!state) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  return {
    value: t(`condition.lid.${state.toLowerCase()}`),
    hint: t(`condition.lidHint.${state.toLowerCase()}`),
    tone: state === 'OPEN' ? ('warning' as const) : ('ok' as const),
  }
})

const temperature = computed(() => {
  const degrees = props.condition?.compartmentTemp
  if (degrees == null) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  const safe = degrees <= 8
  return {
    value: `${degrees} °C`,
    hint: safe ? t('condition.tempSafe') : t('condition.tempWarm'),
    tone: safe ? ('ok' as const) : ('warning' as const),
  }
})

const connection = computed(() => {
  const c = props.condition
  if (!c || c.online == null) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  return {
    value: c.online ? t('robots.states.online') : t('robots.states.offline'),
    hint: c.lastSeenAt ? t('condition.lastContact', { when: relativeTime(c.lastSeenAt, locale.value) }) : t('condition.unknown'),
    tone: c.online ? ('ok' as const) : ('warning' as const),
  }
})

const error = computed(() => {
  const c = props.condition
  if (!c) return { value: '–', hint: t('condition.unknown'), tone: 'ok' as const }
  if (!c.errorCode) return { value: t('condition.noError'), hint: '', tone: 'ok' as const }
  return { value: c.errorCode, hint: c.errorText ?? '', tone: 'danger' as const }
})
</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-3" data-testid="condition-tiles">
    <InfoTile icon="i-lucide-rotate-cw" :label="t('condition.tilted')" :value="tilt.value" :hint="tilt.hint" :tone="tilt.tone" data-testid="tile-tilt" />
    <InfoTile icon="i-lucide-battery" :label="t('condition.battery')" :value="battery.value" :hint="battery.hint" :tone="battery.tone" data-testid="tile-battery" />
    <InfoTile icon="i-lucide-lock" :label="t('condition.lidLabel')" :value="lid.value" :hint="lid.hint" :tone="lid.tone" data-testid="tile-lid" />
    <InfoTile icon="i-lucide-thermometer" :label="t('condition.temperature')" :value="temperature.value" :hint="temperature.hint" :tone="temperature.tone" data-testid="tile-temperature" />
    <InfoTile icon="i-lucide-wifi" :label="t('condition.connection')" :value="connection.value" :hint="connection.hint" :tone="connection.tone" data-testid="tile-connection" />
    <InfoTile icon="i-lucide-triangle-alert" :label="t('condition.error')" :value="error.value" :hint="error.hint" :tone="error.tone" data-testid="tile-error" />
  </div>
</template>
