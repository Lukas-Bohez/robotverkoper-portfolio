import { Module } from '@nestjs/common'
import { DatabaseVersionService } from './database-version.service.js'

/** The version of the database and its migrations. Backs the `db:status`, `db:migrate` and `db:reset` commands. */
@Module({
  providers: [DatabaseVersionService],
  exports: [DatabaseVersionService],
})
export class DatabaseModule {}
