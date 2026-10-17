<script setup lang="ts">
import { useId } from 'vue'

/**
 * A choice among known values is a dropdown, never a text field (the Select component of the design): customers do
 * not know what to type. A real <select>: it works with the keyboard, with a screen reader and with the picker of a
 * phone, and it looks like the Field next to it.
 */
defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

defineProps<{
  label: string
  options: SelectOption[]
  hint?: string
  placeholder?: string
  disabled?: boolean
}>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <UFormField :label="label" :hint="undefined" :help="hint" :name="id">
    <div class="relative">
      <select
        :id="id"
        v-model="model"
        :disabled="disabled"
        v-bind="$attrs"
        class="h-12 w-full appearance-none rounded-lg border border-default bg-default px-4 pr-10 text-small text-default outline-none focus:border-(--figma-primary) focus:ring-2 focus:ring-(--figma-primary)/30 disabled:opacity-60"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
          {{ option.label }}
        </option>
      </select>
      <UIcon
        name="i-lucide-chevron-down"
        class="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  </UFormField>
</template>
