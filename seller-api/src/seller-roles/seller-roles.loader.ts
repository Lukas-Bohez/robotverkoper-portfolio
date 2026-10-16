import { Injectable, Scope } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import DataLoader from 'dataloader'
import type { MongoRepository } from 'typeorm'
import { SellerRole } from './entities/seller-role.entity.js'

/**
 * Batches the role lookups of one GraphQL request (N+1): a list of 30 accounts asks for their roles in one query
 * instead of 30. Request scope: a new loader, and so a new cache, per request. An archived role is found too:
 * the account that still names it shows it.
 */
@Injectable({ scope: Scope.REQUEST })
export class SellerRolesLoader {
  private readonly loader: DataLoader<string, SellerRole | null>

  constructor(
    @InjectRepository(SellerRole) repository: MongoRepository<SellerRole>,
  ) {
    this.loader = new DataLoader(async keys => {
      const found = await repository.find({
        where: { key: { $in: [...keys] } } as never,
        withDeleted: true,
      })
      const byKey = new Map(found.map(role => [role.key, role]))
      return keys.map(key => byKey.get(key) ?? null)
    })
  }

  load(key: string): Promise<SellerRole | null> {
    return this.loader.load(key)
  }
}
