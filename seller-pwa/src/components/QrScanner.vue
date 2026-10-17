<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Scans the QR code on a robot with the camera (the BarcodeDetector of the browser). Where that is not available, or
 * the camera is refused, or the code is damaged, the number below it can be typed in: the screen always works.
 */
const props = defineProps<{ prompt: string; manualLabel: string }>()
const emit = defineEmits<{ scanned: [text: string] }>()

const { t } = useI18n()
const video = ref<HTMLVideoElement | null>(null)
const manual = ref(false)
const code = ref('')
const cameraFailed = ref(false)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | undefined
let done = false

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector

function stop(): void {
  clearInterval(timer)
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

onMounted(async () => {
  const Detector = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
  if (!Detector || !navigator.mediaDevices?.getUserMedia) {
    cameraFailed.value = true
    manual.value = true
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (!video.value) return stop()
    video.value.srcObject = stream
    await video.value.play()
    const detector = new Detector({ formats: ['qr_code'] })
    timer = setInterval(async () => {
      if (done || !video.value) return
      const found = await detector.detect(video.value).catch(() => [])
      const first = found[0]?.rawValue
      if (first) {
        done = true
        stop()
        emit('scanned', first)
      }
    }, 300)
  } catch {
    cameraFailed.value = true
    manual.value = true
  }
})

onBeforeUnmount(stop)

function submit() {
  const value = code.value.trim()
  if (!value) return
  emit('scanned', value)
  code.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="qr-scanner">
    <div
      class="relative flex aspect-[358/320] flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl bg-slate-900 p-6 text-center text-white"
    >
      <video v-show="!cameraFailed" ref="video" class="absolute inset-0 size-full object-cover opacity-80" playsinline muted />
      <!-- The four corners of the frame (the design) -->
      <svg viewBox="0 0 72 72" class="relative size-20" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 28V18a8 8 0 0 1 8-8h10M44 10h10a8 8 0 0 1 8 8v10M62 44v10a8 8 0 0 1-8 8H44M28 62H18a8 8 0 0 1-8-8V44" />
      </svg>
      <p class="relative max-w-64 text-small" data-testid="scanner-prompt">{{ props.prompt }}</p>
      <p v-if="cameraFailed" class="relative max-w-64 text-caption opacity-80" data-testid="scanner-fallback">{{ t('scanner.noCamera') }}</p>
    </div>

    <UButton v-if="!manual" color="neutral" variant="outline" class="justify-center" data-testid="scanner-manual-open" @click="manual = true">
      {{ manualLabel }}
    </UButton>
    <form v-else class="flex gap-2" data-testid="scanner-manual" @submit.prevent="submit">
      <UInput
        v-model="code"
        class="flex-1"
        size="xl"
        :placeholder="t('scanner.placeholder')"
        :aria-label="t('scanner.codeLabel')"
        autocapitalize="characters"
        autocomplete="off"
        data-testid="scanner-code"
      />
      <UButton type="submit" size="xl" :disabled="!code.trim()" data-testid="scanner-submit">{{ t('scanner.use') }}</UButton>
    </form>
  </div>
</template>
