import { createRequire } from 'node:module'
import type { Type } from '@nestjs/common'

// `nestjs-command` only declares a `require` export condition (no `import` or `types`), so it cannot be loaded with
// a normal ESM import under nodenext. createRequire gives this ESM file a CJS-style require, which is what the
// package supports (the workaround of the seeding lesson of the course).
const require = createRequire(import.meta.url)

interface CommandOptions {
  command: string
  describe?: string
  autoExit?: boolean
}

interface NestjsCommand {
  CommandModule: Type<unknown>
  CommandService: Type<{ exec(): Promise<void> | void }>
  Command: (options: CommandOptions) => MethodDecorator
}

const loaded = require('nestjs-command') as NestjsCommand

export const CommandModule = loaded.CommandModule
export const CommandService = loaded.CommandService
export const Command = loaded.Command
