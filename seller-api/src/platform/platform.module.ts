import { Global, Module } from '@nestjs/common'
import { HttpPlatformGateway } from './http-platform.gateway.js'
import { PlatformGateway } from './platform.gateway.js'

/** The one small door to the platform of the companies. A real platform replaces the HTTP provider. */
@Global()
@Module({
  providers: [{ provide: PlatformGateway, useClass: HttpPlatformGateway }],
  exports: [PlatformGateway],
})
export class PlatformModule {}
