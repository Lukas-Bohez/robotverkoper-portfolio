import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // One in-memory MongoDB for the whole run; every test file gets its own database in it
    globalSetup: ['./test/setup/mongo-memory.global.ts'],
    setupFiles: ['./test/setup/env.ts'],
    // The first run may have to download the MongoDB binary
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
