import { Controller, Get } from '@nestjs/common'
import { Query, Resolver } from '@nestjs/graphql'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { Public } from '../authentication/decorators.js'
import { Health } from './health.model.js'

@Resolver(() => Health)
export class HealthResolver {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Query(() => Health)
  health(): Health {
    return {
      status: 'ok',
      database: this.dataSource.isInitialized ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    }
  }
}

/** The same answer over plain HTTP, for the health checks of Docker and of the demo launcher */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'seller-api',
      database: this.dataSource.isInitialized ? 'up' : 'down',
    }
  }
}
