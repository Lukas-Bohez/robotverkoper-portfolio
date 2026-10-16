import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { Robot } from '../robots/entities/robot.entity.js'
import { CompaniesResolver } from './companies.resolver.js'
import { CompaniesService } from './companies.service.js'
import { Company } from './entities/company.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([Company, Robot, Defect]), AuditModule],
  providers: [CompaniesService, CompaniesResolver],
  exports: [CompaniesService],
})
export class CompaniesModule {}
