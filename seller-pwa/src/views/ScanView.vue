<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageTitle from '@/components/PageTitle.vue'
import QrScanner from '@/components/QrScanner.vue'
import { parseRobotCode } from '@/lib/qr'
import { useRobotsStore } from '@/stores/robots'

/** The tab "Scannen": scan the QR code on any robot and see everything about it */
const { t } = useI18n()
const router = useRouter()
const robots = useRobotsStore()
const message = ref('')

async function scanned(text: string) {
  message.value = ''
  const code = parseRobotCode(text)
  if (!code) return void (message.value = t('replace.notOurs'))
  try {
    const robot = await robots.byCode(code)
    if (!robot) return void (message.value = t('replace.unknown', { serial: code }))
    await router.push({ name: 'robot', params: { id: robot.id } })
  } catch {
    message.value = t('replace.lookupError')
  }
}
</script>

<template>
  <PageTitle :title="t('scan.title')" :subtitle="t('scan.subtitle')" />
  <UAlert v-if="message" color="warning" variant="subtle" :title="message" data-testid="scan-message" />
  <QrScanner :prompt="t('scan.prompt')" :manual-label="t('scanner.enter')" @scanned="scanned" />
</template>
