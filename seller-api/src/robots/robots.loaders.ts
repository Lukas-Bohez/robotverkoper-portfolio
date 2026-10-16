import { Injectable, Scope } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import DataLoader from 'dataloader'
import type { MongoRepository } from 'typeorm'
import { RobotModel } from './entities/robot-model.entity.js'

/**
 * Batches the model lookups of one GraphQL request (N+1): a list of 30 robots asks for their models in one
 * query instead of 30. Request scope: a new loader, and so a new cache, per request.
 */
@Injectable({ scope: Scope.REQUEST })
export class RobotModelsLoader {
  private readonly loader: DataLoader<string, RobotModel | null>

  constructor(@InjectRepository(RobotModel) repository: MongoRepository<RobotModel>) {
    this.loader = new DataLoader(async ids => {
      const found = await repository.find({ where: { id: { $in: [...ids] } } as never })
      const byId = new Map(found.map(model => [model.id, model]))
      return ids.map(id => byId.get(id) ?? null)
    })
  }

  load(id: string): Promise<RobotModel | null> {
    return this.loader.load(id)
  }
}
