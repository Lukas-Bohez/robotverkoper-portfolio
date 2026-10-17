<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

/**
 * A popup: a card in the middle of the screen on a computer, a sheet that comes from below on a phone (the popups of
 * the design, P1 to P10). The dimmed page behind it is the layer you click to close. Escape closes it, focus moves
 * into it and returns to where it was, and Tab stays inside (a dialog the keyboard cannot escape from would trap).
 */
const props = defineProps<{ title: string; description?: string; testid?: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  const first = dialog.value?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.value?.querySelector<HTMLElement>(FOCUSABLE)
  ;(first ?? dialog.value)?.focus()
})

onBeforeUnmount(() => previouslyFocused?.focus?.())

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const items = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-(--figma-dim) md:items-center md:p-4"
    data-testid="dialog-layer"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <section
      ref="dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-labelledby="titleId"
      :aria-describedby="props.description ? descriptionId : undefined"
      :data-testid="testid ?? 'dialog'"
      :class="[
        'flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-default p-6 shadow-xl outline-none md:gap-6 md:rounded-2xl md:p-8',
        wide ? 'md:max-w-xl' : 'md:max-w-[480px]',
      ]"
    >
      <span class="mx-auto -mt-2 h-1 w-10 rounded-full bg-accented md:hidden" aria-hidden="true" />
      <h2 :id="titleId" class="text-card font-semibold">{{ title }}</h2>
      <p v-if="description" :id="descriptionId" class="text-small text-muted">{{ description }}</p>
      <slot />
    </section>
  </div>
</template>
