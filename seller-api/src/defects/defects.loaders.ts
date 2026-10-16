import { Injectable, Scope } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import DataLoader from 'dataloader'
import type { MongoRepository } from 'typeorm'
import { Company } from '../companies/entities/company.entity.js'
import { Robot } from '../robots/entities/robot.entity.js'

/** Looks up several documents of a collection by their id at the platform at once, in the order that was asked */
async function byPlatformIds<T extends { platformId: string | null }>(
  repository: MongoRepository<T>,
  ids: readonly string[],
): Promise<(T | null)[]> {
  const found = await repository.find({
    where: { platformId: { $in: [...ids] } } as never,
    withDeleted: true,
  })
  const byId = new Map(found.map((item) => [item.platformId, item]))
  return ids.map((id) => byId.get(id) ?? null)
}

/**
 * Batches the robot lookups of one GraphQL request (N+1): a list of 30 defects asks for their robots in one
 * query instead of 30. Request scope: a new loader, and so a new cache, per request.
 * A robot that was replaced or put out of service is found too: its defect still shows its name.
 */
@Injectable({ scope: Scope.REQUEST })
export class RobotsLoader {
  private readonly loader: DataLoader<string, Robot | null>

  constructor(@InjectRepository(Robot) repository: MongoRepository<Robot>) {
    this.loader = new DataLoader((ids) => byPlatformIds(repository, ids))
  }

  load(platformId: string): Promise<Robot | null> {
    return this.loader.load(platformId)
  }
}

@Injectable({ scope: Scope.REQUEST })
export class CompaniesLoader {
  private readonly loader: DataLoader<string, Company | null>

  constructor(@InjectRepository(Company) repository: MongoRepository<Company>) {
    this.loader = new DataLoader((ids) => byPlatformIds(repository, ids))
  }

  load(platformId: string): Promise<Company | null> {
    return this.loader.load(platformId)
  }
}
