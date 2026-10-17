import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { ArchiveKind, ArchivedItem, ColdStorageResult } from '@/api/types'

export const ARCHIVE: TypedDocumentNode<
  { archive: ArchivedItem[] },
  { kind?: ArchiveKind | null; year?: number | null }
> = gql`
  query Archive($kind: ArchiveKind, $year: Int) {
    archive(kind: $kind, year: $year) {
      id
      kind
      label
      detail
      archivedAt
      archivedBy
    }
  }
`

export const RESTORE_ARCHIVED: TypedDocumentNode<
  { restoreArchived: ArchivedItem },
  { kind: ArchiveKind; id: string }
> = gql`
  mutation RestoreArchived($kind: ArchiveKind!, $id: ID!) {
    restoreArchived(kind: $kind, id: $id) {
      id
      kind
      label
    }
  }
`

/** The calendar years that have data in cold storage (the chips of the filter) */
export const COLD_STORAGE_YEARS: TypedDocumentNode<{ coldStorageYears: number[] }> = gql`
  query ColdStorageYears {
    coldStorageYears
  }
`

export const MOVE_TO_COLD_STORAGE: TypedDocumentNode<
  { moveToColdStorage: ColdStorageResult },
  { months?: number }
> = gql`
  mutation MoveToColdStorage($months: Int) {
    moveToColdStorage(months: $months) {
      defects
      auditEntries
    }
  }
`
