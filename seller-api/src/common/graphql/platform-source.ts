import { registerEnumType } from '@nestjs/graphql'

/** Where an answer comes from: the platform of the companies itself, or what we knew from the last time */
export enum PlatformSource {
  PLATFORM = 'platform',
  CACHE = 'cache',
}
registerEnumType(PlatformSource, {
  name: 'PlatformSource',
  description:
    'PLATFORM: answered by the platform just now. CACHE: the platform did not answer, this is the last known state.',
})
