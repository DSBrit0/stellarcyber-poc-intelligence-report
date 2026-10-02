import { describe, expect, it } from 'vitest'
import { TacticsAccumulator } from './tactics.js'

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
})
