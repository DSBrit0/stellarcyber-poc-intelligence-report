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

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * Chromium's page footer: "{client} · Confidential · p. X/Y". The text comes from the Report HTML's
 * `report-footer` meta (written by renderReportHtml in the Report's language); none, no footer.
 */
export function pdfFooter(html: string): { displayHeaderFooter: boolean; headerTemplate?: string; footerTemplate?: string } {
  const m = /<meta name="report-footer" content="([^"]*)"/.exec(html)
  if (!m) return { displayHeaderFooter: false }
  const label = m[1]!
  return {
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;margin:0 13mm 2mm;font:7.5pt Helvetica,Arial,sans-serif;color:#5f6b7a;text-align:right">${escapeHtml(label)} <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
  }
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
    await page.pdf({ path: tmp, format: 'A4', printBackground: true, preferCSSPageSize: true, ...pdfFooter(html) })
    await rename(tmp, outputPath)
  } finally {
    await context.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) await (await browser).close()
  browser = null
}
