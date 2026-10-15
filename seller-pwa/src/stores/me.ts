import { computed, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { ME, type Me } from '@/graphql/operations'
import { graphql } from '@/lib/graphql'
import { useAuthStore } from './auth'

/**
 * Who you are on the platform. Only a platform admin may use this panel; the API
 * decides, this only keeps the screens away from what would fail anyway.
 */
export const useMeStore = defineStore('me', () => {
  const me = shallowRef<Me | null>(null)
  let pending: Promise<void> | null = null

  const isSeller = computed(() => me.value?.platformRole === 'PLATFORM_ADMIN')

  async function load(force = false): Promise<void> {
    if (me.value && !force) return
    pending ??= graphql
      .query<{ me: Me }>(ME)
      .then((data) => {
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
    (uid) => {
      if (uid === previousUid) return
      const hadUser = previousUid !== null
      previousUid = uid
      reset()
      if (hadUser) void graphql.reset().catch(() => undefined)
    },
  )

  return { me, isSeller, load, reset }
})
