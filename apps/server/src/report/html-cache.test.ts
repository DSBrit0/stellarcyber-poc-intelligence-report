import { describe, expect, it } from 'vitest'
import { cachedReportHtml, NONCE_SLOT, storeReportHtml, withNonce } from './html-cache.js'

describe('Report page cache', () => {
  it('returns what was stored, under its own key only', () => {
    storeReportHtml('a', '<p>A</p>')
    expect(cachedReportHtml('a')?.join('')).toBe('<p>A</p>')
    expect(cachedReportHtml('b')).toBeNull()
  })

  it('gives each response its own nonce', () => {
    storeReportHtml('p', `<script nonce="${NONCE_SLOT}">x()</script>`)
    expect(withNonce(cachedReportHtml('p')!, 'n1')).toBe('<script nonce="n1">x()</script>')
    expect(withNonce(cachedReportHtml('p')!, 'n2')).toBe('<script nonce="n2">x()</script>')
  })

  it('keeps at most 30 pages, dropping the least recently used', () => {
    for (let i = 0; i < 31; i++) storeReportHtml(`k${i}`, `page ${i}`)
    expect(cachedReportHtml('k0')).toBeNull()
    expect(cachedReportHtml('k30')?.join('')).toBe('page 30')
  })
})
