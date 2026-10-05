import { describe, expect, it } from 'vitest'
import { TacticsAccumulator, isPublicIp, rankEntitiesByCase } from './tactics.js'
import type { CaseSummary } from '@poc-intel/shared'

const alert = (tacticId: string, techniqueId: string, description: string, score: number) => ({
  event_score: score,
  xdr_event: { description, tactic: { id: tacticId, name: `name-${tacticId}` }, technique: { id: techniqueId, name: `name-${techniqueId}` } },
})

describe('TacticsAccumulator', () => {
  const acc = new TacticsAccumulator()
  acc.add('c1', [alert('TA0001', 'T1078', 'Valid account', 70), alert('TA0001', 'T1078', 'Valid account', 90), alert('XTA0004', 'XT2001', 'Beaconing', 50)])
  acc.add('c2', [alert('TA0001', 'T1110', 'Brute force', 60), alert('TA0006', 'T1110', 'Brute force', 80)])
  const r = acc.result()

  it('splits MITRE and XDR Kill Chain tactics, sorted by Cases then Alerts', () => {
    expect(r.mitre.tactics.map((t) => [t.id, t.caseCount, t.alertCount])).toEqual([
      ['TA0001', 2, 3],
      ['TA0006', 1, 1],
    ])
    expect(r.xdr.tactics.map((t) => t.id)).toEqual(['XTA0004'])
    expect(r.mitre.techniques.find((t) => t.id === 'T1110')).toMatchObject({ caseCount: 1, alertCount: 2 })
  })

  it('keeps per-Case counts', () => {
    expect(r.byCase.c1!.tactics).toEqual([{ id: 'TA0001', name: 'name-TA0001', alerts: 2 }])
    expect(r.byCase.c1!.xdr).toEqual([{ id: 'XTA0004', name: 'name-XTA0004', alerts: 1 }])
  })

  it('keeps distinct top descriptions with their best score', () => {
    expect(r.topAlerts.c1).toEqual([
      { score: 90, description: 'Valid account' },
      { score: 50, description: 'Beaconing' },
    ])
    expect(r.topAlerts.c2).toEqual([{ score: 80, description: 'Brute force' }])
  })

  it('counts Cases whose Alerts the credential may not read', () => {
    const a = new TacticsAccumulator()
    a.forbid('x')
    a.forbid('y')
    a.add('y', [])
    expect(a.result().pages.forbidden).toBe(2)
    expect(a.result().casesWithoutAlertAccess).toBe(1)
  })

  it('counts every tactic/technique pair of an alert once (xdr_event.ttps)', () => {
    const a = new TacticsAccumulator()
    a.add('c', [
      {
        xdr_event: {
          tactic: { id: 'TA0001', name: 'Initial Access' },
          ttps: [
            { tactic: { id: 'TA0001', name: 'Initial Access' }, technique: { id: 'T1078', name: 'Valid Accounts' } },
            { tactic: { id: 'TA0006', name: 'Credential Access' }, technique: { id: 'T1110', name: 'Brute Force' } },
            { tactic: { id: 'TA0006', name: 'Credential Access' }, technique: { id: 'T1110', name: 'Brute Force' } },
          ],
        },
      },
    ])
    const r = a.result()
    expect(r.mitre.tactics.map((t) => [t.id, t.alertCount])).toEqual([['TA0001', 1], ['TA0006', 1]])
    expect(r.mitre.techniques.map((t) => t.id).sort()).toEqual(['T1078', 'T1110'])
  })
})

describe('TacticsAccumulator technique → tactic', () => {
  it('maps a technique to its most frequent tactic, whatever the page order', () => {
    const pages = [
      [alert('TA0005', 'T1078', 'x', 1)],
      [alert('TA0001', 'T1078', 'x', 1), alert('TA0001', 'T1078', 'x', 1)],
    ]
    for (const order of [pages, [...pages].reverse()]) {
      const a = new TacticsAccumulator()
      order.forEach((p, i) => a.add(`c${i}`, p))
      expect(a.result().mitre.techniques[0]).toMatchObject({ id: 'T1078', tacticId: 'TA0001' })
    }
  })
  it('breaks a tie with the lowest tactic id', () => {
    const a = new TacticsAccumulator()
    a.add('c', [alert('TA0005', 'T1078', 'x', 1), alert('TA0003', 'T1078', 'x', 1)])
    expect(a.result().mitre.techniques[0]).toMatchObject({ tacticId: 'TA0003', tacticName: 'name-TA0003' })
  })
})

