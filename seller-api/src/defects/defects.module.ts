import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { Company } from '../companies/entities/company.entity.js'
import { Robot } from '../robots/entities/robot.entity.js'
import { RobotsModule } from '../robots/robots.module.js'
import { CompaniesLoader, RobotsLoader } from './defects.loaders.js'
import { DefectFieldsResolver } from './defect-fields.resolver.js'
import { DefectsResolver } from './defects.resolver.js'
import { DefectsService } from './defects.service.js'
import { Defect } from './entities/defect.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([Defect, Robot, Company]), RobotsModule, AuditModule],
  providers: [DefectsService, DefectsResolver, DefectFieldsResolver, RobotsLoader, CompaniesLoader],
  exports: [DefectsService],
})
export class DefectsModule {}
