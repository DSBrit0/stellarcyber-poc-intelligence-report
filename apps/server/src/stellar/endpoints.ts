// Every Stellar Cyber Open API path lives here (Swagger 7.0 SaaS).
// Known API quirks (verified against live tenants in the previous tool):
// - /cases without FROM~/TO~created_at returns only the last ~24 h.
// - /cases with skip above ~1,000 answers HTTP 500 on some tenants: split the time window instead.
// - /cases/{id}/alerts caps limit at 50; without limit it returns everything (tens of MB).
// - /entity_usages/daily_count accepts only days=1..31, ending the previous UTC day.
// - /storage-usages returns the last 31 complete UTC days.
export const API_PREFIX = '/connect/api/v1'

export const ENDPOINTS = {
  accessToken: `${API_PREFIX}/access_token`,
  tenants: `${API_PREFIX}/tenants`,
  cases: `${API_PREFIX}/cases`,
  caseAlerts: (caseId: string) => `${API_PREFIX}/cases/${encodeURIComponent(caseId)}/alerts`,
  entityUsageDaily: `${API_PREFIX}/entity_usages/daily_count/all`,
  connectors: `${API_PREFIX}/connectors`,
  ingestionBySensor: `${API_PREFIX}/ingestion-stats/sensor`,
  ingestionByConnector: `${API_PREFIX}/ingestion-stats/connector`,
  dataSensors: `${API_PREFIX}/data_sensors`,
  storageUsages: `${API_PREFIX}/storage-usages`,
  /** AI Triage (7.x Instances only): verdicts for up to 500 Cases per call. */
  aiCaseVerdicts: `${API_PREFIX}/autotriage/v1/case/feedback/verdicts/batch`,
} as const

export const PAGING = {
  casesPage: 500,
  casesSafeSkip: 1_000,
  caseAlertsPage: 50,
  caseAlertsMaxPerCase: 500,
  /**
   * Parallel requests per Sync against one Instance (one pooled connection set, HTTP/2 when offered).
   * Measured by the previous tool for 639 alert pages: 6 → 172 s, 12 → 104 s, 24 → 68 s, with no errors.
   */
  concurrency: 16,
} as const
