import { computed, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Me } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { ME } from '@/graphql/me.query'
import { i18n } from '@/i18n'
import { useAuthStore } from './auth'

/**
 * Who you are at the robot seller: your role and what it allows. The API decides every call;
 * this only keeps the screens (and the menu) away from what would fail anyway.
 */
export const useMeStore = defineStore('me', () => {
  const { apolloClient } = useGraphql()
  const me = shallowRef<Me | null>(null)
  let pending: Promise<void> | null = null

  /** Anyone with a role may use the panel; a role without more rights is the technician */
  const isSeller = computed(() => me.value?.role != null)

  /** A standard right or an extra claim (the API stores both in the same list) */
  function can(permission: string): boolean {
    return me.value?.permissions.includes(permission) ?? false
  }

  /**
   * Where this person starts: a technician (who takes defects but does not manage people or companies) lands on the
   * dashboard, everyone else on the companies.
   */
  const home = computed<'tasks' | 'companies'>(() =>
    can('defects:claim') && !can('companies:create') && !can('accounts:manage') ? 'tasks' : 'companies',
  )

  async function load(force = false): Promise<void> {
    if (me.value && !force) return
    pending ??= apolloClient
      .query({ query: ME, variables: { language: i18n.global.locale.value } })
      .then(({ data }) => {
        me.value = data.me
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  function reset() {
    me.value = null
    pending = null
  }

  // Someone else logs in (or out): forget the old user and everything of theirs
  const auth = useAuthStore()
  let previousUid: string | null = auth.user?.uid ?? null
  watch(
    () => auth.user?.uid ?? null,
    uid => {
      if (uid === previousUid) return
      previousUid = uid
      reset()
    },
  )

  return { me, isSeller, home, can, load, reset }
})
