import { defineConfig } from 'tsup'

// Bundles the workspace package (@poc-intel/shared ships TypeScript source); npm dependencies stay external.
export default defineConfig({
  entry: ['src/main.ts', 'src/worker.ts', 'src/cli/create-admin.ts', 'src/cli/render-sample.ts', 'src/cli/validate-instances.ts'],
  format: 'esm',
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@poc-intel/shared'],
})
