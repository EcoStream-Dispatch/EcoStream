// Writes frontend/public/models/manifest.json from the *.meta.json files next to the GLBs.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'frontend/public/models'
const models = readdirSync(dir)
  .filter((f) => f.endsWith('.meta.json'))
  .sort()
  .map((f) => {
    const meta = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    const size = (n) => statSync(join(dir, n)).size
    return {
      id: meta.id,
      title: meta.title,
      description: meta.description,
      files: {
        high: { url: `models/${meta.id}.glb`, bytes: size(`${meta.id}.glb`) },
        low: { url: `models/${meta.id}-low.glb`, bytes: size(`${meta.id}-low.glb`) },
        meta: `models/${meta.id}.meta.json`,
      },
    }
  })
const total = models.reduce((n, m) => n + m.files.high.bytes + m.files.low.bytes, 0)
writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: 1, compression: 'EXT_meshopt_compression', totalBytes: total, models }, null, 2) + '\n')
console.log(`manifest: ${models.length} models, ${(total / 1e6).toFixed(2)} MB`)
