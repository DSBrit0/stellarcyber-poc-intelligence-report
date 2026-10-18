import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docsVersion, parseConnectors, parseParsers } from './parse.js'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')
const PARSERS = 'https://docs.stellarcyber.ai/prod-docs/7.0.xs/Configure/Ports/Firewall-Ports-for-Parsers.htm'
const CONNECTORS = 'https://docs.stellarcyber.ai/prod-docs/7.0.xs/Configure/Connectors/1-Connectors-List.htm'

describe('Data Source Catalog readers', () => {
  it('reads generic and vendor parsers with their ports', () => {
    const p = parseParsers(fixture('parsers'), PARSERS)
    expect(p.find((x) => x.name === 'CEF')).toMatchObject({ port: '5143 / 5870', source: 'cef_device_vendor' })
    const vendor = p.filter((x) => x.category)
    expect(vendor.length).toBeGreaterThan(0)
    for (const x of p) expect(x.port).toMatch(/^\d{3,5}( \/ \d{3,5})*( \(TCP only\))?$/)
  })
  it('reads connectors with their category, functions and own doc page', () => {
    const c = parseConnectors(fixture('connectors'), CONNECTORS)
    expect(c[0]).toMatchObject({ name: 'Jamf Pro', category: 'Asset Management', detail: 'Collect' })
    expect(c.every((x) => x.docUrl.startsWith('https://docs.stellarcyber.ai/prod-docs/7.0.xs/'))).toBe(true)
  })
  it('keeps the configuration link out of the name, whatever its wording', () => {
    const row = (cell: string) => `<table><thead><tr><th>Parser Name</th><th>Port</th></tr></thead><tbody><tr><td>${cell}</td><td>5143</td></tr></tbody></table>`
    const name = (cell: string) => parseParsers(row(cell), PARSERS)[0]!.name
    expect(name('<p>CoreLight Sensor</p><p><a href="../LogParser/Corelight.htm">See how to configure CoreLight log ingestion.</a></p>')).toBe('CoreLight Sensor')
    expect(name('Microsoft Exchange Server <img src="new.png" /><p><a href="x.htm">Learn how to configure log ingestion.</a></p>')).toBe('Microsoft Exchange Server')
    // The link still gives the entry its documentation page.
    expect(parseParsers(row('<p>SentinelOne (CEF2)</p><p><a href="../LogParser/S1.htm">See how…</a></p>'), PARSERS)[0]!.docUrl).toBe('https://docs.stellarcyber.ai/prod-docs/7.0.xs/Configure/LogParser/S1.htm')
    // A name that is itself the link stays the name.
    expect(name('<a href="cef.htm">CEF</a>')).toBe('CEF')
  })
  it('never keeps a link that is not http(s)', () => {
    const html = '<table><thead><tr><th>Parser Name</th><th>Port</th></tr></thead><tbody><tr><td><a href="javascript:alert(1)">Evil</a></td><td>5143</td></tr></tbody></table>'
    expect(parseParsers(html, PARSERS)[0]!.docUrl).toBe(PARSERS)
  })
  it('tells the documentation version from the URL and the page', () => {
    expect(docsVersion(fixture('parsers'), PARSERS)).toEqual({
      segment: '7.0.xs',
      label: '7.0.0s',
      latest: { segment: '7.0.xs', label: '7.0.0s' },
      base: 'https://docs.stellarcyber.ai/prod-docs/7.0.xs',
    })
    expect(docsVersion(fixture('parsers'), PARSERS.replace('7.0.xs', '6.6.x')).label).toBe('6.6.0')
    expect(docsVersion(fixture('parsers'), 'https://docs.stellarcyber.ai/x.htm').segment).toBeNull()
  })
})
