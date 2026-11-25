/*
 * Frontend unit tests: tests/*.test.ts, run with Node's built-in test runner.
 *
 *   npm test
 *
 * esbuild (already installed with Vite) turns each TypeScript test into one plain
 * JavaScript file in a temp folder, then `node --test` runs them. No extra test library.
 */
import { build } from 'esbuild'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const tests = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => join('tests', f))
const out = mkdtempSync(join(tmpdir(), 'ecostream-tests-'))
try {
  await build({ entryPoints: tests, bundle: true, platform: 'node', format: 'esm', outdir: out, outExtension: { '.js': '.mjs' }, logLevel: 'error' })
  const files = readdirSync(out).map((f) => join(out, f))
  const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
  process.exitCode = r.status ?? 1
} finally {
  rmSync(out, { recursive: true, force: true })
}
