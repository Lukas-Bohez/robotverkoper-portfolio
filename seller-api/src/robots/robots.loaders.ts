import { Injectable, Scope } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import DataLoader from 'dataloader'
import type { MongoRepository } from 'typeorm'
import { RobotCondition } from '../entities/robot-condition.entity.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { Robot } from './entities/robot.entity.js'
import { RobotsService } from './robots.service.js'

/**
 * Batches the model lookups of one GraphQL request (N+1): a list of 30 robots asks for their models in one
 * query instead of 30. Request scope: a new loader, and so a new cache, per request.
 */
@Injectable({ scope: Scope.REQUEST })
export class RobotModelsLoader {
  private readonly loader: DataLoader<string, RobotModel | null>

  constructor(@InjectRepository(RobotModel) repository: MongoRepository<RobotModel>) {
    this.loader = new DataLoader(async (keys) => {
      const found = await repository.find({
        where: { key: { $in: [...keys] } } as never,
      })
      const byKey = new Map(found.map((model) => [model.key, model]))
      return keys.map((key) => byKey.get(key) ?? null)
    })
  }

  load(key: string): Promise<RobotModel | null> {
    return this.loader.load(key)
  }
}

/**
 * The condition of the robots of one request in a single call to the platform: a list of 30 robots that all ask
 * for their condition costs one question to the platform, not 30.
 */
@Injectable({ scope: Scope.REQUEST })
export class RobotConditionsLoader {
  private readonly loader: DataLoader<Robot, RobotCondition | null, string>

  constructor(robots: RobotsService) {
    this.loader = new DataLoader(
      async (batch) => {
        const conditions = await robots.conditionsOf([...batch])
        return batch.map((robot) => conditions.get(robot.id) ?? null)
      },
      { cacheKeyFn: (robot) => robot.id },
    )
  }

  load(robot: Robot): Promise<RobotCondition | null> {
    return this.loader.load(robot)
  }
}
