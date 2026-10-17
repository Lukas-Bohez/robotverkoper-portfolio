<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CHECKLIST_ITEMS, type Defect, type NearbyDefect } from '@/api/types'
import CloseDefectDialog from '@/components/CloseDefectDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTitle from '@/components/PageTitle.vue'
import { useAction, useLoad } from '@/composables/useLoad'
import { cargoCleared, checklistProgress } from '@/lib/defects'
import { distanceLabel } from '@/lib/format'
import { useDefectsStore } from '@/stores/defects'
import { useMeStore } from '@/stores/me'

/** Screen 19: the technician is on site. The safety check first (the food comes out), then repair or replace. */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const me = useMeStore()
const defects = useDefectsStore()
const id = computed(() => String(route.params.id ?? ''))
const defect = ref<Defect | null>(null)
const nearby = ref<NearbyDefect[]>([])
const closing = ref(false)
const asking = ref(false)
const action = useAction()

const { loading, error, run } = useLoad(async () => {
  defect.value = await defects.find(id.value)
  nearby.value = defect.value ? await defects.nearby(id.value).catch(() => []) : []
}, () => t('defect.loadError'))
onMounted(() => void run())

const done = computed(() => defect.value?.checklistDone ?? [])
const progress = computed(() => checklistProgress(done.value))
const cleared = computed(() => (defect.value ? cargoCleared(defect.value) : false))

async function toggle(item: string) {
  const current = defect.value
  if (!current) return
  const next = done.value.includes(item) ? done.value.filter(i => i !== item) : [...done.value, item]
  const updated = await action.run(() => defects.updateChecklist(current.id, next), t('onSite.checkError'))
  if (updated) defect.value = updated
}

async function takeAlong(other: NearbyDefect) {
  await action.run(() => defects.claim(other.defect.id), t('defect.claimError'))
  nearby.value = nearby.value.filter(item => item.defect.id !== other.defect.id)
}

async function askHelp() {
  const current = defect.value
  if (!current) return
  const ok = await action.run(() => defects.requestHelp(current.id), t('help.error'))
  if (ok) asking.value = false
}

function onClosed() {
  closing.value = false
  void router.push({ name: 'tasks' })
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" role="status" :aria-label="t('defect.loading')">
    <USkeleton class="h-10 w-48" />
    <USkeleton class="h-56 w-full rounded-2xl" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" />
  <p v-else-if="!defect" data-testid="onsite-not-found">{{ t('defect.notFound') }}</p>
  <template v-else>
    <RouterLink :to="{ name: 'defect', params: { id: defect.id } }" class="text-small text-(--figma-primary-text)">← {{ t('onSite.back') }}</RouterLink>
    <PageTitle :title="t('onSite.title')" :subtitle="`${defect.robot.name} · ${defect.company.name}`" />
    <UAlert color="primary" variant="subtle" :title="t('onSite.intro')" />
    <UAlert v-if="action.error.value" color="error" variant="subtle" :title="action.error.value" data-testid="onsite-error" />

    <section class="flex flex-col gap-4 rounded-2xl border border-default bg-default p-4" data-testid="checklist">
      <h2 class="text-card font-semibold">{{ t('onSite.checkTitle') }}</h2>
      <ul class="flex flex-col gap-3">
        <li v-for="item in CHECKLIST_ITEMS" v-show="item !== 'cargo_removed' || defect.condition?.hasCargo" :key="item">
          <UCheckbox
            :model-value="done.includes(item)"
            :label="t(`onSite.items.${item}`, { order: defect.condition?.cargoSummary ?? '', battery: defect.condition?.battery ?? '–' })"
            :data-testid="`check-${item}`"
            @update:model-value="toggle(item)"
          />
        </li>
      </ul>
      <p class="text-caption text-muted" data-testid="check-progress">{{ t('onSite.progress', progress) }}</p>
    </section>

    <section v-if="nearby.length" class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-4" data-testid="onsite-nearby">
      <h2 class="text-card font-semibold">{{ t('defect.nearbyTitle') }}</h2>
      <p class="text-caption text-muted">{{ t('onSite.nearbyHint') }}</p>
      <div v-for="item in nearby" :key="item.defect.id" class="flex items-center justify-between gap-3">
        <div class="flex flex-col">
          <span class="text-small font-semibold">{{ item.defect.robot.name }}</span>
          <span class="text-caption text-muted">{{ item.defect.company.name }} · {{ item.defect.summary }} · {{ distanceLabel(item.distanceMeters, locale) }}</span>
        </div>
        <UButton color="neutral" variant="outline" size="sm" data-testid="onsite-take" @click="takeAlong(item)">{{ t('onSite.takeToo') }}</UButton>
      </div>
    </section>

    <h2 class="text-card font-semibold">{{ t('onSite.next') }}</h2>
    <UAlert v-if="!cleared" color="warning" variant="subtle" :title="t('onSite.cargoFirst')" data-testid="onsite-cargo" />
    <div class="flex flex-col gap-2">
      <UButton v-if="me.can('robots:replace')" size="xl" class="justify-center" :disabled="!cleared" data-testid="onsite-replace" @click="router.push({ name: 'replace', params: { id: defect.id } })">
        {{ t('onSite.replace') }}
      </UButton>
      <UButton v-if="me.can('defects:close')" color="neutral" variant="outline" size="xl" class="justify-center" data-testid="onsite-close" @click="closing = true">
        {{ t('onSite.repaired') }}
      </UButton>
      <UButton color="neutral" variant="outline" size="xl" class="justify-center" data-testid="onsite-help" @click="asking = true">{{ t('moreActions.help') }}</UButton>
    </div>

    <CloseDefectDialog v-if="closing" :defect="defect" @close="closing = false" @closed="onClosed" />
    <ConfirmDialog
      v-if="asking"
      :title="t('help.title')"
      :message="t('help.message', { robot: defect.robot.name })"
      :confirm-label="t('help.confirm')"
      :busy="action.busy.value"
      :error="action.error.value"
      @confirm="askHelp"
      @cancel="asking = false"
    />
  </template>
</template>
