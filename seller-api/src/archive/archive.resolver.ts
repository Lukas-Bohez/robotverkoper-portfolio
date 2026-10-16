import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { ArchiveKind } from '../enums/archive-kind.enum.js'
import { ArchivedItem, ColdStorageResult } from './archive.models.js'
import { ArchiveService } from './archive.service.js'
import { COLD_AFTER_MONTHS, ColdStorageService } from './cold-storage.service.js'

@Resolver(() => ArchivedItem)
export class ArchiveResolver {
  constructor(
    private readonly archive: ArchiveService,
    private readonly cold: ColdStorageService,
  ) {}

  @RequirePermissions('archive:read')
  @Query(() => [ArchivedItem], {
    name: 'archive',
    description: 'Everything that was archived (soft delete), newest first. Filter by kind and by the year it was archived.',
  })
  list(
    @Args('kind', { type: () => ArchiveKind, nullable: true }) kind?: ArchiveKind,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ): Promise<ArchivedItem[]> {
    return this.archive.list(kind, year)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => ArchivedItem, { description: 'Brings something back from the archive' })
  restoreArchived(
    @CurrentCaller() caller: Caller,
    @Args('kind', { type: () => ArchiveKind }) kind: ArchiveKind,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ArchivedItem> {
    return this.archive.restore(caller.email, kind, id)
  }

  @RequirePermissions('archive:read')
  @Query(() => [Int], { description: 'The years that have data in cold storage, newest first' })
  coldStorageYears(): Promise<number[]> {
    return this.cold.years()
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => ColdStorageResult, {
    description: 'Moves resolved defects and log lines older than a number of months to cold storage',
  })
  async moveToColdStorage(
    @Args('months', { type: () => Int, defaultValue: COLD_AFTER_MONTHS }) months: number,
  ): Promise<ColdStorageResult> {
    return this.cold.moveOldData(new Date(), months)
  }
}
