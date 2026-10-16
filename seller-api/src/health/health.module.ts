import { Module } from '@nestjs/common'
import { HealthController, HealthResolver } from './health.resolver.js'

@Module({
  controllers: [HealthController],
  providers: [HealthResolver],
})
export class HealthModule {}
