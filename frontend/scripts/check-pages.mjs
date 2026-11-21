/*
 * Page check (website stage W7): opens EVERY page at 360 px (phone) and 1440 px (desktop),
 * saves a full-page screenshot to docs/screenshots/<width>/, and reports:
 *   - sideways scrolling (page wider than the screen)
 *   - anything sticking out past the right edge (maps and scroll boxes excepted)
 *   - console errors / page crashes
 * It also writes docs/screenshots/README.md (an index you can browse on GitHub).
 *
 * How to run (demo mode: no Supabase keys in .env):
 *   1. cd frontend && npm run dev                 (leave it running)
 *   2. npx playwright install chromium            (first time only, ~150 MB download)
 *   3. npm run check-pages                        (in a second terminal)
 * Options: BASE_URL=http://localhost:5173  CHROME_PATH=/path/to/chrome (use an existing browser)
 * Exit code 1 if any page has a problem.
 */
import { chromium } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots')
const WIDTHS = [360, 1440]

// [role, path, name, language]
const PAGES = [
  ['public', '/', 'home'],
  ['public', '/plans', 'plans'],
  ['public', '/garages/join', 'for-garages'],
  ['public', '/about', 'about-contact'],
  ['public', '/login', 'login'],
  ['public', '/login', 'login-tamil', 'ta'],
  ['owner', '/owner/dashboard', 'dashboard'],
  ['owner', '/owner/dashboard', 'dashboard-tamil', 'ta'],
  ['owner', '/owner/map', 'live-map'],
  ['owner', '/owner/trucks', 'trucks'],
  ['owner', '/owner/trucks/truck-1', 'truck-overview'],
  ['owner', '/owner/trucks/truck-1?tab=tyres', 'truck-tyres-6w'],
  ['owner', '/owner/trucks/truck-3?tab=tyres', 'truck-tyres-12w'],
  ['owner', '/owner/trucks/truck-4?tab=tyres', 'truck-tyres-14w'],
  ['owner', '/owner/trucks/truck-5?tab=tyres', 'truck-tyres-18w'],
  ['owner', '/owner/trucks/truck-1?tab=engine', 'truck-engine-locked'],
  ['owner', '/owner/trucks/truck-2?tab=engine', 'truck-engine'],
  ['owner', '/owner/trucks/truck-5?tab=brakes', 'truck-brakes'],
  ['owner', '/owner/trucks/truck-2?tab=power', 'truck-power-device'],
  ['owner', '/owner/trucks/truck-5?tab=driver', 'truck-driver'],
  ['owner', '/owner/trucks/truck-5?tab=cargo', 'truck-cargo'],
  ['owner', '/owner/trucks/truck-4?tab=predictions', 'truck-predictions'],
  ['owner', '/owner/trucks/truck-2?tab=maintenance', 'truck-maintenance'],
  ['owner', '/owner/predictive', 'predictive'],
  ['owner', '/owner/alerts', 'alerts'],
  ['owner', '/owner/alerts/alert-1', 'alert-detail'],
  ['owner', '/owner/shipments', 'shipments'],
  ['owner', '/owner/shipments/new', 'create-shipment'],
  ['owner', '/owner/shipments/SHP-1002', 'shipment-routing'],
  ['owner', '/owner/shipments/SHP-0998', 'shipment-delivered'],
  ['owner', '/owner/drivers', 'drivers'],
  ['owner', '/owner/drivers/drv-4', 'driver-profile'],
  ['owner', '/owner/garages', 'garages'],
  ['owner', '/owner/reports', 'reports'],
  ['owner', '/owner/plan', 'plan-billing'],
  ['owner', '/owner/settings', 'settings'],
  ['driver', '/driver', 'my-trip'],
  ['driver', '/driver', 'my-trip-tamil', 'ta'],
  ['driver', '/driver/truck', 'truck-health'],
  ['driver', '/driver/alert/alert-1', 'alert-fullscreen'],
  ['driver', '/driver/sos', 'sos'],
  ['driver', '/driver/history', 'my-trips'],
  ['shipper', '/shipper', 'my-shipments'],
  ['shipper', '/shipper/request', 'request-shipment'],
  ['shipper', '/shipper/track/SHP-1005', 'tracking-cold-chain'],
  ['shipper', '/shipper/track/SHP-1001', 'tracking'],
  ['shipper', '/shipper/deliveries', 'delivery-invoices'],
  ['shipper', '/shipper/invoices/SHP-0998', 'invoice'],
]

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const results = []

for (const w of WIDTHS) {
  rmSync(join(OUT, String(w)), { recursive: true, force: true })
  mkdirSync(join(OUT, String(w)), { recursive: true })
  for (const role of ['public', 'owner', 'driver', 'shipper']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 780 : 900 } })
    const page = await ctx.newPage()
    let errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))

    await page.goto(BASE) // a real page first, so the language can be saved in localStorage
    if (role !== 'public') {
      // Demo mode: pick the role on the login page.
      await page.goto(`${BASE}/login`)
      await page.locator(`label:has(input[value=${role}])`).click()
      await page.getByRole('button', { name: /Open demo portal/ }).click()
      await page.waitForTimeout(600)
    }

    for (const [r, path, name, lang] of PAGES.filter((p) => p[0] === role)) {
      errors = []
      await page.evaluate((l) => localStorage.setItem('ecostream.lang', l), lang ?? 'en')
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900) // charts, map tiles
      const check = await page.evaluate((W) => ({
        width: document.documentElement.scrollWidth,
        sticking: [...document.querySelectorAll('main *, header *')]
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width > 0 && b.right > W + 0.5 && !e.closest('.leaflet-container, .overflow-x-auto, .overflow-hidden')
          })
          .slice(0, 3)
          .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 30)}"`),
      }), w)
      const file = `${w}/${r}-${name}.jpg`
      await page.screenshot({ path: join(OUT, file), fullPage: true, type: 'jpeg', quality: 70 })
      const problems = [
        ...(check.width > w ? [`page is ${check.width}px wide (sideways scroll)`] : []),
        ...check.sticking.map((s) => `sticks out: ${s}`),
        ...errors.map((e) => `console: ${e}`),
      ]
      results.push({ w, role: r, name, path, file, problems })
      console.log(`${problems.length ? 'FAIL' : ' ok '} ${String(w).padStart(4)} ${r.padEnd(7)} ${name}${problems.length ? '\n      ' + problems.join('\n      ') : ''}`)
    }
    await ctx.close()
  }
}
await browser.close()

// Index for GitHub
const names = [...new Map(results.map((r) => [`${r.role}/${r.name}`, r])).values()]
const cell = (w, r) => {
  const x = results.find((y) => y.w === w && y.role === r.role && y.name === r.name)
  return `[${x.problems.length ? 'problem' : 'ok'}](${x.file})`
}
writeFileSync(
  join(OUT, 'README.md'),
  `# Screenshots of every page\n\nMade by \`npm run check-pages\` (frontend/scripts/check-pages.mjs) on ${new Date().toISOString().slice(0, 10)}, in demo mode (sample data).\n` +
    `"ok" = no sideways scroll, nothing sticking out, no console errors.\n\n| Portal | Page | Address | 360 px (phone) | 1440 px (desktop) |\n|---|---|---|---|---|\n` +
    names.map((r) => `| ${r.role} | ${r.name} | \`${r.path}\` | ${cell(360, r)} | ${cell(1440, r)} |`).join('\n') +
    '\n',
)

const bad = results.filter((r) => r.problems.length)
console.log(`\n${results.length} page checks, ${bad.length} with problems. Screenshots: docs/screenshots/`)
process.exitCode = bad.length ? 1 : 0
