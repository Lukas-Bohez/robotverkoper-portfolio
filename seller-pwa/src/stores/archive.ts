import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ArchiveKind, ArchivedItem, ColdStorageResult } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { ARCHIVE, COLD_STORAGE_YEARS, MOVE_TO_COLD_STORAGE, RESTORE_ARCHIVED } from '@/graphql/archive.query'

/**
 * The archive: everything that was "deleted" (soft delete) in one place, of every kind, with the year it was archived.
 * Nothing is removed for real, so everything can be restored. Old data goes to cold storage, read per year.
 */
export const useArchiveStore = defineStore('archive', () => {
  const { apolloClient } = useGraphql()
  const items = ref<ArchivedItem[]>([])
  const years = ref<number[]>([])

  async function load(filter: { kind?: ArchiveKind | null; year?: number | null } = {}): Promise<void> {
    const { data } = await apolloClient.query({ query: ARCHIVE, variables: filter })
    items.value = data.archive
  }

  async function loadYears(): Promise<void> {
    const { data } = await apolloClient.query({ query: COLD_STORAGE_YEARS })
    years.value = data.coldStorageYears
  }

  /** Brings something back from the archive, whatever it is */
  async function restore(kind: ArchiveKind, id: string): Promise<void> {
    await apolloClient.mutate({ mutation: RESTORE_ARCHIVED, variables: { kind, id } })
    items.value = items.value.filter(item => !(item.kind === kind && item.id === id))
  }

  /** Moves what is older than a number of months (default a year) to cold storage */
  async function moveToColdStorage(months?: number): Promise<ColdStorageResult> {
    const { data } = await apolloClient.mutate({ mutation: MOVE_TO_COLD_STORAGE, variables: { months } })
    if (!data) throw new Error('No answer came back')
    return data.moveToColdStorage
  }

  return { items, years, load, loadYears, restore, moveToColdStorage }
})
