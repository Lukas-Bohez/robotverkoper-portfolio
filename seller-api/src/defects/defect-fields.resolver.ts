import { Args, Int, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { Company } from '../companies/entities/company.entity.js'
import { GeoPoint } from '../entities/geopoint.entity.js'
import { Robot } from '../robots/entities/robot.entity.js'
import { CompaniesLoader, RobotsLoader } from './defects.loaders.js'
import { DefectsService } from './defects.service.js'
import { Defect } from './entities/defect.entity.js'
import { DefectStatusType } from './enums/defect.enums.js'

/**
 * The fields of a defect that are not stored on it: its robot and company (DataLoaders, so a list of defects
 * costs two queries for its robots and its companies, not one per defect), its status (worked out) and its distance
 * to a place. Request scoped because the loaders are.
 */
@Resolver(() => Defect)
export class DefectFieldsResolver {
  constructor(
    private readonly defects: DefectsService,
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

  /** Not stored: it follows from what happened to the defect (see `defectStatus`) */
  @ResolveField(() => DefectStatusType)
  status(@Parent() defect: Defect): DefectStatusType {
    return this.defects.getStatus(defect)
  }

  @ResolveField(() => Int, {
    nullable: true,
    description: 'The distance in meters from a place (for example the technician) to the robot',
  })
  distanceMeters(
    @Parent() defect: Defect,
    @Args('from', { type: () => GeoPoint }) from: GeoPoint,
  ): number | null {
    return this.defects.distanceFrom(defect, from)
  }
}
