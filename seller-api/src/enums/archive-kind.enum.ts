import { registerEnumType } from '@nestjs/graphql'

/** What can be archived (soft delete) and restored in the archive screen */
export enum ArchiveKind {
  ACCOUNT = 'ACCOUNT',
  SELLER_ROLE = 'SELLER_ROLE',
  ROLE_PRESET = 'ROLE_PRESET',
  COMPANY = 'COMPANY',
  ROBOT = 'ROBOT',
  DEFECT = 'DEFECT',
}

registerEnumType(ArchiveKind, {
  name: 'ArchiveKind',
  description: 'The kinds of thing that are archived instead of deleted',
})
