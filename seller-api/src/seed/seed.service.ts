import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { DefectsService } from '../defects/defects.service.js'
import { DefectSeverity } from '../defects/entities/defect.entity.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import { RobotsService } from '../robots/robots.service.js'
import { DEMO_DEFECT, DEMO_ROBOTS, ROBOT_MODELS } from './robot-models.seed.js'

const ACTOR = 'demo-seed'

/** Collections we own. The companies are a copy of the platform: they are filled again by themselves. */
const COLLECTIONS = ['robots', 'defects', 'accounts', 'audit', 'companies']

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name)

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly robots: RobotsService,
    private readonly defects: DefectsService,
    private readonly platform: PlatformGateway,
  ) {}

  /** The catalogue of robot models: always, it is what we sell */
  async seedModels(): Promise<void> {
    await this.robots.upsertModels(ROBOT_MODELS)
  }

  /**
   * Fills an empty database for the demo: robots for the made-up companies of the platform simulator and one
   * defect. It goes through the services, so the keys and records are made the normal way.
   */
  async seedDemo(): Promise<void> {
    if ((await this.robots.countAll()) > 0) {
      this.logger.log('Demo seed skipped: there are robots already')
      return
    }
    const companies = await this.platform.listCompanies()
    let defectRobotId: string | null = null
    for (const demo of DEMO_ROBOTS) {
      const company = companies.find(item => item.subdomain === demo.company)
      if (!company) {
        this.logger.warn(`The platform has no company "${demo.company}", robot "${demo.name}" skipped`)
        continue
      }
      const { robot } = await this.robots.create(ACTOR, company.id, { name: demo.name, modelId: demo.model })
      if (demo.name === DEMO_DEFECT.robot) defectRobotId = robot.id
      await this.platform.simulateTelemetry?.(robot.id, { online: demo.online, battery: demo.battery })
    }
    if (defectRobotId) {
      await this.defects.report(ACTOR, defectRobotId, {
        summary: DEMO_DEFECT.summary,
        severity: DefectSeverity.HIGH,
      })
    }
    this.logger.log('Demo seed: robots and one defect created')
  }

  /** What `seed` does, and what the API does when it starts */
  async seedAll(): Promise<void> {
    await this.seedModels()
    if (this.config.seedDemo) await this.seedDemo()
  }

  /** Empties what we own (never the platform). Development only. */
  async clearAll(): Promise<void> {
    if (this.config.production) throw new Error('clear never runs in production')
    for (const name of COLLECTIONS) {
      await this.dataSource.mongoManager.getMongoRepository(name).deleteMany({})
    }
    this.logger.log(`Emptied: ${COLLECTIONS.join(', ')}`)
  }
}
