<script setup lang="ts">
import { computed } from 'vue'
import { qrSvg } from '@/lib/qr'

/** A QR code drawn by us (SVG: sharp when printed, and no image to load). The text is the payload of the robot, e.g. rbt:RBT-000212. */
const props = defineProps<{ text: string; label: string; size?: number }>()

const svg = computed(() => qrSvg(props.text))
</script>

<template>
  <!-- The SVG is made by the qr library from our own text: it holds shapes only -->
  <div
    class="qr rounded-2xl border border-default bg-white p-2 text-slate-900"
    role="img"
    :aria-label="label"
    :style="{ width: `${size ?? 152}px`, height: `${size ?? 152}px` }"
    data-testid="qr-code"
    v-html="svg"
  />
</template>

<style scoped>
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
