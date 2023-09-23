import * as fs from 'node:fs'
import * as path from 'node:path'
import * as esbuild from 'esbuild'

await Promise.all([
  esbuild.build({
    entryPoints: ['extension/extension.ts'],
    outfile: 'out/extension.js',
    bundle: true,
    external: ['vscode'],
    sourcemap: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'info'
  }),
  (async () => {
    // `extension/test/suite/*.ts` の代わり。`extension/test/suite/**/*.test.ts` にはならない。
    const suite = fs
      .readdirSync(path.join('extension', 'test', 'suite'))
      .map((f) => path.join('extension', 'test', 'suite', f))
      .filter((f) => f.endsWith('.ts') && fs.statSync(f).isFile())
    await esbuild.build({
      entryPoints: ['extension/test/runTest.ts', ...suite],
      sourceRoot: 'extension',
      //outbase: 'out/test',
      outdir: 'out/test',
      bundle: false,
      sourcemap: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'info'
    })
  })()
])
