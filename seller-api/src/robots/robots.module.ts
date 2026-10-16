import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { CompaniesModule } from '../companies/companies.module.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { Robot } from './entities/robot.entity.js'
import { RobotFieldsResolver } from './robot-fields.resolver.js'
import { RobotConditionsLoader, RobotModelsLoader } from './robots.loaders.js'
import { RobotsResolver } from './robots.resolver.js'
import { RobotsService } from './robots.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Robot, RobotModel, Defect]), CompaniesModule, AuditModule],
  providers: [
    RobotsService,
    RobotsResolver,
    RobotFieldsResolver,
    RobotModelsLoader,
    RobotConditionsLoader,
  ],
  exports: [RobotsService],
})
export class RobotsModule {}
