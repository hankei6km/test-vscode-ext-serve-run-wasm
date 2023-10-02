import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/extension/extension.ts'],
  outfile: 'out/extension.js',
  bundle: true,
  external: ['vscode'],
  sourcemap: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'info'
})
