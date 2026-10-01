import { mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium, type Browser } from 'playwright'

// One Chromium per worker process, one isolated context per render. JavaScript and every
// network request are disabled: the Report HTML is self-contained by design.
let browser: Promise<Browser> | null = null

function getBrowser(): Promise<Browser> {
  browser ??= chromium.launch({ args: ['--disable-dev-shm-usage'] })
  return browser
}

export async function renderPdf(html: string, outputPath: string): Promise<void> {
  const context = await (await getBrowser()).newContext({ javaScriptEnabled: false, offline: true })
  try {
    await context.route('**/*', (route) => route.abort())
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    await mkdir(dirname(outputPath), { recursive: true })
    const tmp = `${outputPath}.${process.pid}.tmp`
    await page.pdf({ path: tmp, format: 'A4', printBackground: true, preferCSSPageSize: true })
    await rename(tmp, outputPath)
  } finally {
    await context.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) await (await browser).close()
  browser = null
}
