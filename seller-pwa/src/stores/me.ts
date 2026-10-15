import { computed, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Me, Permission } from '@/api/types'
import { api } from '@/lib/api'
import { useAuthStore } from './auth'

/**
 * Who you are at the robot seller: your role and what it allows. The API decides every call;
 * this only keeps the screens (and the menu) away from what would fail anyway.
 */
export const useMeStore = defineStore('me', () => {
  const me = shallowRef<Me | null>(null)
  let pending: Promise<void> | null = null

  /** Anyone with a role may use the panel; a role without more rights is the technician */
  const isSeller = computed(() => me.value?.role != null)

  function can(permission: Permission): boolean {
    return me.value?.permissions.includes(permission) ?? false
  }

  async function load(force = false): Promise<void> {
    if (me.value && !force) return
    pending ??= api
      .get<Me>('/me')
      .then((data) => {
        me.value = data
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
    (uid) => {
      if (uid === previousUid) return
      previousUid = uid
      reset()
    },
  )

  return { me, isSeller, can, load, reset }
})
