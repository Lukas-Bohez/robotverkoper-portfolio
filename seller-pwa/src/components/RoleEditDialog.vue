<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocalizedNames, SellerRole } from '@/api/types'
import AppDialog from '@/components/AppDialog.vue'
import SelectField from '@/components/SelectField.vue'
import { useAction } from '@/composables/useLoad'
import { EXTRA_RIGHTS, isStandardRight, roleKeyFromName } from '@/lib/roles'
import { useTeamStore } from '@/stores/team'

/**
 * Screen 14: edit a role of our own staff (or make a new one): the name in every language and the extra rights. The extra
 * rights are chosen from a list in words, never typed: a customer does not know what "area:actie" means.
 */
const props = defineProps<{ role: SellerRole | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const team = useTeamStore()
const { busy, error, run } = useAction()

const names = reactive<Required<{ [K in keyof LocalizedNames]: string }>>({
  nl: props.role?.names.nl ?? '',
  en: props.role?.names.en ?? '',
  fr: props.role?.names.fr ?? '',
  de: props.role?.names.de ?? '',
})
/** Extra rights held now (claims that are not standard) */
const extras = ref<string[]>((props.role?.permissions ?? []).filter(key => !isStandardRight(key)))
const pick = ref('')
const archiving = ref(false)

const available = computed(() => EXTRA_RIGHTS.filter(key => !extras.value.includes(key)).map(key => ({ value: key, label: t(`extraRights.${key.replace(':', '_')}`) })))
const label = (key: string) => (EXTRA_RIGHTS as readonly string[]).includes(key) ? t(`extraRights.${key.replace(':', '_')}`) : key
const canSave = computed(() => Object.values(names).some(value => value.trim() !== '') && !busy.value)

function addExtra() {
  if (pick.value && !extras.value.includes(pick.value)) extras.value = [...extras.value, pick.value]
  pick.value = ''
}

async function save() {
  const clean = Object.fromEntries(Object.entries(names).map(([code, value]) => [code, value.trim() || null])) as LocalizedNames
  const done = await run(async () => {
    if (props.role) {
      const standard = props.role.permissions.filter(isStandardRight)
      return team.updateRole(props.role.id, { names: clean, permissions: [...standard, ...extras.value] })
    }
    const first = names.nl.trim() || names.en.trim() || names.fr.trim() || names.de.trim()
    return team.createRole({ key: roleKeyFromName(first), names: clean, permissions: [...extras.value] })
  }, t('roleEdit.error'))
  if (done) emit('saved')
}

async function archive() {
  const role = props.role
  if (!role) return
  const done = await run(() => team.removeRole(role.id), t('roleEdit.archiveError'))
  if (done) emit('saved')
}
</script>

<template>
  <AppDialog :title="role ? t('roleEdit.title', { name: role.name }) : t('roleEdit.newTitle')" testid="role-edit" wide @close="emit('close')">
    <form class="flex flex-col gap-6" @submit.prevent="save">
      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 text-small font-semibold">{{ t('roleEdit.namePerLanguage') }}</legend>
        <UFormField v-for="code in (['nl', 'en', 'fr', 'de'] as const)" :key="code" :label="t(`roleEdit.lang.${code}`)" :help="code === 'de' ? t('roleEdit.fallback') : undefined">
          <UInput v-model="names[code]" maxlength="40" class="w-full" size="xl" :data-testid="`name-${code}`" />
        </UFormField>
      </fieldset>

      <section class="flex flex-col gap-3">
        <h3 class="text-small font-semibold">{{ t('roleEdit.extraTitle') }}</h3>
        <div v-if="extras.length" class="flex flex-wrap gap-2" data-testid="extra-chips">
          <UBadge v-for="key in extras" :key="key" color="primary" variant="subtle" class="gap-1">
            {{ label(key) }}
            <button type="button" class="ml-1" :aria-label="t('roleEdit.removeExtra', { right: label(key) })" :data-testid="`extra-remove-${key}`" @click="extras = extras.filter(k => k !== key)">✕</button>
          </UBadge>
        </div>
        <SelectField v-model="pick" :label="t('roleEdit.addExtra')" :options="available" :placeholder="t('roleEdit.pickExtra')" :hint="t('roleEdit.pickHint')" data-testid="extra-select" />
        <UButton color="neutral" variant="outline" class="w-fit" :disabled="!pick" data-testid="extra-add" @click="addExtra">{{ t('roleEdit.add') }}</UButton>
      </section>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" data-testid="role-edit-error" />
      <div class="flex flex-wrap gap-4">
        <UButton type="submit" :loading="busy" :disabled="!canSave" data-testid="role-save">{{ t('common.save') }}</UButton>
        <UButton color="neutral" variant="outline" data-testid="role-cancel" @click="emit('close')">{{ t('common.cancel') }}</UButton>
        <UButton v-if="role && !role.locked" color="error" variant="ghost" class="ml-auto" data-testid="role-archive" @click="archiving = true">{{ t('roleEdit.archive') }}</UButton>
      </div>
    </form>
    <UAlert v-if="archiving" color="warning" variant="subtle" :title="t('roleEdit.archiveConfirm')" data-testid="role-archive-confirm">
      <template #actions>
        <UButton size="sm" color="error" data-testid="role-archive-yes" @click="archive">{{ t('roleEdit.archive') }}</UButton>
        <UButton size="sm" color="neutral" variant="outline" @click="archiving = false">{{ t('common.cancel') }}</UButton>
      </template>
    </UAlert>
  </AppDialog>
</template>
