import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module.js'
import { RobotsModule } from '../robots/robots.module.js'
import { PairingsResolver } from './pairings.resolver.js'
import { PairingsService } from './pairings.service.js'

@Module({
  imports: [RobotsModule, AuditModule],
  providers: [PairingsService, PairingsResolver],
})
export class PairingsModule {}
