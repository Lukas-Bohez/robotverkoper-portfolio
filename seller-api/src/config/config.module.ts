import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, loadAppConfig } from './app-config.js'

/** The settings of the API, read once from the environment */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
