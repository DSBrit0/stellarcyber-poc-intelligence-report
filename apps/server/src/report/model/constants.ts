// Fixed reference data of the Technical and Executive Reports (spec §0.7, §3.0).

/** The 14 MITRE ATT&CK Enterprise tactics, in the order the Reports draw them. */
export const ALL_TACTICS = [
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0040', name: 'Impact' },
  { id: 'TA0042', name: 'Resource Development' },
  { id: 'TA0043', name: 'Reconnaissance' },
] as const

/** Response targets of the Detection Story's Q4 scorecard. */
export const SOC_TARGETS = { critOpen: 0, highOpen: 0, highOpenYellow: 2, handledPct: 90, ackMin: 30, closeHours: 24 } as const

/** Risk score at or above which a Case is "high score" in the priority matrix. */
export const SCORE_CUT = 70

/** Scorecard rating thresholds (percent). */
export const RATING = { high: 70, medium: 35 } as const

/** Below this many Cases the effort estimate is flagged as a small sample. */
export const SMALL_SAMPLE = 30

/** Connector name/type/category fragments that identify an EDR integration (scorecard "Response Automation"). */
export const EDR_HINTS = ['edr', 'endpoint', 'crowdstrike', 'sentinelone', 'carbon black', 'defender', 'cybereason', 'cylance', 'sophos', 'cortex'] as const
