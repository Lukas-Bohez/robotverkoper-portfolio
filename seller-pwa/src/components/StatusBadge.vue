<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DefectSeverity, DefectStatusType, RobotStatus } from '@/api/types'
import { defectStatusColor, enumKey, robotStatusColor, severityColor } from '@/lib/status'

/** The status of a robot or a defect, or how bad a defect is: always a word, with a colour next to it (never colour alone) */
const props = defineProps<
  | { kind: 'robot'; value: RobotStatus }
  | { kind: 'defect'; value: DefectStatusType }
  | { kind: 'severity'; value: DefectSeverity }
>()

const { t } = useI18n()

const color = computed(() => {
  if (props.kind === 'robot') return robotStatusColor(props.value)
  if (props.kind === 'defect') return defectStatusColor(props.value)
  return severityColor(props.value)
})

const label = computed(() => {
  const group = props.kind === 'robot' ? 'robots.states' : props.kind === 'defect' ? 'defects.states' : 'severities'
  return t(`${group}.${enumKey(props.value)}`)
})
</script>

<template>
  <UBadge :color="color" variant="subtle" :data-status="enumKey(value)">{{ label }}</UBadge>
</template>
