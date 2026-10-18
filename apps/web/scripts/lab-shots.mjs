// Screenshots of the Stellar Experience visual lab: no server, database or login needed, only
// `npm run dev -w @poc-intel/web`. Run: npm run lab:shots -w @poc-intel/web [-- <base url>]
// Uses the installed Google Chrome (real GPU); images land in apps/web/.lab-shots/ (git-ignored).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5173'
const out = new URL('../.lab-shots/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

/** Each state the 3D work must look right in; add one when a new scene appears. */
const STATES = [
  ['01-stack-briefing', 'stage=data_sources'],
  ['02-briefing-topic', 'stage=ndr&open=techniques'],
  ['03-stack-question', 'stage=detection&phase=question'],
  ['04-chamber-source', 'stage=data_sources&model=chamber&target=source:Any EDR'],
  ['05-chamber-stage', 'stage=ndr&model=chamber&target=stage:ndr'],
  ['06-trace-start', 'stage=detection&phase=question&model=trace&target=source:Network', 4000],
  ['07-trace-end', 'stage=detection&phase=question&model=trace&target=source:Network', 24000],
  ['08-executive', 'profile=executive&stage=correlation'],
  // Zoomed all the way out with the mouse wheel: the Stack must keep its colours.
  ['09-zoom-out', 'stage=detection', 5000, 'zoomout'],
  // The Pipeline beside the wide Briefing, half way down the tunnel.
  ['10-pipeline-briefing', 'stage=detection&model=trace&target=source:Network', 12000],
  // The Closing: the deployment topology, then the lab and its invitation.
  ['11-topology', 'stage=topology'],
  ['12-lab', 'stage=lab'],
]

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const errors = []
for (const [name, query, wait = 5000, action] of STATES) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  await page.addInitScript(() => localStorage.setItem('locale', 'pt-BR'))
  await page.goto(`${base}/lab/experience?${query}`)
  await page.waitForTimeout(wait)
  if (action === 'zoomout') {
    await page.mouse.move(500, 520)
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 400)
    await page.waitForTimeout(2500)
  }
  await page.screenshot({ path: `${out}${name}.png` })
  console.log('saved', name)
  await ctx.close()
}
await browser.close()
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors')
