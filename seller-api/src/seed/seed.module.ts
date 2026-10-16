import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { DefectsModule } from '../defects/defects.module.js'
import { RobotsModule } from '../robots/robots.module.js'
import { CommandModule } from './nestjs-command.js'
import { SeedCommand } from './seed.command.js'
import { SeedService } from './seed.service.js'

/** Fills the database (and empties it) from the command line, and when the API starts */
@Module({
  imports: [CommandModule, RobotsModule, DefectsModule, DatabaseModule],
  providers: [SeedService, SeedCommand],
  exports: [SeedService],
})
export class SeedModule {}