describe('TacticsAccumulator context', () => {
  const sev = new Map<string, CaseSummary['severity']>([['crit', 'critical'], ['med', 'medium']])
  const a = new TacticsAccumulator(sev)
  const win = {
    msg_origin: { source: 'windows_agent', vendor: 'elastic', product: 'auditbeat' },
    engid: '24f3710e', engid_name: 'WIN-1',
    srcip: '10.31.2.11', srcip_username: 'administrator', user: { name: 'Administrator' }, srcip_host: 'WIN-1', hostip_host: 'WIN-1',
    dstip: '192.29.61.248', dstip_geo: { countryCode: 'CH' }, dstip_reputation: 'Good', dstip_asn_org: 'Oracle Corporation',
    stellar: { detection_time: 100 },
    xdr_event: { xdr_killchain_stage: 'Persistent Foothold' },
  }
  const entra = {
    msg_origin: { source: 'azure_ad', vendor: 'azure_ad', processor: { id: '67a5' } },
    engid: 'azure_ad_EMBER - Entra', engid_name: 'azure_ad_EMBER - Entra',
    azure_ad: { userPrincipalName: 'sales@emberit.com' },
    stellar: { detection_time: 300 },
    xdr_event: { xdr_killchain_stage: 'Initial Attempts' },
  }
  a.read(4)
  a.add('crit', [win, win, entra])
  a.add('med', [{ ...entra, stellar: { detection_time: 200 } }])
  const r = a.result()

  it('counts Alerts and Cases per Kill Chain stage, in Kill Chain order', () => {
    expect(r.killChain).toEqual([
      { stage: 'Initial Attempts', alerts: 2, cases: 2 },
      { stage: 'Persistent Foothold', alerts: 2, cases: 1 },
    ])
  })
  it('counts detections per source and per engine, with their Critical/High Cases', () => {
    expect(r.sources).toEqual([
      { source: 'windows_agent', vendor: 'elastic', product: 'auditbeat', alerts: 2, cases: 1, criticalHighCases: 1 },
      { source: 'azure_ad', vendor: 'azure_ad', product: '', alerts: 2, cases: 2, criticalHighCases: 1 },
    ])
    expect(r.engines?.find((e) => e.id === 'azure_ad_EMBER - Entra')).toMatchObject({ processorId: '67a5', alerts: 2, cases: 2, criticalHighCases: 1 })
  })
  it('collects entities of Critical/High Cases only, one count per Alert', () => {
    expect(r.entities?.users).toEqual([
      { value: 'administrator', alerts: 2, cases: 1 },
      { value: 'sales@emberit.com', alerts: 1, cases: 1 },
    ])
    expect(r.entities?.hosts).toEqual([{ value: 'WIN-1', alerts: 2, cases: 1 }])
    // 10.31.2.11 is private: only the public destination is listed.
    expect(r.entities?.externalIps).toEqual([{ value: '192.29.61.248', alerts: 2, cases: 1, country: 'CH', reputation: 'Good', asnOrg: 'Oracle Corporation' }])
    expect(Object.keys(r.entitiesByCase ?? {})).toEqual(['crit'])
    expect(r.entitiesByCase?.crit).toEqual({ users: ['administrator', 'sales@emberit.com'], hosts: ['WIN-1'], externalIps: ['192.29.61.248'] })
  })
  it('takes the median detection latency and keeps the read count', () => {
    expect(r.detectionLatency).toEqual({ medianMs: 150, alerts: 4 })
    expect(r.alertsRead).toBe(4)
  })
})

describe('isPublicIp', () => {
  it('rejects private, loopback, link-local and CGNAT ranges', () => {
    for (const ip of ['10.0.0.1', '172.16.5.4', '192.168.1.100', '127.0.0.1', '169.254.1.1', '100.64.0.1', 'fe80::1', 'fd00::1', 'not-an-ip']) expect(isPublicIp(ip)).toBe(false)
    for (const ip of ['8.8.8.8', '172.32.0.1', '2001:4860::8888']) expect(isPublicIp(ip)).toBe(true)
  })
})

describe('rankEntitiesByCase', () => {
  it('keeps Auto Triage True Positives first, then by Severity and score, up to the cap', () => {
    const kase = (id: string, severity: CaseSummary['severity'], score: number) =>
      ({ id, severity, score, alerts: 1 }) as CaseSummary
    const e = { users: [], hosts: [], externalIps: [] }
    const kept = rankEntitiesByCase({ a: e, b: e, c: e }, [kase('a', 'critical', 90), kase('b', 'high', 50), kase('c', 'critical', 10)], { b: 'True Positive' }, 2)
    expect(Object.keys(kept)).toEqual(['b', 'a'])
  })
})
