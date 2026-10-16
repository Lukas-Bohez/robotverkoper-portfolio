import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { Company } from '../companies/entities/company.entity.js'
import { Robot } from '../robots/entities/robot.entity.js'
import { CompaniesLoader, RobotsLoader } from './defects.loaders.js'
import { Defect } from './entities/defect.entity.js'

/**
 * The robot and the company of a defect. They go through DataLoaders, so a list of defects costs two queries
 * for its robots and its companies, not one per defect. Request scoped because the loaders are.
 */
@Resolver(() => Defect)
export class DefectFieldsResolver {
  constructor(
    private readonly robots: RobotsLoader,
    private readonly companies: CompaniesLoader,
  ) {}

  @ResolveField(() => Robot)
  robot(@Parent() defect: Defect): Promise<Robot | null> {
    return this.robots.load(defect.robotId)
  }

  @ResolveField(() => Company)
  company(@Parent() defect: Defect): Promise<Company | null> {
    return this.companies.load(defect.companyId)
  }
}
