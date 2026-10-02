# PoC Report Templates — Porting Specification

Source of truth: the old app at `stellarcyber-poc-report/stellar-dashboard/src` (paths below are relative to it).
Every rule cites `file:line`. `pdfReport.js` = `services/pdfReport.js`.

One function, `generatePDFReport({ ..., template })` (`pdfReport.js:1949-1968`), builds both templates:

| Template | Name | Selector | File name |
|---|---|---|---|
| `1` (default) | **Technical** ("Relatório Técnico") | `template !== 2` | `StellarCyber_PoC_{client}_{YYYY-MM-DD}.pdf` |
| `2` | **Executive** ("Relatório Executivo") | `template === 2` | `StellarCyber_PoC_Executive_{client}_{YYYY-MM-DD}.pdf` |

`{client}` = `pocMeta.clientName` with each run of whitespace replaced by `_`, or `report` when empty. The date is today in UTC (`toISOString().split('T')[0]`) (`pdfReport.js:3443-3450`).

---

## 0. Conventions used throughout

### 0.1 Strings / i18n

- PDF strings are the `pdf` subtree of `i18n/locales/{pt,en,es}.js`, passed in as `s` (`i18n/index.jsx:52-54` `getPdfStrings(locale)`). The default locale is `pt`.
- The code writes every string as `s.key || 'fallback'`. **Users do not see the fallback** when the locale defines the key. This spec gives the **effective en value** (the value in `en.js`). It mentions the code fallback only where the difference matters.
- `en.js` has duplicate keys inside `pdf`; in a JS object literal the last one wins. Effective values:
  - `kpiAvgEntities` = "Avg. Monitored Assets/Day" (overrides the earlier "Generated Alerts")
  - `mitreId` = "Technique ID"
  - `envEntities` and `rmEntities` = "Avg. Monitored Assets/Day"
  - `glossTerm` = "Term"
- Some keys are used by the code but **absent from every locale**, so the default array in the code is always used: `methodologyPhases`, `irFlowRows`, `qualBenefits`, `nextStepsRows`, `glossaryRows`, `versionRows`.
- Section-title keys `sec1`…`sec10` have **no number prefix** in the locales (en: "Executive Summary"). The code fallbacks do have one (`'1. Executive Summary'`).
  - Effect: in the old PDF the Technical title bars show no number.
  - Effect: the Executive number chip is not drawn either. `t2SectionTitle` only draws a chip when the text matches `/^(\d+)\.\s*(.*)$/` (`pdfReport.js:740`).
  - Subtitles (`sub*` keys) do carry numbers.
  - **Porting decision needed:** reproduce as-is, or add number prefixes. Recommended: add them, using the template-specific numbering in §2.0.
- Placeholder substitution:
  - Technical code mostly uses `String.replace('{x}', v)`, which **replaces only the first occurrence**.
  - Template 2 story code uses `fill(s, vars)`, which replaces every occurrence (`pdfReport.js:1355`).
- Helvetica in jsPDF has no `≥` or `→` glyphs, so PDF strings avoid them (`CLAUDE.md:108`). The `>` and `<` in en `sc*target` are fine.
- Verdict labels come from the `report` subtree, not `pdf` (`utils/verdict.js:11-15,35-37`, `en.js:184-186`):
  - `report.verdictApproved` = "Approved"
  - `report.verdictCond` = "Approved with Conditions"
  - `report.verdictRejected` = "Not Approved"
- Operational recommendation texts come from `recOps.*` (see §5).

### 0.2 Number / date formatting (`pdfReport.js:36-72`, `1343-1355`, `2027-2029`, `2085`)

| Helper | Rule |
|---|---|
| locale | `pt→pt-BR`, `en→en-US`, `es→es-MX` (`LOC_STR`, `:37`); falls back to pt-BR |
| `fmtDate(d)` | `'—'` if falsy; an invalid date → `String(d)`; otherwise `toLocaleDateString(loc, {day:'2-digit', month:'2-digit', year:'2-digit'})`. A `YYYY-MM-DD` string is formatted with `timeZone:'UTC'` (`:39-49`). en output: `MM/DD/YY` |
| `fmtDay(d)` (license blocks) | `new Date(d+'T00:00:00Z')`, formatted day/month/2-digit year in UTC (`:2029`) |
| `fmtNum(n)` | `'—'` for null or `''`; non-numeric → `String(n)`; otherwise `toLocaleString(loc)` (`:50-55`) |
| `fmtLoc(n)` | `null` for null, otherwise `toLocaleString(loc)` (`:2028`) |
| `fmtVol(n)` | `n.toLocaleString(loc,{min 2, max 2 fraction digits}) + ' GB'` (`:2085`) |
| `fmtGB(bytes)` | 0 or falsy → `'0 GB'`. GB = bytes/1024³; if ≥ 1 → `x.toFixed(2)+' GB'`; else MB if ≥ 1 → `'… MB'`; else `'… KB'`. Binary units, `toFixed`, not localized (`:56-63`) |
| `trunc(str, max=45)` | `'—'` if falsy; if longer than `max`, the first `max-1` chars + `…` (`:64-68`) |
| `pct(a,b)` | `b` falsy → `'0%'`; otherwise `Math.round(a/b*100)+'%'` (`:69-72`) |
| `fmtDec(n,d=1)` | `toLocaleString(loc,{maximumFractionDigits:d})` (`:1343`) |
| `fmtDur(min)` | null → `'—'`; under 60 → `round(min)+' min'`; otherwise `fmtDec(min/60,1)+' h'` (`:1344-1348`) |
| `fmtDayTimeUTC(ms)` | `dd/mm hh:mm UTC` (locale day/month, 24 h, UTC) (`:1350-1354`) |

### 0.3 Color semantics (`pdfReport.js:12-25, 73-85, 723-732`)

- Severity color (`sevColor`, `:73-79`): critical red `[192,0,0]`, high orange `[255,130,0]`, medium yellow `[200,160,0]`, anything else green `[0,176,80]`.
- Status color (`statusColor`, `:80-85`): `open|new` → orange; `closed|resolved|analyzed` → green; anything else muted gray.
- Executive palette `T2_PALETTE = [navy, blue, cyan, light, slate, midBlue, green, orange]` (`:732`). It has 8 entries; any category beyond 8 gets no explicit color.

### 0.4 Page chrome (both templates; `pdfReport.js:88-128`)

- A4 portrait, in mm. Margins 14, content width 182 (`:27`).
- Every page except the cover has:
  - a navy header strip with `STELLAR CYBER` + `s.headerSub` (en "Proof of Concept Report") and the page number on the right;
  - a navy footer with `"{footerConfidential} — {clientName}"` on the left (just `CONFIDENTIAL` when there is no client) and `footerCopy` ("© Stellar Cyber, Inc.") on the right.
- **Quirk, do not replicate:** every autotable adds one to the page counter in `didDrawPage`, even on the page where it starts (`:220, :237`). Old page numbers therefore skip. Use real page numbers.
- A new page is forced (`newPage`) at: Section 1, Section 2, the Architecture page, Section 3, Section 4, Section 5, Section 10 and Appendix A. Every other section flows on; `needsPage` only breaks when space runs short.

### 0.5 Normalized input shapes (what `generatePDFReport` receives)

Call site: `pages/Report.jsx:235-254`. Parameters:

| Param | Source | Shape |
|---|---|---|
| `cases` | `fetchCases` (`api.js:64-131`) | Array of normalized cases: all Critical + all High (each capped at 5,000) + the 100 most recent Medium. Low cases are **never** loaded. |
| `lowCount` | `fetchCases` | number = `total` of Low cases. Legacy code tolerates the string `'500+'`: `lowNum = typeof lowCount==='number' ? lowCount : 500` (`pdfReport.js:2041`) |
| `mediumTotal` | `fetchCases` | number = `total` of Medium cases |
| `caseStats` | `fetchCaseStats` (`api.js:148-205`) | aggregates over every case of the period, or `null` |
| `caseTactics` | `fetchCaseTactics` (`api.js:440-567`) | per-alert aggregates of the loaded cases, or `null` |
| `assets` | `fetchEntityUsage` (`api.js:212-240`) | `[{date:'YYYY-MM-DD', entity_count:number}]`, filtered to the period |
| `connectors` | `fetchConnectors` (`api.js:244-259`) | normalized connectors |
| `dataSensors` | `fetchDataSensors` (`api.js:330-346`) | normalized sensors |
| `ingestionBySensor` | `fetchIngestionBySensor` + enrichment (`api.js:286-302`, join in `context/DataContext.jsx`) | `[{id,name,type,version,bytesIngested,...}]` |
| `ingestionByConnector` | `fetchIngestionByConnector` (`api.js:307-323`) | `[{id,name,type,bytesIngested,...}]` |
| `dailyVolume` | `fetchDailyVolume` (`api.js:355-376`) | `[{date:'YYYY-MM-DD', gb:number}]`, sorted ascending |
| `recommendations` | `generateRecommendations({cases, connectors, ingestionTimeline, mitreTechniques: caseTactics?.mitre?.techniques\|\|[], locale})` (`Report.jsx:194-202`). Empty array until a Sync has run. | see §5 |
| `pocMeta` | `PocMetaContext` | see §0.6 |
| `locale`, `s`, `template`, `generatedAt` (`new Date()`) | UI | |

**Normalized case** (`api.js:634-655`):

| Field | Derivation |
|---|---|
| `id` | `_id \|\| id \|\| case_id \|\| 'CASE-'+(1000+i)` |
| `name` | `name \|\| title \|\| summary \|\| 'Security Case n'` |
| `severity` | `normalizeSeverity(severity \|\| priority)` (`api.js:657-665`): `critical/4/p1→Critical`, `high/3/p2→High`, `medium/2/p3→Medium`, `low/1/p4→Low`; anything else or empty → `Medium` |
| `status` | `status \|\| 'New'` |
| `score` | `score` if it is a number, else `null` |
| `alertCount` | `size \|\| assets_affected \|\| alert_count \|\| asset_count \|\| 1` |
| `startedAt` | `start_timestamp` if a number, else null |
| `detectedAt` | `created_at` if a number, else null |
| `rawDate` | `start_timestamp ?? created_at ?? null` |
| `createdAt` | ISO string of `rawDate` (**the activity start comes first, not the case creation**) |

**caseStats** (`api.js:175-199`) has the shape `{ cases, total, alerts, byStatus{status:count}, byResolution, handled, closed, medianCloseHours, acknowledged, medianAckMinutes, top5Alerts }`. It is computed over every case `c` of the period (cap 10,000, newest first):
- `alerts = Σ Number(c.size)||0`.
- `byStatus[c.status||'New']++`.
- `handled = cases − byStatus.New`.
- Close sample: include a case when `c.closed>0 && c.created_at>0 && c.closed>=c.created_at`, value `(closed−created_at)/3.6e6` hours. `closed` = sample size. `medianCloseHours` = true median (the mean of the two middle values when the count is even), or null.
- Ack sample: the same rule with `acknowledged`, in minutes. `acknowledged` = sample size; `medianAckMinutes` = its median.
- `top5Alerts` = sum of the 5 largest `size` values.
- `total` = the API `total` from the first page; it is larger than `cases` when the cap was hit.
- Returns `null` when there is no case.

**caseTactics** (`api.js:440-567`) is built from `GET /cases/{id}/alerts?limit=50&skip=k*50` for every loaded case. Each case gets `ceil(min(alertCount||50, 500)/50)` pages, and each failed page is retried once.
- For each alert doc `_source`: `xdr = _source.xdr_event`. Alerts with no `xdr.tactic.id` are skipped. `isMitre = tactic.id.startsWith('TA')`; everything else (`XTA…` and so on) is "Stellar XDR".
- `mitre.tactics` / `stellar.tactics`: `[{id, name, caseCount, alertCount}]`. `alertCount` = alerts with that tactic; `caseCount` = distinct cases. Sorted `caseCount desc, alertCount desc`.
- `mitre.techniques` / `stellar.techniques`: `[{id, name, tacticId, tacticName, caseCount, alertCount}]`. Only alerts with `xdr.technique.id` count. A technique is attributed to the tactic of the first alert that introduced it. Same sort.
- `mitre.detectedTacticIds`: a `Set` of every MITRE tactic id seen.
- `byCase[caseId] = { tactics:[{id,name,alerts}], xdr:[…], techniques:[…] }`: per-case counts, each sorted by `alerts desc`. Techniques are recorded only for MITRE tactics.
- `topAlerts[caseId] = [{score, description}]`, at most 3 (`api.js:454-469`): the distinct `xdr_event.description` texts with the highest `event_score` (each text keeps its maximum score), sorted descending.

**Normalized connector** (`api.js:667-685`):
- `id`, `name`
- `active = c.active ?? true` (a missing value counts as true)
- `status = active ? 'online' : 'offline'`
- `type = c.type || c.category || 'unknown'`
- `category = c.category || ''`
- `lastActivity`, `lastDataReceived` (ISO)

In the PDF, `activeConn` = connectors with `status==='active' || enabled===true || active===true` (`pdfReport.js:2021-2023`). In practice that means `active===true`.

**Normalized data sensor** (`api.js:571-602`):
- `id = sensor_id || internal_sensor_id`, `hostname`.
- `type`, decided in this order:
  - `feature==='modular'` → `'Modular Sensor'`;
  - `mode==='device'` → `{ds:'Data Sensor', sds:'Security Data Sensor', wds:'Windows Data Sensor', dds:'Deception Data Sensor'}[feature] || 'Data Sensor'`;
  - `os` contains `windows` → `'Windows Server Sensor'`;
  - otherwise `'Linux Server Sensor'`.
- `version` = the first `\d+\.\d+\.\d+` found in `sw_version` (or the raw value).
- `connectionStatus = connection_status`.

**ingestionBySensor** item (`api.js:604-617` + the DataContext join):
- `bytesIngested = total_bytes ?? bytes_ingested ?? bytes ?? total_ingestion ?? 0`.
- `id = … entry_identifier` (the sensor UUID).
- Joined by `id` to dataSensors. When matched: `name=hostname`, `type`, `version`. When not matched: `name = 'Sensor {index+1}'`.
- The join only happens if both fetches succeed.

**ingestionByConnector** item (`api.js:619-632`): `name = connector_name || name || entry_identifier`; `bytesIngested` as above.

**dailyVolume** (`api.js:355-376`), from `/storage-usages?aggr_type=tenant&cust_id=`:
1. Per item: `date = time.slice(0,10)`, `gb = Σ usages[].usage`.
2. Drop `date >= today(UTC)`.
3. Keep `pocStartDate ≤ date ≤ pocEndDate`.
4. Sort ascending.

**assets** (`api.js:212-240`): from `/entity_usages/daily_count/all?days=30&cust_id=` → `{date, entity_count (number, else 0)}`, filtered to `pocStartDate ≤ date ≤ pocEndDate`.

### 0.6 PoC meta fields (`context/PocMetaContext.jsx:7-33`, form in `pages/Report.jsx`)

| Field | Notes |
|---|---|
| `clientName`, `clientDept`, `clientEmail` | |
| `analysts` | string[], each at most 60 chars (`Report.jsx:99`) |
| `successCriteria` | at most 550 chars (`:382`) |
| `seName` | at most 20 chars (`:402`) |
| `seEmail`, `sePhone` | |
| `partnerName`, `partnerEmail`, `partnerSite` | |
| `pocStartDate`, `pocEndDate` | `YYYY-MM-DD`; period at most 30 days; never persisted |
| `platformVersion`, `region` | |
| `version` | default `'1.0'` |
| `verdict` | code `approved\|conditional\|rejected`, or a legacy label |
| `comments` | at most 1500 chars (`:458`) |
| `effortAlertMin`, `effortCritHighMin`, `effortMediumMin`, `effortLowMin`, `effortMonthHours` | strings; the form shows them only when Template 2 is selected (`Report.jsx:475-488`) |
| `architectureImage` | data URL; Technical only |
| `architectureImageDims` | `{w,h}` |

### 0.7 Report-level derived values (computed once, `pdfReport.js:1976-2086`)

| Name | Formula | Line |
|---|---|---|
| `critCases` / `highCases` | loaded cases with `severity.toLowerCase()==='critical'` / `'high'` | 1976-1977 |
| `openCases` | loaded cases whose status (lower-cased) is `open` or `new` | 1978-1981 |
| `resolvedCases` | loaded cases whose status is not `open`/`new` | 1982-1985 |
| `openCount` | `caseStats ? (byStatus.New\|\|0)+(byStatus.Open\|\|0) : openCases.length` | 2018 |
| `resolvedCount` | `caseStats ? caseStats.cases − openCount : resolvedCases.length` | 2019 |
| `lowNum` | `typeof lowCount==='number' ? lowCount : 500` | 2041 |
| `totalCasesCount` | `critCases.length + highCases.length + mediumTotal + lowNum` (**not** `caseStats.cases`) | 2044 |
| `statusBase` | `caseStats ? caseStats.cases : totalCasesCount` | 2046 |
| `totalCasesStr` | `fmtNum(totalCasesCount)`, plus `'+'` if `lowCount` is a string | 2047-2049 |
| `entStats` | `assetStats(assets)` → `{days, zeroDays, min, avg (rounded integer), max}` or null (§8) | 2030 |
| `avgEntities` / `minEntities` / `maxEntities` | `fmtLoc` of the stats; null when there are no stats | 2031-2033 |
| `entDaysNote` | `entitiesDaysNote` = "{days} days in period · {zero} with count 0", or `''` | 2034-2037 |
| `detectedTactics` | `caseTactics.mitre.detectedTacticIds`. Fallback when there is no caseTactics: a Set of `rec.mitre.tactic` from the recommendations. **Buggy:** that stores `{id,name}` objects, so `.has(id)` never matches, though the size still counts. | 2053-2059 |
| `mitreCovPct` | `Math.round(detectedTactics.size / 14 * 100)` (14 = `ALL_TACTICS.length`). Any extra TA id seen (for example ICS tactics) also counts, so in theory it can exceed 100. Recommended: intersect with the 14. | 2063 |
| `mitreTechniqueData` | `caseTactics?.mitre?.techniques \|\| []` | 2060 |
| `stellarTacticData` / `stellarTechData` | `caseTactics?.stellar?.tactics/techniques \|\| []` | 2061-2062 |
| `connByCategory` | count per `conn.category \|\| conn.type \|\| s.connectorCatOther ("Other")` | 2066-2070 |
| `opRecs` / `mitrRecs` | recommendations with `category !== 'MITRE ATT&CK'` / `=== 'MITRE ATT&CK'` | 2073-2074 |
| `verdictKey`, `verdict`, `verdictColor` | see §7.1 | 2078-2080 |
| `vol` | `volumeStats(dailyVolume)` (§8) | 2084 |
| `totalIngestStr` | `vol ? fmtVol(vol.total) : '—'` | 2086 |
| `invEff` | see §7.2 | 1993-2013 |
| `integPct` / `integStr` | `connectors.length ? round(active/total*100) : 0`; `"{active}/{total} ({pct}%)"`, or `'—'` | 2518-2519 |

`ALL_TACTICS` (fixed order, `pdfReport.js:468-483`): TA0001 Initial Access, TA0002 Execution, TA0003 Persistence, TA0004 Privilege Escalation, TA0005 Defense Evasion, TA0006 Credential Access, TA0007 Discovery, TA0008 Lateral Movement, TA0009 Collection, TA0010 Exfiltration, TA0011 Command and Control, TA0040 Impact, TA0042 Resource Development, TA0043 Reconnaissance.

---

## 1. Template 1 — Technical

The order below is the drawing order. It is **not** strictly numeric: 1.2 comes before 1.1, 2.3 before 2.2, 4.2 before 4.1, and 5.2 before 5.1.

### T1.0 Cover page (`drawCover`, `pdfReport.js:560-689`)

No header or footer. A vertical navy→blue gradient rail runs down the left edge.

| Element | Content |
|---|---|
| Brand line | `STELLAR CYBER` + `  \|  ISOC Platform` (hard-coded) |
| Pill | `coverConfidential` = "CONFIDENTIAL" |
| Hero | `coverTitle1` "Stellar Cyber XDR" / `coverTitle2` "Platform" |
| Subtitle | `coverReportType` "Proof of Concept Report" |
| Block "PREPARED FOR" (`blockPreparedFor`) | `clientName` (bold), `clientDept`, `clientEmail` |
| Block "STELLAR CYBER ANALYST" (`blockStellarCyber`; code fallback "STELLAR CYBER SYSTEM ENGINEER") | `seName` (bold), `seEmail`, `sePhone` |
| Block "STAKEHOLDERS" (`blockStakeholders`) | `analysts.filter(Boolean).join('; ')` |
| Block "PARTNER" (`blockPartner`) | `partnerName` (bold), `partnerEmail`, `partnerSite` |
| Footer line | `Version {version\|\|'1.0'}  \|  PoC Period {fmtDate(start)}–{fmtDate(end)}  \|  Report Date {fmtDate(now)}` (`footerVersion`, `footerPocPeriod`, `footerReportDate`) |

Empty fields are skipped inside a block (`drawInfoBlock`, `:535-557`).

### T1.1 Section 1 — "Executive Summary" (`sec1`) (`pdfReport.js:2183-2466`)

New page with a section bar.

#### T1.1.2 "1.2 Context and Objectives" (`sub1_2`) (`:2233-2278`) — drawn first

1. Paragraph `body1_1` (en): "This report consolidates the strategic and operational results obtained during the Proof of Concept (PoC) of the Stellar Cyber ISOC Platform, executed in the environment of {client}. The primary objective was to validate … as follows:". Substitutions (first occurrence only):
   - `{clientName}` and `{client}` → `pocMeta.clientName || clientNamePlaceholder ("the client")`;
   - `{pocStartDate}`, `{pocEndDate}` → `fmtDate`.
2. Success criteria, only if `pocMeta.successCriteria` is not empty (`:2245-2268`):
   - Split on `;` or newline, trim, and drop empty items.
   - If at least one item remains: a bold heading `successCriteriaTitle` "Success Criteria:", then one bullet `• {item}` per item.
3. Paragraph `body1_2` (en): "The validation and monitoring activities spanned from {startDate} to {endDate}. Throughout this evaluation cycle, {connCount} strategic data sources were successfully integrated. … grouping of +{caseCount} complex security cases. This volume translated into a coverage of {mitrePct}% of the tactics …". Substitutions:
   - `{startDate}` / `{endDate}` = `fmtDate`;
   - `{connCount}` = `connectors.length` (all connectors, not only active ones);
   - `{caseCount}` = `String(totalCasesCount)` (not formatted);
   - `{mitrePct}` = `mitreCovPct`.

#### T1.1.1a 1.1 KPI table (no subtitle of its own; follows 1.2) (`:2284-2317`)

Columns: `kpiMetric` "Metric" | `kpiValue` "Value" | `kpiNotes` "Notes". Rows:

| Metric (key → en) | Value | Notes |
|---|---|---|
| `kpiCasesDetected` "Detected Cases" | `totalCasesStr` | `"{critCases.length} critical, {highCases.length} high"` (`critLabel`, `highLabel`; raw integers) |
| `kpiAvgEntities` "Avg. Monitored Assets/Day" | `avgEntities` or `—` | `kpiEntitiesNote` "Daily active assets (hosts / users / devices)", plus `' · ' + entDaysNote` when present |
| `kpiMinEntities` "Minimum assets/day" | `minEntities` or `—` | `minEntitiesNote` "Lowest daily count in the period" |
| `kpiMaxEntities` "Maximum assets/day" | `maxEntities` or `—` | `maxEntitiesNote` "Highest daily count in the period (peak)" |
| `kpiActiveConn` "Connectors" | `"{activeConn} / {connectors}"` (with spaces) | `kpiConnNote` "Active data sources connected" |
| `kpiMitreCov` "MITRE ATT&CK Coverage" | `"{mitreCovPct}% ({detected}/14)"` | `kpiMitreNote` "Tactics detected out of 14" |
| `kpiOpenCases` "Open Cases" | `fmtNum(openCount)` | `pct(openCount, statusBase) + ' ' + ofTotal ("of total")` |

#### T1.1.1b "1.1 Key Performance Indicators" (`sub1_1`) — KPI cards + 2×2 charts (`:2323-2466`)

New page. One row of 7 solid KPI cards (value in white bold, label below):

| Label key → en | Value | Color |
|---|---|---|
| `kpiCasesDetected` "Detected Cases" | `totalCasesStr` | blue |
| `kpiCritCases` "Critical Cases" | `String(critCases.length)` | red |
| `kpiOpenCases` "Open Cases" | `fmtNum(openCount)` | orange |
| `kpiResolvedCases` "Resolved Cases" | `fmtNum(resolvedCount)` | green |
| `kpiAvgEntities` "Avg. Monitored Assets/Day" | `avgEntities \|\| '—'` | navy |
| `kpiActiveConn` "Connectors" | `"{active}/{total}"` | midBlue |
| `kpiMitreCov` "MITRE ATT&CK Coverage" | `"{mitreCovPct}%"` | blue |

Then four charts, each half width × 70 mm. They are Chart.js doughnuts with the legend at the bottom and tooltips off.

1. **Case Severity** (`chartSeverity`) (`:2352-2385`)
   - Doughnut, cutout 62%. Labels `sevCritical/High/Medium/Low`.
   - Data `[critCases.length, highCases.length, mediumTotal, lowNum]`, colors red/orange/yellow/green.
   - Centre text: `fmtNum(sum)` + `totalLabel` "total".
   - Hidden when the sum is 0 (the title is still drawn).
2. **Case Status** (`chartStatus`) (`:2388-2415`)
   - Doughnut. Labels `statusOpen` "Open" / `statusClosed` "Analyzed".
   - Data `[openCount, resolvedCount]`, colors orange/midBlue.
   - Centre text: `fmtNum(openCount)` and the hard-coded English `"open · {round(open/(open+resolved)*100)}%"` (not translated).
   - Hidden when open + resolved = 0.
3. **MITRE Coverage** (`chartMitre`) (`:2419-2438`)
   - Gauge: a 270° doughnut (rotation −135), data `[mitreCovPct, 100−mitreCovPct]`, blue/gray, cutout 65%.
   - Centre text: `"{mitreCovPct}%"` + `chartMitreLabel` "tactic coverage".
   - Always drawn.
4. **Sources by Category** (`chartSources`) (`:2440-2464`)
   - Doughnut of `connByCategory` in insertion order. Palette `[blue, midBlue, navy, green, orange, yellow, red]`; categories beyond 7 get no color.
   - Centre text: `fmtNum(connectors.length)` + `sourcesLabel` "sources".
   - Hidden when `connectors.length === 0`.

### T1.2 Section 2 — "Scope and Methodology" (`sec2`) (`:2471-2551`)

New page.

#### T1.2.1 "2.1 Evaluated Environment" (`sub2_1`) (`:2475-2490`)

Two-column table `envParam` "Parameter" | `envValue` "Value". The tenant id is left out on purpose. Each value falls back to `'—'`.

| Parameter (key → en) | Value |
|---|---|
| `envClient` "Client" | `clientName` |
| `envDept` "Department" | `clientDept` |
| `envSE` "SE / Analyst" | `seName` |
| `envPartner` "Partner" | `partnerName` |
| `envStart` "PoC Start" | `fmtDate(pocStartDate)` |
| `envEnd` "PoC End" | `fmtDate(pocEndDate)` |
| `envVersion` "Platform Version" | `platformVersion` |
| `envRegion` "Region" | `region` |

#### T1.2.3 "2.3 Success Criteria" (`sub2_3`) — drawn before 2.2 (`:2493-2534`)

Columns `scCriteria` "Criterion" | `scTarget` "Target" | `scResult` "Result". The targets are static text; there is **no pass/fail evaluation**.

| Criterion (key → en) | Target (key → en) | Result |
|---|---|---|
| `sc1` "MITRE ATT&CK Coverage" | `sc1target` "> 85% of tactics detected" | `"{mitreCovPct}%"` |
| `sc2` "Time to Detect (MTTD)" | `sc2target` "< 5 min and not > 15 min" | `mttdStr` (see below) |
| `sc3` "Integration Coverage" | `sc3target` "100% of sources sent data" | `integStr` = `"{active}/{total} ({integPct}%)"`; `'—'` if there are no connectors |
| `sc4` "Alert Noise Reduction" | `sc4target` "> 80% correlated alerts" | `noiseStr` (see below) |

**`mttdStr`** (`:2497-2505`):
- Use loaded cases with `startedAt!=null && detectedAt!=null && detectedAt > startedAt` (strictly after).
- Value per case: `(detectedAt−startedAt)/60000` minutes.
- Sort ascending and take `sorted[floor(n/2)]` (the upper median; no averaging).
- Format `toFixed(1)+' min'`; `'—'` if there are no values.

**`noiseStr`** (`:2509-2515`):
- `scCases = caseStats ? caseStats.cases : cases.length`.
- `scTotalAlerts = caseStats ? caseStats.alerts : Σ(c.alertCount||1)`.
- `noise% = alerts > cases ? round((1 − cases/alerts)*100) : 0`.
- `ratio = cases>0 ? round(alerts/cases) : 0`.
- Value `"{noise%}% ({ratio}:1)"`; `'—'` if `scCases = 0`.

#### T1.2.2 "2.2 Methodology Phases" (`sub2_2`) (`:2537-2551`)

Table `phaseNum` "#" | `phaseName` "Phase" | `phaseDesc` "Description". Static rows (`methodologyPhases` is absent, so the defaults with these keys are used):

| # | Phase (key → en) | Description |
|---|---|---|
| 1 | `phase1` "1 — Integration" | `phase1desc` "Integration of log sources and sensors into the platform" |
| 2 | `phase2` "2 — Baseline" | `phase2desc` "Establishment of behavioral baseline for the environment" |
| 3 | `phase3` "3 — Simulation" | `phase3desc` "Execution of attack scenarios and detection analysis" |
| 4 | `phase4` "4 — Analysis" | `phase4desc` "Event correlation and MITRE ATT&CK mapping" |
| 5 | `phase5` "5 — Reporting" | `phase5desc` "Documentation of results, gaps and recommendations" |

### T1.A Architecture page — "Minimum Suggested Architecture" (`secArch`) (`:2557-2591`)

Technical only. New page with an appendix-style mid-blue bar (no number).
- If `pocMeta.architectureImage` is set:
  - Image size comes from the embedded pixels (`getImageProperties`), falling back to `architectureImageDims`.
  - Pixels are converted to mm at 96 DPI (`×25.4/96`).
  - The image is scaled **down only** to fit 182 × 160 mm, and centered horizontally.
  - On a render error: info note `archImageError` "Architecture image could not be rendered."
- Otherwise: info note `noArchImage` "No architecture image provided. Upload one in the report configuration screen."
- Upload normalization (EXIF orientation → canvas → JPEG/PNG) lives in `utils/image.js` (`CLAUDE.md:102`).

### T1.3 Section 3 — "Platform Technical Overview" (`sec3`) (`:2596-2690`)

New page.

#### T1.3.1 "3.1 Ingestion Overview" (`sub3_1`) (`:2600-2613`)

4 KPI cards:

| Label → en | Value | Color |
|---|---|---|
| `statTotalSources` "Total Sources" | `fmtNum(connectors.length)` | navy |
| `statActiveSources` "Active Sources" | `fmtNum(activeConn.length)` | green |
| `statTotalIngested` "Total Ingested" | `totalIngestStr` (sum of the daily licensing volume, `fmtVol`; `'—'` without data) | blue |
| `statSensorTypes` "Sensor Types" | `fmtNum(ingestionBySensor.length)` (**the number of sensors with ingestion, not of types** — mislabelled) | midBlue |

#### T1.3.2 "3.2 Connected Sources" (`sub3_2`) (`:2628-2654`)

- If there are no connectors: info note `noConnectors` "No connectors/sensors identified via API."
- Otherwise a compact table with one row per connector (all of them, in API order):

| Column (key → en) | Value |
|---|---|
| `connName` "Connector Name" | `trunc(name\|\|id, 35)` |
| `connType` "Type" | `type\|\|category\|\|'—'` |
| `connStatus` "Status" | `status` (`online`/`offline`) |
| `connLastSeen` "Last Seen" | `fmtDate(lastDataReceived\|\|lastActivity)` |
| `connIngested` "Ingested" | `fmtGB(bytes)`, where bytes come from the `ingestionByConnector` item whose `name` exactly equals the connector `name`; 0 if none |

#### T1.3.3 "3.3 Data Ingestion Detail" (`sub3_3`) (`:2656-2690`)

Shown only if `ingestionBySensor.length>0 || ingestionByConnector.length>0`.
- Sensor table (if there are sensors), in API order: `sensorName` "Sensor" = `trunc(name,30)`; `sensorType` "Type"; `sensorVersion` "Version"; `sensorBytes` "Volume" = `fmtGB(bytesIngested||bytes||size||0)`.
- Connector table (if there are connectors), in API order: `connIngName` "Connector" = `trunc(name||connector, 40)`; `connIngBytes` "Volume" = `fmtGB(...)`.

### T1.4 Section 4 — "Detection and Response Results" (`sec4`) (`:2695-2841`)

New page. **If `cases.length === 0`**, the section shows only the info note `noCases` "No cases detected during the evaluation period." and skips its whole body.

#### T1.4.2 "4.2 Detection Metrics" (`sub4_2`) — drawn first (`:2711-2728`)

Columns `metMetric` "Metric" | `metValue` "Value" | `metPct` "Of Total".

| Metric → en | Value | Of Total |
|---|---|---|
| `metCritical` "Critical Cases" | `fmtNum(critCases.length)` | `pct(crit, totalCasesCount)` |
| `metHigh` "High Cases" | `fmtNum(highCases.length)` | `pct(high, totalCasesCount)` |
| `metMedium` "Medium Cases" | `fmtNum(mediumTotal)` | `pct(mediumTotal, totalCasesCount)` |
| `metLow` "Low Cases" | `fmtNum(lowCount)` | `pct(lowNum, totalCasesCount)` |
| `metOpen` "Open Cases" | `fmtNum(openCount)` | `pct(openCount, statusBase)` |
| `metAvgScore` "Average Score" | `round(Σ(c.score\|\|0)/cases.length)` over **all loaded cases, counting a null score as 0** | `''` |

#### T1.4.x Chart "Top Detection Types (by analyzed cases)" (`chartDetectionTypes`) (`:2731-2747`, builder `:514-532`)

Horizontal bar, full width × 50 mm. `buildDetectionTypes(cases)` over the loaded cases:
1. Group key = `(c.name||'—')` with the suffix `/ and \d+ other\(s\)$/i` removed, then trimmed. Only the `other(s)` form is removed; this differs from `threatName` in §3.2.
2. Per group: `total += c.alertCount || 1`, and collect the non-null scores.
3. Sort by `total` descending and keep the **top 8**.
4. `avgScore` = mean of the scores, or 50 when there are none. Color: `avg ≥ 80` red, `avg ≤ 40` orange, otherwise blue.
5. Labels `trunc(name, 40)`; value = `total` (alerts).

Hidden if there are no groups.

#### T1.4.y Chart "Daily Critical & High Cases" (`chartTimeline`) (`:2755-2767`, builder `:486-509`)

Line chart, full width × 45 mm: filled, red, tension 0.3, a point only where the value is above 0, y axis from 0 with integer ticks, at most 12 x ticks.
- Days run from `new Date(pocStartDate)` to `new Date(pocEndDate)` inclusive, one day per step.
- Value per day = loaded Critical/High cases whose `createdAt` (ISO of `start_timestamp ?? created_at`) starts with that day's UTC `YYYY-MM-DD`.
- Label `DD/MM`.
- **Quirk:** the loop uses local `setDate` and the labels use local `getDate()`, but matching uses UTC, so labels shift west of UTC. Port it with UTC days (the same as `t2Days`).
- Hidden if the PoC dates are missing.

#### T1.4.1 "4.1 Detected Cases" (`sub4_1`) (`:2770-2840`)

Compact table. Rows = `[...critCases, ...highCases, ...first 100 Medium of cases]` in API order (Critical and High by `created_at desc`; Medium = the 100 most recent).

| Column (key → en) | Value |
|---|---|
| `caseName` "Case" | `trunc(name\|\|id, 35)` |
| `caseSev` "Severity" | bold, colored with `sevColor` |
| `caseStatus` "Status" | colored with `statusColor` |
| `caseScore` "Score" | `String(score)` or `—` |
| `caseAlerts` "Alerts" | `alertCount` |
| `caseDate` "Date" | `fmtDate(rawDate \|\| createdAt)`; rawDate = `start_timestamp ?? created_at`, epoch ms |

Under **each Critical case only**, one full-width (colSpan 6) sub-row per entry of `caseTactics.topAlerts[c.id]` (at most 3), with the text `• {description}` in small gray. The text is in the API's language (English).

After the table:
- If `mediumTotal > 100`: info note `mediumTruncated` "Showing top 100 medium cases. Total medium cases: {n}" (`fmtNum(mediumTotal)`).
- If `lowNum > 0`: info note `lowOmitted` "{n} low-severity cases omitted from table for brevity." (`fmtNum(lowCount)`).

### T1.5 Section 5 — "MITRE ATT&CK Coverage Analysis" (`sec5`) (`:2846-3012`)

New page.

#### T1.5.2 "5.2 Coverage Summary" (`sub5_2`) — drawn first (`:2850-2863`)

3 KPI cards:
- `covDetected` "Detected Tactics" = `detectedTactics.size` (blue)
- `covNotDetected` "Not Detected" = `14 − size` (muted)
- `covTotal` "Total MITRE Tactics" = `14` (navy)

Then a 7×2 grid of the 14 `ALL_TACTICS` (`:2871-2898`). A cell is navy with white text if `detectedTactics.has(id) || has(name)`, otherwise gray with muted text. Each cell shows the tactic id and name (at most 2 lines).

#### T1.5.1 "5.1 Tactic Coverage" (`sub5_1`) (`:2901-2920`)

Table `tacticId` "Tactic ID" | `tacticName` "Tactic" | `tacticStatus` "Status". The 14 tactics in `ALL_TACTICS` order. Status is `detected` "Detected" (green bold) or `notDetected` "Not Detected" (muted).

#### Chart "Top Techniques by Affected Cases" (`chartTechniques`) (`:2923-2939`)

Horizontal bar, full width × 55 mm, blue.
- Data = the first **10** entries of `mitreTechniqueData` (already sorted caseCount desc, alertCount desc).
- Label `trunc("{id} — {name}", 45)`; value `caseCount`.
- Hidden if empty.

#### T1.5.3 "5.3 Stellar Cyber XDR Proprietary Detections" (`sub5_3`) (`:2942-3012`)

Only if `stellarTacticData.length > 0`.
- Paragraph `body5_3`: "In addition to the MITRE ATT&CK framework, the Stellar Cyber platform features a proprietary behavioral analytics engine (XDR) that detects threats using exclusive tactics and techniques, extending coverage beyond the 14 standard tactics."
- Table of all XDR tactics (sorted caseCount desc, alertCount desc): `xtaTacticId` "Tactic (ID)" (blue bold) | `xtaTacticName` "XDR Tactic" | `xtaCases` "Cases" = caseCount | `xtaAlerts` "Alerts" = alertCount.
- **5.3.1 "XDR Techniques Detected"** (`sub5_3_tech`; a plain bold heading, not `subTitle`), only if `stellarTechData.length>0`. The first **20** techniques: `xtaTechId` "Technique (ID)" | `xtaTechName` "XDR Technique" | `xtaTactic` "Tactic" = tacticName | `xtaCases` "Cases".

### T1.6 Section 6 — "Operational Assessment" (`sec6`) (`:3019-3044`)

Flows on (no forced page). Static content.

**6.1 "Incident Response Workflow"** (`sub6_1`): table `irStep` "Step" | `irDesc` "Description". Description keys are `irStepNdesc`.

| Step | Description |
|---|---|
| `irStep1` "1. Alert Triage" | "AI-ranked alerts surfaced in unified inbox; analyst reviews and prioritizes." |
| `irStep2` "2. Investigation" | "One-click drill-down with correlated evidence, asset timeline and threat intel." |
| `irStep3` "3. Containment" | "Automated or manual response actions (isolate, block, quarantine)." |
| `irStep4` "4. Eradication" | "Remove artifacts, patch vulnerability, revoke compromised credentials." |
| `irStep5` "5. Recovery" | "Restore services and monitor for re-compromise." |
| `irStep6` "6. Post-Incident" | "Lessons learned, rule tuning and playbook updates." |

**6.2 "Automation & Playbooks"** (`sub6_2`): paragraph `body6_2` "Stellar Cyber's built-in SOAR capabilities enable automated triage, enrichment and response playbooks that reduce analyst fatigue and accelerate containment."

### T1.7 Section 7 — "ROI Analysis and Consolidation" (`sec7`) (`:3049-3188`)

#### T1.7.1 "7.1 Real Metrics" (`sub7_1`) (`:3053-3070`)

Columns `roiMetric` "Metric" | `roiValue` "Value" | `roiContext` "Context".

| Metric → en | Value | Context |
|---|---|---|
| `metTotalCases` "Total Cases" | `fmtNum(totalCasesCount)` | `''` |
| `metCritHigh` "Critical + High" | `fmtNum(crit+high)` | `pct(crit+high, totalCasesCount)` |
| `metMitreCov` "MITRE Tactic Coverage" | `"{mitreCovPct}%"` | `"{detected} / 14"` |
| `metAvgEntitiesDay` "Avg. Monitored Assets/Day" | `avgEntities\|\|'—'` | `entitiesNote` "Daily assets" + `' · ' + entDaysNote` |
| `kpiMinEntities` "Minimum assets/day" | `minEntities\|\|'—'` | `minEntitiesNote` |
| `kpiMaxEntities` "Maximum assets/day" | `maxEntities\|\|'—'` | `maxEntitiesNote` |
| `metActiveSources` "Active Sources" | `fmtNum(activeConn)` | `"{of} {fmtNum(connectors.length)}"` = "of N" |
| `metTotalIngested` "Total Data Ingested" | `totalIngestStr` | `ingestedNote` "Total for the period" |

#### T1.7.2 "7.2 Qualitative Benefits" (`sub7_2`) (`:3073-3084`)

Five paragraphs, `qb1`…`qb5`:
- "• Unified visibility across network, endpoint, cloud and email."
- "• Dramatically reduced alert fatigue through AI-powered correlation."
- "• Accelerated investigation with automated evidence correlation."
- "• Reduced tool sprawl and operational complexity."
- "• Scalable architecture supporting hybrid and multi-cloud environments."

#### T1.7.3 "7.3 License Compliance" (`sub7_3`) (`:3090-3128`)

1. Paragraph `licHowCounted`: "Official license count: the platform counts assets of these types: unique devices (internal IPs) and unique users (emails) observed daily."
2. `lic = assetCompliance(assets)` (integer mode, §8). Then one of:
   - `!lic.stats` (no asset days) → info note `licNoData` "No asset data in the PoC period."
   - `lic.recommended == null` (fewer than 3 days) → info note `licInsufficient` "Insufficient period to recommend ({n} of {d} days)", with `n = stats.days` and `d = 3`.
   - Otherwise → the **license compliance block** (below), with `fmt = fmtLoc` and these texts:

| `txt` field | Key | en value |
|---|---|---|
| `recommended` | `licRecommended` | "Recommended license quantity: {l} assets" |
| `recommendedNote` | `licRecommendedNote` | "Highest number of assets present on each of 3 consecutive days ({from} — {to}). With this quantity no notification level is reached in the observed period." |
| `limitLine` | `licLimitLine` | "Tolerance limit (110%): {t} assets per day." |
| `shortPeriod` | `licShortPeriod` | "Recommendation based on {n} days of data. 30 days of asset discovery are recommended." |
| `licenseCol` | `licColLicense` | "Licenses" |
| `desc[0]` | `licDescIntro` | "With {l} asset licenses, the platform tolerates up to {t} assets per day (110%). Beyond that:" |
| `desc[1]` | `licDescWarning` | "• If the daily count stays above {t} assets on 3 consecutive days, the platform issues a Warning: a removable banner appears in the UI." |
| `desc[2]` | `licDescViolation` | "• If it stays above {t} assets for 7 consecutive days, it enters Violation: the banner can no longer be removed and the account admin receives an email." |
| `desc[3]` | `licDescOoc` | "• If it stays above {t} assets for 21 consecutive days (7 to enter Violation + 14 in Violation), the license is Out of Compliance: services cease and a prorated invoice is issued." |
| `desc[4]` | `licDescBreak` | "A single day with {t} assets or fewer — including a day with count 0 — breaks the run, and the consecutive-day count starts over." |

**License compliance block** (`drawLicenseCompliance`, `pdfReport.js:247-313`; shared by 7.3 and 7.4). `l = fmt(lic.recommended)` and `t = fmt(lic.limit)`; `{l}` and `{t}` are replaced everywhere.

1. If `lic.stats.days < 30` and `hideShortPeriod` is false (the Technical report always shows it): info note `txt.shortPeriod` with `{n}=stats.days`.
2. A bold navy line `txt.recommended`; a muted line `txt.recommendedNote` with `{from}` / `{to}` = `fmtDay(recommendedWindow.from/to)`; then the line `txt.limitLine`.
3. Heading `licTableTitle` "Compliance with the recommended license", then a 3-row table (Warning, Violation, Out of Compliance). With the recommended license, by construction no level is reached.

| Column | Warning row | Violation row | Out of Compliance row |
|---|---|---|---|
| `licColLevel` "Level" | `licWarning` "Warning" | `licViolation` "Violation" | `licOoc` "Out of Compliance" |
| `licColRule` "Rule" | `licRuleWarning` "Above 110% of the limit on each of 3 consecutive days" | `licRuleViolation` "Above 110% of the limit on each of 7 consecutive days" | `licRuleOoc` "Above 110% of the limit for 21 consecutive days (7 to enter Violation + 14 in Violation)" |
| `licColRun` "Longest run above {t}" | `runText(lic.result.longestRun)` | same | same |
| `licColOutcome` "Result" | `licReached` "Reached" (red) if `longestRun.days ≥ level.days`, else `licNotReached` "Not reached" (green) | same rule | same rule |
| `licColResult` "Description" | `licResWarning` "Removable banner in the UI. Clears after 3 consecutive days at or below 110%." | `licResViolation` "Non-removable banner and email to the account admin. Clears after 7 consecutive days at or below 110%." | `licResOoc` "Services cease and a prorated invoice covers the gap between average usage since the first Violation and the license." |

   `runText(run)` shows the same value on every row:
   - no run → `licRunNone` "0 days";
   - 1 day → `licRunOneDay` "1 day ({from})";
   - otherwise `licRunDays` "{n} days ({from} — {to})" (dates via `fmtDay`).
4. Heading `licScenarioTitle` "Licensing scenarios", then a 3-row table. Rows: `average` (`licScenAverage` "Period average"), `recommended` (`licScenRecommended` "Recommended", drawn bold), `peak` (`licScenPeak` "Period peak").

| Column | Value |
|---|---|
| `licColScenario` "Scenario" | scenario label |
| `txt.licenseCol` | `fmt(sc.license)` |
| `licColLimit` "Limit/day (110%)" | `fmt(sc.limit)` |
| `licColDaysAbove` "Days above limit" | `daysAbove` |
| `licColLongest` "Longest run" | `runText(longestRun)` |
| `licColLevelReached` "Level reached" | `licLevelNone` "None" / Warning / Violation / Out of Compliance; green if none, otherwise red |

5. The five `txt.desc` paragraphs, with `{l}` and `{t}` filled in.

#### T1.7.4 "7.4 Data Ingestion" (`sub7_4`) (`:3134-3188`)

1. Paragraph `volIntro`: "Daily data volume of the tenant in the period, as recorded by the platform for volume licensing (data stored after enrichment and compression). The current day is not included, since it only closes after 24 hours."
2. If `!vol`: info note `volNoData` "No volume data in the period (the API provides the last 31 days)." and stop.
3. Table `roiMetric | roiValue | roiContext`:

| Metric | Value | Context |
|---|---|---|
| `volAvg` "Daily average" | `fmtVol(vol.avg)` | `volPeriodNote` "{days} days ({from} — {to})" (`fmtDate`) + `' · '` + `volZeroNote` "{zero} days with volume 0" |
| `volMin` "Daily minimum" | `fmtVol(vol.min)` | `fmtDate(vol.minDate)` |
| `volMax` "Daily maximum" | `fmtVol(vol.max)` | `fmtDate(vol.maxDate)` |

4. Muted paragraph `volNote`: "Values may differ from the per-sensor and per-connector ingestion tables (section 3), which measure data before enrichment and compression."
5. `volLic = volumeCompliance(dailyVolume)` (continuous mode, §8).
   - If `recommended == null`: info note `licInsufficient` with `n = vol.days` and `d = 3`.
   - Otherwise the license compliance block with `fmt = fmtVol` and the texts below. The three middle `desc` lines are the asset sentences without the word "assets".

| `txt` field | Key | en value |
|---|---|---|
| `recommended` | `volRecommended` | "Recommended volume license: {l} per day" |
| `recommendedNote` | `volRecommendedNote` | "Highest daily volume present on each of 3 consecutive days ({from} — {to}). With this volume no notification level is reached in the observed period." |
| `limitLine` | `volLimitLine` | "Tolerance limit (110%): {t} per day." |
| `shortPeriod` | `volShortPeriod` | "Recommendation based on {n} days of data. 30 days of data are recommended." |
| `licenseCol` | `volColLicense` | "License (GB/day)" |
| `desc[0]` | `volDescIntro` | "With a {l}/day volume license, the platform tolerates up to {t} per day (110%). Beyond that:" |
| `desc[1..3]` | `volDescWarning`, `volDescViolation`, `volDescOoc` | the asset sentences without "assets" |
| `desc[4]` | `volDescBreak` | "A single day at {t} or less — including a day with volume 0 — breaks the run, and the consecutive-day count starts over." |

### T1.8 Section 8 — "Risks, Gaps and Recommendations" (`sec8`) (`drawRisksSection`, `:3194-3246`)

#### T1.8.1 "8.1 Operational Recommendations" (`sub8_1`)

- If `opRecs.length === 0`: info note `noOpRecs` "No operational recommendations recorded."
- Otherwise a compact table, in recommendation sort order (§5):
  - `recTitle` "Recommendation" = `trunc(title||name, 40)`;
  - `recPriority` "Priority" = `recPrioCritical` "Critical" / `recPrioWarning` "Warning" / `recPrioInfo` "Info" (falls back to the raw priority);
  - `recDesc` "Description" = `trunc(description||details, 80)`.

#### T1.8.2 "8.2 MITRE ATT&CK Recommendations" (`sub8_2`)

Built directly from `mitreTechniqueData`, not from the recommendation objects.
- If empty: info note `noMitreRecs` "No MITRE-based recommendations recorded."
- Otherwise a compact table with one row per detected MITRE technique (all of them, sorted caseCount desc, alertCount desc):
  - `mitreId` "Technique ID" = id;
  - `mitreName` "Technique" = `trunc(name, 40)`;
  - `mitreMitigation` "Mitigation" = `trunc(getMitreMitigation(id, locale) || 'attack.mitre.org/techniques/' + id.replace('.', '/'), 110)` (§6).

### T1.9 Section 9 — "Next Steps" (`sec9`) (`:3251-3266`)

**9.1 "Recommended Actions"** (`sub9_1`): static table `nsStep` "#" | `nsAction` "Action" | `nsOwner` "Owner" | `nsDue` "Target Date".

| # | Action | Owner | Target Date |
|---|---|---|---|
| 1 | `ns1` "Finalize commercial proposal" | `ns1owner` "Account Team" | `ns1due` "2 weeks" |
| 2 | `ns2` "Address identified coverage gaps" | "SE / Customer" | "1 month" |
| 3 | `ns3` "Plan full deployment architecture" | "SE" | "1 month" |
| 4 | `ns4` "Complete integrations inventory" | "Customer IT" | "2 months" |
| 5 | `ns5` "Sign off production deployment plan" | "Both parties" | "TBD" |

### T1.10 Section 10 — "Conclusion" (`sec10`) (`:3271-3393`)

New page.
1. **10.1 "PoC Scorecard"** (`sub10_1`): table `scArea` "Area" | `scScore` "Score" | `scNotes` "Notes" (rules in §7.2).
2. **Verdict banner**: a full-width rounded box filled with `verdictColor`. Line 1 is `verdictLabel` "Verdict"; line 2 is the `verdict` label or `verdictPending` "Pending" (§7.1).
3. Paragraph `body10` (en) (`:3349-3358`): "The PoC executed from {pocStartDate} to {pocEndDate} validated that the Stellar Cyber ISOC Platform consolidates … {caseCount} security events were identified with proven coverage of {mitrePct}% of MITRE ATT&CK tactics. … raising the overall information security posture for the institution {clientName}." Substitutions:
   - `{pocStartDate}` / `{pocEndDate}` = `fmtDate`;
   - `{clientName}` = client name or "the client";
   - `{caseCount}` = `totalCasesStr`;
   - `{mitrePct}` = `mitreCovPct`.
   The code fallback mentions `{verdict}`, which is never substituted; the en text has no `{verdict}`.
4. If `pocMeta.comments` is set: subtitle `seCommentsTitle` "SE Comments" + the comments text.
5. Subtitle `signaturesTitle` "Signatures", then two signature lines: `sigSE` "SE / Analyst" with `seName` under it, and `sigClient` "Client Representative" with `clientName`.

### T1.AA Appendix A — "Appendix A — Glossary" (`appendixA`) (`:3398-3419`)

New page with a mid-blue bar. Table `glossTerm` "Term" | `glossDef` "Definition":

| Term | Key | Definition (en) |
|---|---|---|
| XDR | `gXDR` | "Extended Detection and Response — unified security platform correlating data across vectors." |
| SIEM | `gSIEM` | "Security Information and Event Management — centralized log and event correlation" |
| SOAR | `gSOAR` | "Security Orchestration, Automation and Response — incident response automation" |
| MITRE | `gMITRE` | "Knowledge framework of adversarial tactics and techniques based on real-world observations" |
| MTTD | `gMTTD` | "Mean Time to Detect — average time between occurrence and detection of an incident" |
| MTTR | `gMTTR` | "Mean Time to Respond — average time between detection and containment of an incident" |
| PoC | `gPoC` | "Proof of Concept — concept validation for technology assessment" |
| SE | `gSE` | "Sales Engineer / Solutions Engineer." |
| IOC | `gIOC` | "Indicator of Compromise." |
| TTP | `gTTP` | "Tactics, Techniques and Procedures — set of adversarial behaviors" |
| EDR | `gEDR` | "Endpoint Detection and Response." |
| NDR | `gNDR` | "Network Detection and Response." |

### T1.AB Appendix B — "Appendix B — Version Control" (`appendixB`) (`:3424-3434`)

Table `verVersion` "Version" | `verDate` "Date" | `verAuthor` "Author" | `verChanges` "Changes", with one row: `pocMeta.version||'1.0'`, `fmtDate(generatedAt)`, `seName||'—'`, `verInitial` "Initial release".

---

## 2. Template 2 — Executive

Template 2 uses the same data and derived values as Technical (§0.7). The differences are listed per section. All Template 2 strings live under `pdf.t2*`, alongside the shared keys.

### 2.0 Global differences

- **Visual style:**
  - Section titles: a blue number chip (only when the text starts with `N.`), 14 pt navy text and a blue rule (`t2SectionTitle`, `:738-760`).
  - KPI cards become light tiles with a colored top edge and a navy value (`t2KpiTile`, `:763-776`).
  - Charts sit in bordered cards with a title and an optional muted note (`t2Card`, `:779-797`).
  - Pies print each slice's % inside it (slices under 6% stay blank). Legend entries read `"{label}: {value} ({pct}%)"` (`:814-847`).
- **Section order** (`:3014`, `:3246`): Cover, 1, 2, 3, 4, 5, **8 (Risks)**, 6, 7, 9, 10, App. A, App. B.
- **Subtitle renumbering** (`t2Renumber`, `:158-161`, applied inside `subTitle`): a subtitle starting with `6.` becomes `7.`, `7.` becomes `8.`, and `8.` becomes `6.`.

| Original | Executive |
|---|---|
| 8.1, 8.2 | 6.1, 6.2 |
| 6.1, 6.2 | 7.1, 7.2 |
| 7.1, 7.2, 7.3, 7.4 | 8.1, 8.2, 8.3, 8.4 |

  Section titles themselves are not renumbered (the locale texts have no number). Intended executive numbering: 6 = Risks, Gaps & Recommendations; 7 = Operational Assessment; 8 = Measured Results.
- **Left out of Template 2:**
  - the architecture page;
  - the 10.1 scorecard table (the scorecard is on the dashboard);
  - the "<30 days" notices of 7.3/7.4 (`hideShortPeriod: T2`);
  - the Technical 4.1 case table;
  - the 1.1 KPI-card page;
  - the Technical timeline chart;
  - the Technical 5.2 navy/gray grid.
- Case status is translated only in Template 2, via `t2Status(status)` (`:1455-1458`): `t2StatusNames[status lower-cased with spaces, _ and - removed]`, or the raw status. en map: `{new:'New', open:'Open', inprogress:'In Progress', resolved:'Resolved', closed:'Closed', cancelled:'Cancelled', canceled:'Cancelled'}`.
- The header sub-text fallback is `' | Stellar Cyber ISOC Platform'`, but `headerSub` is defined, so the header is the same as in Technical.

Template-2 period helpers (computed only for Template 2, `:2170-2173`):
- `t2Period = t2Days(start, end)` (`:978-986`): UTC calendar days `YYYY-MM-DD` from start to end inclusive, **at most 62 days**. Day label `DD/MM` (`:987`).
- `t2Daily = { critical[], high[] }` (`:990-993`): per day, the loaded cases of that severity whose `createdAt` starts with the day (`createdAt` = ISO of `start_timestamp ?? created_at`). Medium and Low are left out on purpose.
- `t2AssetLic = assetCompliance(assets)`.
- `t2VolLic = vol ? volumeCompliance(dailyVolume) : null`.

### E.0 Cover (`drawCover2`, `:996-1092`)

A deep-navy band across the top 166 mm, with a fixed pseudo-random network texture (seed 7, 44 nodes, links under 38 mm; decorative only). Contents:
- `STELLAR CYBER  |  ISOC Platform`; pill `coverConfidential`.
- Eyebrow: `coverReportType` in uppercase with letter spacing ("PROOF OF CONCEPT REPORT").
- Title: `t2CoverTitle1` "Stellar Cyber ISOC" / `coverTitle2` "Platform".
- If `clientName` is set: the line `[clientName, clientDept].filter(Boolean).join('  ·  ')`.
- The same four info blocks and footer line as the Technical cover (§T1.0).

### E.1 Section 1 — "Executive Summary" (`sec1`) (`:2185-2317`, dashboard `:1095-1184`)

Page order: section title → **1.2 Context and Objectives** (identical to T1.1.2) → the **1.1 Key Performance Indicators** dashboard → the 1.1 KPI table (identical to T1.1.1a).

#### E.1.1 "1.1 Key Performance Indicators" dashboard (`sub1_1`)

**6 KPI tiles** (`:2206-2213`):

| Value | Label | Color |
|---|---|---|
| `totalCasesStr` | `kpiCasesDetected` "Detected Cases" | navy |
| `fmtNum(critCases.length)` | `sevCritical` "Critical" | red |
| `fmtNum(highCases.length)` | `sevHigh` "High" | orange |
| `"{mitreCovPct}%"` | `"{kpiMitreCov} ({detected}/14)"` = "MITRE ATT&CK Coverage (n/14)" | blue |
| `avgEntities \|\| '—'` | `kpiAvgEntities` "Avg. Monitored Assets/Day" | midBlue |
| `totalIngestStr` | `metTotalIngested` "Total Data Ingested" | cyan |

**Row 1** (100 mm high):
- Card `t2ChartPerDay` "Cases per day (critical and high)" (57% width):
  - Stacked bar. x = `t2Period` labels `DD/MM` (at most 16 ticks, auto-skip).
  - Series `sevCritical` (red, `t2Daily.critical`) and `sevHigh` (orange, `t2Daily.high`); legend on top; y from 0, integers.
  - Empty card when there are no days.
- Card `t2ChartSevPie` "Cases by severity":
  - Pie. Labels Critical/High/Medium/Low; data `[crit, high, mediumTotal, lowNum]`; red/orange/yellow/green; legend at the bottom.
  - Empty when every value is 0.

**Row 2** (72 mm high, three cards):

1. **`chartMitre` "MITRE Coverage"**: a 270° gauge of `mitreCovPct` (blue). Centre text `"{mitreCovPct}%"` and `"{detected} / 14 {sc_tactics}"` ("tactics").

2. **`t2ChartScore` "PoC scorecard"**: 4 rows. Each row has its label (`trunc 34`), the right-hand text `"{rating} · {pct}%"`, and a progress bar. Color and rating:
   - `pct ≥ 70` → green, `ratingHigh` "High";
   - `≥ 35` → orange, `ratingMed` "Medium";
   - otherwise red, `ratingLow` "Low".

   Rows (`:2219-2224`):

| Row | Value |
|---|---|
| `sc10_1` "Detection Capability" | `round(mean(score))` over loaded cases with a numeric `score > 0`; 0 if none |
| `sc10_2` "Investigation Efficiency" | `invEff.pct` (§7.2) |
| `sc10_4` "Integration Coverage" | `connectors.length ? round(active/total*100) : 0` |
| `sc10_6` "MITRE Coverage" | `mitreCovPct` |

   Legend below: `t2ScoreLegendHigh` "High: 70% or more", `t2ScoreLegendMed` "Medium: 35% to 69%", `t2ScoreLegendLow` "Low: below 35%".

3. **`t2Findings` "Key findings"**: a bullet list that stops when the card is full. Bullets in this order, each only when its condition holds (`:2187-2203`):

| # | Condition | Text |
|---|---|---|
| 1 | Peak day: `peakIdx` = the day with the largest `critical+high` (first maximum wins; starts at 0). Shown if `t2Period` is not empty and that sum is above 0. | `t2FindPeak` "Peak of {n} critical and high cases on {d}." (`n` = fmtNum(sum), `d` = fmtDate(day string)) |
| 2 | Top tactic: first entry of `caseTactics.mitre.tactics` sorted by `alertCount desc` | `t2FindTactic` "Tactic with the most alerts: {t} ({a} alerts in {c} cases)." (name, fmtNum alertCount, fmtNum caseCount) |
| 3 | Top sensor: the `ingestionBySensor` entry with the largest `bytesIngested`. Shown if total sensor bytes > 0. | `t2FindSource` "Sensor with the most ingestion: {s}, {p}% of the sensor volume." (`p = round(top/total*100)`, `s = name\|\|'—'`) |
| 4 | `t2AssetLic.recommended != null` | `t2FindLicense` "Recommended asset license: {l}." (`fmtLoc`) |
| 5 | `t2VolLic?.recommended != null` | `t2FindVolume` "Recommended volume license: {l} per day." (`fmtVol`) |

### E.2 Section 2 — "Scope and Methodology" (`sec2`)

- 2.1 table: identical to T1.2.1.
- 2.3 Success Criteria: identical to T1.2.3 (drawn before 2.2).
- **2.2 Methodology Phases**, drawn as a process flow (`t2MethodologyFlow`, `:1189-1223`):
  - One chevron per phase row (the same 5 rows as T1.2.2), colored from navy to cyan.
  - Chevron text: `"{t2PhaseLabel uppercased} {n}"` ("PHASE 1"), plus the phase name with its leading `"N — "` removed (regex `/^\s*\d+\s*[—–-]\s*/`).
  - The description sits under each chevron. It shows sequence only, no dates.
- No architecture page.

### E.3 Section 3 — "Platform Technical Overview" (`sec3`) (`:2600-2690`, charts `:1226-1262`)

**3.1** shows the same 4 values as T1.3.1, as tiles, followed by these charts.

The `gb()` formatter: MB with 2 decimals when `0 < v < 0.01`, otherwise GB with 2 decimals.

First row (two cards, 62 mm):
- `t2ChartOrigin` "Ingestion by origin", note `t2OriginNote` "GB ingested in the period by sensors and by connectors, before enrichment and compression; % of the total.":
  - Doughnut (cutout 58%) of `[t2Sensors "Sensors" = Σ sensor bytes/1024³, t2Connectors "Connectors" = Σ connector bytes/1024³]`, blue/cyan.
  - Legend values use `gb()`. Hidden when the sum is 0.
- `t2ChartConnCat` "Connectors by category", note `t2ConnCatNote` "Number of configured connectors in each category; % of the total.":
  - Pie of `connByCategory`, sorted by count descending, `T2_PALETTE`. Hidden when there are none.

If `ingestionBySensor` is not empty, a full-width card `t2ChartSensorGB` "GB ingested per sensor", note `t2SensorGBNote` "Data each sensor sent in the period (GB, before enrichment and compression).":
- Horizontal bar of the **top 10** sensors by bytes descending. Label `trunc(name, 28)`; value in GB.
- The value is printed after each bar (`gb()`); axis title "GB".
- Color navy if `type` contains `modular` (case-insensitive), otherwise blue.
- Card height `min(78, 26 + 6·n)` mm.

Second row (two cards):
- `t2ChartSensorType` "Sensors by type", note `t2SensorTypeNote` "Number of sensors of each type; % of the total.":
  - Pie of `dataSensors` counted by `type` (missing → `—`), sorted descending, legend at the bottom. Hidden when there are none.
- `t2ChartConnStatus` "Connectors by status", note `t2ConnStatusNote` "Number of connectors in each status reported by the API; % of the total.":
  - Doughnut of connectors counted by `status || (active ? 'active':'inactive')` (in practice `online`/`offline`), sorted descending.
  - Green if the status is one of online, active, connected; otherwise red.

**3.2**: the same table as T1.3.2 but with **only the Name, Type and Ingested columns** (`connCols = [0,1,4]`, `:2649`).

**3.3**: identical to T1.3.3.

### E.4 Section 4 — "Detection and Response Results" (`sec4`) (`:2695-2841`)

If `cases.length === 0`, only the `noCases` note is shown (no story).

Order:
1. **4.1 The detection story**
2. 4.2 Detection Metrics (the same table as T1.4.2)
3. Top Detection Types chart (identical to T1.4.x)
4. The Executive detection charts

There is no timeline chart and no case table.

#### E.4.1 "4.1 The detection story" (`t2Sub4_1`) — all logic is in §3

- Intro paragraph `t2StoryIntro`: "This section answers, in five questions, what the platform found in the period and what it means for the operation. Each question comes with a one-sentence answer and, below it, the chart that supports it. Every number comes from the Stellar Cyber API for the PoC period."
- Then up to five question blocks (`t2BuildStory`, `:2091-2161`). Each block contains:
  - the chip `t2StoryStep` "QUESTION {n} OF {t}" (`t` = the number of questions included; the questions are renumbered when some are left out);
  - the question (12 pt navy);
  - the answer sentence;
  - the visual;
  - a muted source note.
- A block is kept together with its visual. The `need` heights are: Q1 90, Q2 74, Q3 100, Q4 66, Q5 95 mm.
- Inclusion rules:
  - Q1 only if `caseStats` exists and `signalFunnel` is not null (alerts > 0 and cases > 0);
  - Q2 only if `topThreats` is not empty;
  - Q3 only if the matrix has at least one plotted point;
  - **Q4 always**;
  - Q5 only if `caseStats` exists and `caseStats.alerts` > 0.
- Capped suffix: when `caseStats.total > caseStats.cases`, the notes N1, N4 and N5 get `' ' + t2CapNote` "Statistics over the {n} most recent of {t} cases." (`n = fmtNum(cases)`, `t = fmtNum(total)`).

#### E.4.x Executive detection charts (`t2DetectionCharts`, `:1265-1337`)

1. **Trend** (only if `t2Period` is not empty): a full-width card `t2ChartTrend` "Daily case trend (critical and high)", note `t2TrendNote` "Medium and Low are not included: the report loads only the 100 most recent Medium cases and the Low total."
   - Multi-line chart (filled, tension 0.3).
   - Series Critical (red) and High (orange), from `t2Daily`.

2. **Heatmap**: card `t2ChartHeat` "When critical and high cases were created (weekday × hour, UTC)", note `t2HeatNote` "Each cell is one hour of one weekday (UTC). The number is how many critical and high cases were created in that hour over the period; the darker the cell, the more cases. Empty gray = no case."
   - Grid: 7 rows × 24 columns. Rows are weekdays labelled `t2Weekdays` ["Sun".."Sat"] in `getUTCDay()` order (Sun=0). Columns are UTC hours, labelled every 3 h.
   - Cell value = the number of loaded Critical+High cases whose `new Date(createdAt)` falls in that weekday and hour.
   - Fill: 0 → `[241,243,246]`. Otherwise a red tint with opacity `0.15 + 0.85·v/max`, where `max = max(1, all cells)`.
   - The count is printed in each non-zero cell, in white when `v/max > 0.5`.
   - Color-scale legend: `t2HeatScale` "Cases per hour:" with 5 swatches at `0, 25%, 50%, 75%, 100%`, labelled `0` and `max(1, round(t·max))`.

3. **Row of two cards** (68 mm):
   - **`t2ChartScoreHist` "Risk score distribution"**, note `t2ScoreHistNote` "Number of cases in each range of the risk score (0 to 100) …":
     - Vertical bars over the loaded cases with a numeric score.
     - 10 bins, `floor(score/10)` clamped to 0..9. Labels `"0–9" … "90–99"`; a score of 100 lands in bin 9, labelled "90–99".
     - Bin colors: 8 and above red, 6 and above orange, 4 and above yellow, otherwise green.
     - Values printed above the bars. x title `t2ScoreAxis` "Risk score"; y title `t2CasesAxis` "Cases".
   - **`t2ChartStatus` "Cases by status"**, note `t2StatusNote` "Number of cases of the period in each status, as returned by the API; % of the total.":
     - Doughnut (cutout 58%) of `caseStats.byStatus` (every case). Without caseStats: loaded cases counted by `status||'—'`.
     - Sorted descending; labels via `t2Status(...)`.
     - Colors from `statusColor` (orange for open/new, green for closed/resolved/analyzed). Any other status gets `T2_PALETTE[index % 8]`.

### E.5 Section 5 — "MITRE ATT&CK Coverage Analysis" (`sec5`) (`:2846-3012`, `:1854-1913`)

Order:
1. 5.2 cards (the same 3 values as Technical, as tiles)
2. **Tactic matrix**
3. **Radar + XDR donut**
4. 5.1 table (identical)
5. Top Techniques chart (identical)
6. 5.3 / 5.3.1 (identical)

**Tactic matrix** (`t2TacticMatrix`). It uses `mitre.tactics`, not `detectedTacticIds`.
- Italic note `t2MatrixNote` "Color scaled by alerts; gray = tactic without detection in the period".
- A 7×2 grid of `ALL_TACTICS`. For each tactic, `t` = its entry in `caseTactics.mitre.tactics` (by id); `max = max(1, all alertCount)`; `r = ln(1+alertCount)/ln(1+max)`.
- Background: no entry → empty gray; `r > 0.75` → navy; `r > 0.4` → blue; otherwise light blue. Text is white when `r > 0.4`.
- Each cell shows the id, the name (at most 2 lines), and `fmtNum(alertCount)` or `—`.
- Legend: `t2LegendNone` "no detection", `t2LegendLow` "few alerts", `t2LegendMid` "medium", `t2LegendHigh` "most alerts".

**Radar** card `t2ChartRadar` "Cases per tactic", note `t2RadarNote` "Each axis is a MITRE ATT&CK tactic; the farther the point from the center, the more cases had alerts of that tactic. The number in parentheses is the case count."
- 14 axes in `ALL_TACTICS` order; value `caseCount||0`.
- Axis label `"{short name} ({caseCount||0})"`, with these abbreviations: Command and Control → "C2", Resource Development → "Resource Dev.", Privilege Escalation → "Priv. Escalation".

**XDR donut** card `t2ChartXdr` "Stellar XDR proprietary detections (alerts per tactic)", note `t2XdrNote` "Alerts from the Stellar Cyber proprietary detections (beyond MITRE ATT&CK), per XDR tactic; value and % of the total."
- Doughnut (cutout 55%) of `stellarTacticData`, name → `alertCount`, `T2_PALETTE`, legend at the bottom.
- Shows `—` when empty.

### E.6 Section "Risks, Gaps and Recommendations" (`sec8`) — drawn after section 5, subtitles 6.1/6.2

- **6.1 Operational Recommendations** (`sub8_1`, renumbered):
  - If `opRecs` is not empty, first a half-width card `t2ChartRecPrio` "Recommendations by priority": a doughnut (cutout 55%) of the `opRecs` counts per priority, in the order critical (red, "Critical"), warning (orange, "Warning"), info (blue, "Info"). Zero counts are dropped.
  - Then the same table as T1.8.1.
  - If empty: the `noOpRecs` note.
- **6.2 MITRE ATT&CK Recommendations** (`sub8_2`, renumbered): identical to T1.8.2.

### E.7 Section "Operational Assessment" (`sec6`) — subtitles 7.1/7.2

The same content as T1.6.

### E.8 Section "ROI Analysis and Consolidation" (`sec7`) — subtitles 8.1–8.4

- 8.1 Real Metrics and 8.2 Qualitative Benefits: identical to T1.7.1 and T1.7.2.
- **8.3 License Compliance**: the same paragraph and the same empty/insufficient notes as T1.7.3. When a recommendation exists, a chart row comes **before** the compliance block (`t2LicenseCharts`, `:1916-1933`, 66 mm):
  - Card `t2ChartAssets` "Assets per day vs recommended license" (62% width):
    - Line chart (filled, blue) of `assets` sorted by date; labels `DD/MM`; values `entity_count`.
    - Series label `t2SeriesAssets` "Assets/day".
    - Two dashed reference lines: green `"{t2SeriesLicense} ({fmt(recommended)})"` = "Recommended license (n)" at `lic.recommended`, and red `"{t2SeriesLimit} ({fmt(limit)})"` = "110% limit (n)" at `lic.limit`.
  - Card `t2ChartScenarios` "Days above 110% per scenario":
    - Vertical bars for the average / recommended / peak scenarios.
    - Two-line x labels `[scenario label, fmt(license)]`; `daysAbove` printed above each bar; y suggested max = `stats.days`.
    - Color by level: none → green, warning → yellow, violation/ooc → red.

  Then the license compliance block **without** the `<30 days` notice.
- **8.4 Data Ingestion**: the same as T1.7.4. When a volume recommendation exists, the same chart row is drawn with these changes:
  - the card is `t2ChartVolume` "Daily volume (GB) vs recommended license";
  - the series is drawn as **bars** (cyan, red on days with `gb > limit`), values `round(gb*100)/100`;
  - series label `t2SeriesVolume` "GB/day", `fmt = fmtVol`.

  Then the block without the `<30 days` notice.

### E.9 Section 9 — "Next Steps"

Identical to T1.9 (subtitle "9.1 Recommended Actions").

### E.10 Section 10 — "Conclusion"

New page. **No 10.1 subtitle and no scorecard table.** The verdict banner, `body10`, SE Comments and Signatures are identical to T1.10.

### E.AA / E.AB Appendices

Identical to T1.AA and T1.AB.

---

## 3. `utils/caseStory.js` — the Executive 4.1 Detection Story

Pure functions. Their inputs are assembled in `t2BuildStory` (`pdfReport.js:2091-2161`).

### 3.0 Constants and helpers (`caseStory.js:9-60`)

- `EFFORT_DEFAULTS = { alertMin: 4, critHighMin: 120, mediumMin: 20, lowMin: 2, monthHours: 160 }` (`:11`).
- `SOC_TARGETS = { critOpen: 0, highOpen: 0, highOpenYellow: 2, handledPct: 90, ackMin: 30, closeHours: 24 }` (`:16`).
- `SCORE_CUT = 70` (`:19`).
- `isPending(status)` = NOT `/resolved|closed|cancel/i.test(status || 'New')`. New, Open, In Progress and so on are pending (`:22-23`).
- `sevOf(c)` = lower-case severity; `SEV_RANK = {critical:0, high:1, medium:2, low:3}` (`:25-26`).
- `median(values)` (`:28-33`): finite values only, sorted; true median (the mean of the two middle values when the count is even); null when empty.
- `leadMinutes(c)` (`:37-41`) = `(detectedAt − startedAt)/60000` when both are finite and the result is 0 or more, else null. That is `created_at − start_timestamp`.
- `effortPremises(meta)` (`:45-60`) maps `effortAlertMin→alertMin`, `effortCritHighMin→critHighMin`, `effortMediumMin→mediumMin`, `effortLowMin→lowMin`, `effortMonthHours→monthHours`. For each one:
  - empty or null → the default;
  - otherwise `Number(String(v).replace(',', '.'))`, accepted if finite and `≥ 0` (for `monthHours`, `≥ 1`); otherwise the default.
  - `custom` = true when any value differs from its default.
- The `critHigh` passed everywhere is `[...critCases, ...highCases]`: all loaded Critical, then High.

### 3.1 Q1 — Signal funnel: "Did the platform separate what matters from the noise?" (`t2Q1`)

Builder `signalFunnel({ volumeGB: vol ? vol.total : null, alerts: caseStats.alerts, cases: caseStats.cases, critHigh })` (`caseStory.js:66-83`). It runs only when `caseStats` exists, and returns null (question left out) when `!alerts || !cases`.

**Computation:**
- `pendingCH` = critHigh cases that are pending; `critHighAlerts = Σ critHigh.alertCount`.
- Output fields:
  - `volumeGB` (finite, else null), `alerts`, `cases`;
  - `critHigh = critHigh.length`, `pending`, `pendingCritical`, `pendingHigh`;
  - `alertsPerCase = alerts/cases`;
  - `critHighAlertShare = min(1, critHighAlerts/alerts)`;
  - `critHighShare = critHigh.length/cases`.

**Answer:**
- If `pending > 0`: `t2A1` "{a} alerts were grouped into {c} cases ({r} per case). Only {ch} cases ({p}%) were Critical or High, and {n} are still pending."
- Otherwise: `t2A1Done` "… and all of them were resolved."
- Variables: `a=fmtNum(alerts)`, `c=fmtNum(cases)`, `r=fmtDec(alertsPerCase)`, `ch=fmtNum(critHigh)`, `p=fmtDec(critHighShare*100)`, `n=fmtNum(pending)`.

**Visual** (`t2Funnel`, `pdfReport.js:1399-1452`): trapezoid stages. Widths are illustrative: 116 mm at the top, shrinking linearly to 30%.

| Stage | Value | Label | Sub-line |
|---|---|---|---|
| 1 (only if `volumeGB != null`) | `fmtVol(volumeGB)` | `t2FunVolume` "Data analyzed" | `t2FunVolumeSub` "daily volume summed over the period" |
| 2 | `fmtNum(alerts)` | `t2FunAlerts` "Correlated alerts" | `t2FunAlertsSub` "grouped into cases automatically" |
| 3 | `fmtNum(cases)` | `t2FunCases` "Cases created" | `t2FunCasesSub` "{r} alerts per case on average" |
| 4 | `fmtNum(critHigh)` | `t2FunCritHigh` "Critical + High" | `t2FunCritHighSub` "{p}% of the cases; need immediate action" |
| 5 | `fmtNum(pending)` | `t2FunPending` "Still pending" | `t2FunPendingSub` "{c} Critical · {h} High not resolved" (pendingCritical, pendingHigh), or `t2FunPendingNone` "all resolved" when 0. The stage is red when pending > 0, else green. |

Then 3 tiles:

| Value | Text |
|---|---|
| `"{fmtDec(critHighAlertShare*100)}%"` | `t2FunTileShare` "of the alerts are in the {n} Critical/High cases" |
| `"{fmtDec(alertsPerCase)} : 1"` | `t2FunTileRatio` "alerts per case: what the team no longer triages one by one" |
| `fmtNum(pending)` (red if > 0) | `t2FunTilePending` "Critical/High cases pending at the end of the period" |

**Note** `t2N1`: "Source: daily licensing volume (/storage-usages) and every case of the period (/cases; alerts = sum of the case size). Stage widths are illustrative, not to scale." + the capped suffix.

### 3.2 Q2 — Top threats: "What was found that needs attention?" (`t2Q2`)

Builder `topThreats(critHigh, caseTactics?.byCase || {}, n = 5)` (`caseStory.js:87-128`).

**Computation:**
1. `threatName(c)` = `String(name || id || '—')` with a trailing `/\s+and\s+\d+\s+other(s|\(s\))?$/i` removed, then trimmed.
2. Sort critHigh by severity rank ascending (critical first), then `score` descending (null counts as −1), then `alertCount` descending.
3. Group by `threatName.toLowerCase()`. The first case of each group (after the sort) is the `lead`. Groups keep their first-appearance order; take the first **5**.
4. Fields per group:
   - `rank` (1..5), `id`, `name`;
   - `similar = groupSize − 1`, `groupAlerts`, `groupPending` (computed but not drawn);
   - `severity`, `critical`, `score` (number or null), `alerts = lead.alertCount`;
   - `status||'New'`, `pending`, `detectedAt` (created_at in ms), `leadMin = leadMinutes(lead)`;
   - `tactics` = the first 3 names of `byCase[id].tactics`;
   - `xdr` = the first 2 names of `byCase[id].xdr`;
   - `techniques` = the first 3 names of `byCase[id].techniques` (sorted by per-case alert count, descending).

**Answer** `t2A2`: "{c} Critical and {h} High cases in the period. The most severe: {name} ({a} alerts, status {st})."
- `c`, `h` = the loaded counts; `name = trunc(top[0].name, 70)`; `a = fmtNum(top[0].alerts)`; `st = t2Status(top[0].status)`.

**Visual** (`t2ThreatCards`, `pdfReport.js:1475-1555`): a headline card for #1 (dark), plus up to 4 small cards in a 2×2 grid. Each card has a left stripe, red for Critical and orange for High.

The status pill shows `t2Status`. Its color is green if the case is not pending, red if the status matches `/new|open/i`, otherwise orange.

The headline card shows, in order:
- `"#1  {CRITICAL|HIGH}[ · SCORE {score}]"` and the status pill;
- the name (at most 3 lines);
- a tactic line: `"MITRE: a · b · c"`, or `"XDR: a · b"` when there are no MITRE tactics;
- `"{t2Techniques}: t1, t2, t3"` ("Techniques");
- a big `fmtNum(alerts)` with `t2CardAlertsBig` "alerts correlated in this single case";
- facts joined by ` · `:
  - `t2CardCreated` "Case created {d}" (`fmtDayTimeUTC(detectedAt)`);
  - `t2CardSimilar` "+{n} similar cases", if similar > 0;
  - `t2CardLead` "first alert to case: {t}" (`fmtDur(leadMin)`), if leadMin is not null.

Each small card shows:
- `"#{rank}  {SEV}[ · SCORE n]"` and the status pill;
- the name and the tactic line;
- "+{n} similar cases" when similar > 0;
- `"{t2CardAlerts '{n} alerts'} · {fmtDayTimeUTC(detectedAt)}"`.

**Note** `t2N2`: "One card per threat (case name); cases with the same name are counted as similar. Order: severity, risk score, alerts. Tactics and techniques come from the alerts of each case (up to 500 per case). {rest} more Critical/High cases, {m} Medium and {l} Low in the period; the full list is in the Technical report."
- `rest = critHigh.length − Σ(1 + similar)` over the 5 cards; `m = fmtNum(mediumTotal)`; `l = fmtNum(lowCount)`.

### 3.3 Q3 — Priority matrix: "Where should the team act first?" (`t2Q3`)

Builder `priorityMatrix(cases, { ranks })` (`caseStory.js:134-148`). It runs over **all loaded cases** (Critical, High, Medium top 100), with `ranks = {topThreat.id: rank}`. The question is left out when no point is plotted.

**Computation:**
- `plotted` = cases with a numeric score.
- `alertCut = max(2, round(median(plotted.map(alertCount||1))) || 2)`.
- Per point: `alerts = max(1, alertCount||1)`; `hiS = score ≥ 70`; `hiA = alerts ≥ alertCut`.
- Quadrant:
  - `act` = high score and many alerts;
  - `investigate` = high score, few alerts;
  - `monitor` = low score, many alerts;
  - `noise` = low score, few alerts.
- Output:
  - `points[{id, score, alerts, sev, q, rank}]`, `scoreCut=70`, `alertCut`;
  - `counts{act,investigate,monitor,noise}`;
  - `actCritHigh` (act points with severity critical/high);
  - `excluded = cases − plotted`;
  - `maxAlerts = max(1, …alerts)`.

**Answer** `t2A3`: "{n} cases are in the Act now quadrant (risk score {s} or more and {a} alerts or more); {ch} of them are Critical or High." (`n=counts.act`, `s=70`, `a=alertCut`, `ch=actCritHigh`).

**Visual** (`t2PriorityMatrix`, `pdfReport.js:1558-1648`), a scatter plot:
- **x axis**: score, linear, from `xMin = max(0, min(scoreCut−20, floor(minScore/10)*10))` to `xTop = max(100, ceil(maxScore/10)*10)`, plus 4 of padding. Ticks every 10.
- **y axis**: alerts, log10, with `dec = max(1, ceil(log10(maxAlerts·1.05)))` decades and gridlines at 10^e.
- Dashed cut lines at `x = 70` and `y = alertCut`.
- Quadrant backgrounds and labels with counts. A label is skipped when its quadrant is too small (w ≤ 8 or h ≤ 5 mm).
  - top-right `t2QuadAct` "ACT NOW · n" (light red);
  - bottom-right `t2QuadInvestigate` "INVESTIGATE · n" (light orange);
  - top-left `t2QuadMonitor` "MONITOR · n" (light blue);
  - bottom-left `t2QuadNoise` "CONTROLLED NOISE · n" (gray).
- Points are layered Medium (yellow, r 0.75) under High (orange, r 1.0) under Critical (red, r 1.3).
- Rank labels `#n` sit next to the points of the Q2 cards; points less than 3 mm apart share one label (e.g. "#1 #3").
- Axis titles: `t2AxisScore` "Case risk score", `t2AxisAlerts` "Alerts in the case".
- Legend: Critical, High, `t2LegendMedium100` "Medium (100 most recent)", `t2LegendRank` "#n = card of question 2".

**Note** `t2N3`: "Plotted: {n} cases with a score (Critical, High and the 100 most recent Medium). Alert cut = median of the plotted cases ({a}). Vertical axis in log scale."

### 3.4 Q4 — Response scorecard: "Is the operation under control?" (`t2Q4`) — always present

Builder `responseScorecard({ critHigh, caseStats, targets = SOC_TARGETS })` (`caseStory.js:152-183`).

**Computation:**
- `pend` = pending critHigh cases; `critOpen`, `highOpen` = pending Critical / High counts.
- `handledPct = caseStats?.cases ? handled/cases*100 : null`.
- `ack = caseStats?.medianAckMinutes ?? null`.
- `close = caseStats?.medianCloseHours ?? null`.
- `lead = median(critHigh.map(leadMinutes), non-null only)`.
- `upTo(v, t)`: null → `none`; `v ≤ t` → green; `v ≤ 2t` → yellow; otherwise red.

Tiles, in fixed order:

| key | value | target | lamp rule | extra |
|---|---|---|---|---|
| `critOpen` | critOpen | 0 | `≤ 0` green, else red | |
| `highOpen` | highOpen | 0 | `≤ 0` green; `≤ 2` yellow; else red | |
| `handled` | handledPct | 90 | null → none; `≥ 90` green; `≥ 100 − 2·(100−90) = 80` yellow; else red | `handled`, `cases` |
| `ack` | median ack minutes | 30 | `upTo(ack, 30)` | `n = caseStats.acknowledged ?? 0` |
| `close` | median close hours | 24 | `upTo(close, 24)` | `n = caseStats.closed ?? 0` |
| `lead` | median lead minutes | none | null → none; else `info` (blue, not rated) | `n` = critHigh cases with a lead |

- `rated` = tiles whose lamp is green, yellow or red; `inTarget` = the green count; `attention` = the keys of the rated tiles that are not green.

**Answer:**
- If `rated > 0` and `critOpen + highOpen > 0`: `t2A4` "{g} of {n} indicators are within target. {c} Critical and {h} High case(s) are still pending."
- If `rated > 0` and nothing is pending: `t2A4Clear` "{g} of {n} indicators are within target, and no Critical or High case is pending."
- If `rated = 0`: `t2A4None` "The API returned no response data for this period." In practice critOpen and highOpen are always rated, so `rated ≥ 2`.
- Variables: `g=inTarget`, `n=rated`.

**Visual** (`t2ResponsePanel`, `pdfReport.js:1651-1719`): 6 tiles in 2 rows of 3. Each tile has a lamp dot, a label, a value and a sub-line. Lamp colors: green `[0,176,80]`, yellow `[232,160,0]`, red, none gray `[190,196,205]`, info blue.

| Tile | Label | Value | Sub-line |
|---|---|---|---|
| `critOpen` | `t2RespCritOpen` "Critical cases pending" | `fmtNum` | `t2RespCritOpenT` "Target: 0" |
| `highOpen` | `t2RespHighOpen` "High cases pending" | `fmtNum` | `t2RespHighOpenT` "Target: 0 (yellow up to {y})" (`y=2`) |
| `handled` | `t2RespHandled` "Cases handled by the team" | `"{fmtDec(v,0)}%"` | `t2RespHandledT` "Target: {t}% or more · {h} of {c} cases" |
| `ack` | `t2RespAck` "Median time to acknowledge" | `fmtDur(v)` | `t2RespAckT` "Target: up to {t} min · median of {n} cases" |
| `close` | `t2RespClose` "Median time to resolve" | `fmtDur(v*60)` | `t2RespCloseT` "Target: up to {t} h · median of {n} cases" |
| `lead` | `t2RespLead` "First alert to case" | `fmtDur(v)` | `t2RespLeadT` "No target · median of {n} Critical/High cases" |

- A null value shows `—`. A tile whose lamp is `none` shows the sub-line `t2RespNoData` "No data returned by the API".
- Verdict bar (dark): one dot per rated tile, then the text `t2RespVerdict` "{g} of {n} indicators within target".
- Its second line is `t2RespAttention` "Needs attention: {l}." (labels joined by ", "), or `t2RespAllGood` "Every indicator is within target.", truncated at 130 chars.

**Note** `t2N4`: "Pending = status other than Resolved, Closed or Cancelled. Handled = status other than New. Times: median from case creation to acknowledgement / closing, over every case of the period. Targets: Critical pending 0 (red from 1); High pending 0 (yellow up to {y}); handled {hp}% (yellow from {hy}%); acknowledge in {am} min and resolve in {ch} h (yellow up to 2x)."
- `y=2, hp=90, hy=80, am=30, ch=24`, + the capped suffix.

### 3.5 Q5 — Effort avoided: "How much analyst effort does it save?" (`t2Q5`)

Builder `effortEstimate({ alerts: caseStats.alerts, critHigh: critHigh.length, medium: mediumTotal, low: lowNum }, effortPremises(pocMeta))` (`caseStory.js:195-213`). It runs only with `caseStats`, and returns null when `!alerts`.

**Computation:**
- `cases = critHigh + medium + low`. This is **loaded Crit/High + the Medium total + the Low total**, not `caseStats.cases`.
- `triageWithoutH = alerts·alertMin/60`.
- `triageWithH = cases·alertMin/60`.
- `invH = (critHigh·critHighMin + medium·mediumMin + low·lowMin)/60`.
- `savedH = max(0, triageWithoutH − triageWithH)`.
- `withoutH = triageWithoutH + invH`; `withH = triageWithH + invH`.
- `savedPct = triageWithoutH ? savedH/triageWithoutH : 0`.
- `savedFte = savedH/monthHours`; `withFte = withH/monthHours`.
- `focusPct = cases ? critHigh/cases : 0`.
- `premises = p`.

**Flags** `effortFlags({ cases: caseStats.cases, alerts: caseStats.alerts, top5Alerts: caseStats.top5Alerts||0 })` (`caseStory.js:218-225`):
- `SMALL_SAMPLE = 30`; `small = cases < 30`;
- `concentrated = alerts>0 && top5Alerts/alerts > 0.5`;
- `top5Pct`.

**Answer** `t2A5`: "{h} h less triage ({p}%) · {f}% of the cases need immediate action."
- `h = fmtNum(round(savedH))`, `p = fmtDec(savedPct*100, 0)`, `f = fmtDec(focusPct*100, 0)`.

**Visual** (`t2EffortBlock`, `pdfReport.js:1726-1833`). Hours are formatted `fmtNum(Math.round(v)) + ' h'`.
- Caption `t2EffScale` "Analyst hours in the period".
- Two horizontal stacked bars on one scale, `max = max(withoutH, 1)`:
  - **Row `t2EffWithoutShort` "Without correlation"**, sub `t2EffAlerts` "{n} alerts":
    - an investigation block (`invH`, color `[96,125,170]`, inner text `"{t2EffInv} {h} h"` when wider than 22 mm);
    - an alert-triage block (`triageWithoutH`, `[205,214,228]`, `"{t2EffTriage} {h} h"`);
    - the total `"{round} h"` on the right.
  - **Row `t2EffWithShort` "With Stellar Cyber"**, sub `t2EffCases` "{n} cases":
    - the investigation block;
    - a case-triage block (`triageWithH`, blue);
    - a dashed green outline for `savedH`, labelled `"{t2EffAvoided} {h} h"` ("avoided") when wider than 26 mm;
    - the total on the right.
- Legend: `t2EffLegInv` "Investigation", `t2EffLegTriAlerts` "Alert triage", `t2EffLegTriCases` "Case triage", `t2EffLegSaved` "Triage avoided" (dashed).
- 4 tiles:

| Value | Text | Color |
|---|---|---|
| `"-{round(savedH)} h"` | `t2EffKpiSaved` "of triage in the period" | green |
| `"{fmtDec(savedPct*100,0)}%"` | `t2EffKpiPct` "of the manual triage removed" | green |
| `"< 0.1"` when `0 < savedFte < 0.1`, else `fmtDec(savedFte)` | `t2EffKpiFte` "analyst-months freed" | navy |
| `"{round(withH)} h"` | `t2EffKpiWith` "with Stellar Cyber (investigation + case triage)" | blue |

**Note**, built in three parts and joined by spaces:
1. `t2N5Custom` if `premises.custom`, otherwise `t2N5`: "Estimate: real counts from the API; times are default premises — triage {a} min per alert or per case; investigation per case {ch} min Critical/High, {m} min Medium, {l} min Low (the same with and without correlation); {mh} h per analyst-month." The custom variant says "premises set by the SE". Variables are `fmtDec` of alertMin, critHighMin, mediumMin, lowMin and monthHours.
2. The notices:
   - if small: `t2EffFlagSmall` "Small sample ({n} cases): read these figures as an indication." (`n = caseStats.cases`);
   - if concentrated: `t2EffFlagConc` "The 5 largest cases hold {p}% of the alerts; most of the triage avoided comes from them." (`p = fmtDec(top5Pct*100, 0)`).
3. The capped suffix.

---

## 4. Note on ordering inside the story

Questions are added in the order Q1, Q2, Q3, Q4, Q5 and numbered by position (`pdfReport.js:1837-1849`). Without `caseStats`, the story has only Q2, Q3 and Q4, numbered "1 OF 3", "2 OF 3", "3 OF 3".

---

## 5. `utils/recommendations.js` — every rule

Signature: `generateRecommendations({ cases, connectors, sensors, tenants, assets, ingestionTimeline, mitreTechniques = [], locale = 'pt' })` (`recommendations.js:4-116`).

The report passes only `cases`, `connectors`, `ingestionTimeline`, `mitreTechniques` and `locale` (`Report.jsx:194-202`). Every time comparison uses **`Date.now()` at generation time**, not the PoC end date. Port decision: consider using the PoC end date instead.

Inputs as passed:
- `cases` = the loaded cases (Crit/High/Medium top 100).
- `connectors` = normalized connectors (`allConnectors = connectors ?? sensors ?? []`).
- `ingestionTimeline` = `deriveTimeline(connectors)` (`api.js:707-723`):
  - connectors that have `lastActivity || lastDataReceived`;
  - sorted by `lastActivity||lastDataReceived` descending, top 10;
  - each item is `{ id, source: name, timestamp: lastDataReceived || lastActivity, size: 0, status }`.
- `mitreTechniques` = `caseTactics.mitre.techniques`.

#### Rule 1 — `connector-coverage` (`:9-23`)
- Condition: `offline` = connectors with `!active && status==='offline'`; `pct = offline/total*100` (0 if there are no connectors). Fires when **`pct > 20`**.
- Priority: `pct > 50` → critical, otherwise warning.
- Category `Infrastructure`. Impact `min(100, pct·1.5)`.
- Texts `recOps.connectorCoverage`: title "Inactive Connectors Detected"; description "{offline} of {total} connectors ({pct}%) are inactive, reducing visibility coverage." (`pct` = `toFixed(0)`).

#### Rule 2 — `data-gap` (`:25-40`)
- Condition: `ingestionTimeline[0]` exists; `hrsAgo = (now − timestamp)/3.6e6`. Fires when **`hrsAgo > 2`**.
- Priority: `> 6` → critical, otherwise warning.
- Category `Data Pipeline`. Impact `min(100, hrsAgo·10)`.
- Texts `recOps.dataGap`: title "Potential Data Ingestion Gap"; description "Last data received {hours} hours ago. Gaps longer than 2 hours may indicate an ingestion pipeline issue." (`hours` = `toFixed(1)`).

#### Rule 3 — `case-backlog` (`:42-54`)
- Condition: `open` = cases whose status (lower-cased) is `new` or `open`. Fires when **`open > 50`**.
- Priority: `> 100` → critical, otherwise warning.
- Category `Operations`. Impact `min(100, open·0.8)`.
- Texts `recOps.caseBacklog`: title "High Case Backlog Detected"; description "{open} open cases detected. A backlog above 50 cases risks analyst fatigue and delayed response times."

#### Rule 4 — `stale-critical` (`:56-73`)
- Condition: Critical cases with a `createdAt` older than 24 h (`now − createdAt > 24 h`); status is ignored. Fires when **the count > 0**.
- Priority: critical.
- Category `Incident Response`. Impact 95.
- Texts `recOps.staleCritical`: title "{n} Critical Case(s) Open Over 24 Hours"; description "Unresolved critical cases older than 24 hours indicate a potential escalation risk and SLA breach."

#### Rule 5 — `stale-connectors` (`:75-93`)
- Condition: a connector is stale when its `lastDataReceived || lastActivity || lastSeen` is missing or older than **48 h**. Fires when there is at least one stale connector and at least one connector. `pct = (stale/total*100).toFixed(0)`.
- Priority: `pct > 30` → warning, otherwise info.
- Category `Data Coverage`. Impact `min(85, stale·2)`.
- Texts `recOps.staleConnectors`: title "{n} Connectors Without Recent Data"; description "{pct}% of connectors have not reported activity in the last 48 hours — possible visibility blind spot."

#### Rule 6 — `mitre-{techId}` (`:95-97`, `:123-151`)
- Condition: one recommendation per entry of `mitreTechniques`.
- Priority: `caseCount ≥ 5` → critical; `≥ 2` → warning; otherwise info.
- Category `MITRE ATT&CK`. Impact `min(90, caseCount·8 + min(alertCount, 10))`.
- Fields:
  - title `"{id}: {name||id}"`;
  - description = `getMitreById(id).mitigation[locale] || .pt`, or `attack.mitre.org/techniques/{id with the first '.' replaced by '/'}`;
  - steps `[mitigation?, "{caseCount} case(s) · {alertCount} alert(s)", refUrl]`;
  - `mitre: {technique, tactic:{id: tacticId, name: tacticName}, mitigation, caseCount, alertCount}`.

#### Rule 7 — `all-good` (`:99-110`)
- Condition: no recommendation so far (including MITRE ones) **and** `cases.length>0 || connectors>0 || ingestionTimeline.length>0`.
- Priority: info.
- Category `General`. Impact 5.
- Texts `recOps.allGood`: title "All Systems Nominal"; description "No critical recommendations at this time. Your security posture looks healthy."

**Common behaviour:**
- Every operational rule also has `steps` = `recOps.<rule>.steps` (an array; not shown in the PDF).
- Final sort (`:112-115`): `critical` (0) < `warning` (1) < `info` (2) < anything else (3). It is stable, so rules keep their order within a priority.
- Use in the PDF:
  - 8.1 lists rules 1–5 and 7 (category ≠ MITRE ATT&CK).
  - 8.2 does not use the rule 6 objects; it rebuilds its rows from `mitreTechniqueData`.
  - The Executive priority donut counts only `opRecs`.
  - Rule 6 only matters for the `detectedTactics` fallback (§0.7).

---

## 6. `utils/mitreMapping.js`

- **Static data; copy it as-is.** `const RULES = [ … ]` (`mitreMapping.js:10-180`) has 17 entries, each shaped like this:
  ```
  { patterns: RegExp[],                       // legacy free-text matching only
    technique: { id: 'T1046', name: '…' },
    tactic:    { id: 'TA0007', name: '…' },
    mitigation: { pt: '…', en: '…', es: '…' } }
  ```
- Technique ids covered: T1046, T1110, T1071, T1021, T1041, T1486, T1059.001, T1003, T1071.004, T1068, T1566, T1204, T1078, T1133, T1547, T1195, T1190.
- `RULES_BY_ID = Map(technique.id → rule)` (`:184`). **Exact id match only**: a sub-technique such as `T1110.003` does not fall back to `T1110`.
- `getMitreById(id)` returns the rule or null (`:190-193`).
- `getMitreMitigation(id, locale='pt')` returns `mitigation[locale] || mitigation.pt`, or null (`:200-204`). Section 8.2 uses it.
- `correlateMitre(text)` (`:211-225`) is legacy regex matching that the report does not use. The `patterns` field can be dropped in the port unless that feature is wanted.
- What to port: copy the `technique`, `tactic` and `mitigation` fields verbatim (they are JSON-friendly). Everything else is lookup code.

---

## 7. Verdict, scorecard and investigation efficiency

### 7.1 `utils/verdict.js`

- `VERDICTS = ['approved', 'conditional', 'rejected']` (`:9`).
- Label keys (`:11-15`): `approved→report.verdictApproved`, `conditional→report.verdictCond`, `rejected→report.verdictRejected`.
- `verdictCode(value)` (`:19-27`):
  - empty → `''`;
  - a known code → itself;
  - otherwise a case-insensitive, trimmed match against the three labels in **any** of pt/en/es `report.*` → the code;
  - no match → `''`.
- `verdictLabel(code, locale)` (`:35-37`) returns the label in that locale (falling back to pt), or `''` for an unknown code.
- Use in the PDF (`pdfReport.js:2078-2080`, banner `:3337-3346`):
  - `verdictKey = verdictCode(pocMeta.verdict)`.
  - `verdict = verdictKey ? verdictLabel(verdictKey, locale) : (pocMeta.verdict || '')`.
  - Color: `approved` green, `conditional` orange, **anything else red**. So an empty verdict shows a red "Pending" banner; consider a neutral color in the port.
  - The banner's second line = `verdict || verdictPending ("Pending")`.
- en labels: Approved / Approved with Conditions / Not Approved.

### 7.2 Scorecard — Technical 10.1 (`pdfReport.js:3276-3334`) and Executive dashboard (`:2219-2224`)

There are **no weights and no aggregate score**. Each row is rated on its own.

`scoreLabel(p)` (`:3276-3280`): `p ≥ 70` → `ratingHigh` "High"; `p ≥ 35` → `ratingMed` "Medium"; otherwise `ratingLow` "Low".

**Investigation efficiency `invEff`** (`:1993-2013`):
- If `caseStats` has `alerts` and `cases`:
  - `pct = clamp(0, 100, round((1 − cases/alerts)·100))`.
  - `note` = these parts joined by `' · '`:
    1. `sc_invAlerts` "{a} alerts correlated into {c} cases ({r}:1)", with `a=fmtNum(alerts)`, `c=fmtNum(cases)`, `r = alerts/cases` (at most 1 decimal);
    2. `sc_invHandled` "{n} handled by the team ({p}%)", with `n=fmtNum(handled)`, `p=round(handled/cases·100)`;
    3. only if `medianCloseHours != null`: `sc_invClose` "median of {t} to close", with `t = h < 1 ? round(h·60)+' min' : h (at most 1 decimal)+' h'`.
- Otherwise (fallback):
  - `pct = loaded cases ? round(resolved loaded cases / loaded cases·100) : 0`, where resolved = status not open/new.
  - `note = null`.

**Technical 10.1 table** (`Area | Score | Notes`):

| Area (key → en) | Score | Notes |
|---|---|---|
| `sc10_1` "Detection Capability" | `scoreLabel(avgScore)`, where `avgScore = round(mean(score))` over loaded cases with a numeric `score > 0` (0 if none) | `"{fmtNum(crit+high)} {sc_critHigh 'Crit+High cases'} \| Score: {avgScore}"` |
| `sc10_2` "Investigation Efficiency" | `scoreLabel(invEff.note ? invEff.pct : closedPct)`, where `closedPct = round(resolvedCases/cases·100)` over loaded cases | `invEff.note`, or `"{resolved} {sc_of 'of'} {loaded} {sc_closed 'cases resolved'} ({closedPct}%)"` |
| `sc10_3` "Response Automation" | `sc_yes` "Yes" if `hasNDR && hasEDR`, otherwise `sc_no` "No" | both → `sc_autoYes` "NDR and EDR integrated"; NDR only → `sc_autoNoEDR` "NDR implemented, EDR missing"; otherwise `sc_autoNoNDR` "Low response index, EDR missing" |
| `sc10_4` "Integration Coverage" | `scoreLabel(integPct)` | `integStr` |
| `sc10_6` "MITRE Coverage" | `scoreLabel(mitreCovPct)` | `"{detected} {sc_of} 14 {sc_tactics 'tactics'}"` |

- `hasNDR` (`:3300-3303`) = some data sensor whose `type` contains `modular` (case-insensitive) **and** whose `connectionStatus.toLowerCase() === 'connected'`.
- `hasEDR` (`:3304-3308`) = some connector whose lower-cased `name + ' ' + type + ' ' + category` contains any of `['edr','endpoint','crowdstrike','sentinelone','carbon black','defender','cybereason','cylance','sophos','cortex']`.

**Executive dashboard scorecard** (no table): Detection Capability (the same avgScore), Investigation Efficiency (`invEff.pct`; the fallback pct when there is no caseStats), Integration Coverage (integPct) and MITRE Coverage. Response Automation is not shown. Same 70/35 thresholds and colors.

---

## 8. `utils/assetCompliance.js` and `utils/volumeStats.js`

- Constants (`assetCompliance.js:14-20`): `LICENSE_TOLERANCE = 1.1`; `COMPLIANCE_LEVELS = [{warning,3},{violation,7},{ooc,21}]`.
- Series normalization (`:22-27`): drop items without a `date`, sort by date ascending, `date = slice(0,10)`, `count = Number(entity_count)||0`. Every returned day counts, including days with 0.
- `assetStats(series, {integer=true})` (`:30-41`) → `{days, zeroDays, min, avg, max}`. `avg` is rounded in integer mode. Null when there are no days.
- `sustainedLevel(series, n)` (`:46-58`):
  - For every window of `n` consecutive entries, `level = min(window)`.
  - Keep the highest level; on a tie keep the **latest** window (`>=`).
  - Returns `{level, from, to}`, or null when there are fewer than `n` days.
  - "Consecutive" means consecutive entries; gaps in the dates are not checked.
- `toleranceLimit(license, {integer})` (`:62-65`) = `license·1.1`; in integer mode `floor(license·1.1 + 1e-9)`.
- `simulateLicense(series, license, {integer})` (`:70-93`):
  - A day is exceeded when `count > limit`.
  - Tracks `daysAbove` and the longest run `{days, from, to}` (the first longest run wins).
  - `level` = the highest level with `longest.days ≥ level.days`, otherwise `'none'`.
  - `levels[]` carries `reached` flags.
- `assetCompliance(series, {integer})` (`:102-121`):
  - `stats`;
  - `recommended = sustainedLevel(series, 3)?.level ?? null`, plus `recommendedWindow`;
  - `limit = toleranceLimit(recommended)`;
  - scenarios (only when there are stats and a recommendation): `average` (license = `stats.avg`), `recommended`, `peak` (license = `stats.max`);
  - `result` = the recommended scenario.
- `volumeStats(days)` (`volumeStats.js:7-25`): `[{date, gb}]`, sorted, → `{days, zeroDays, from, to, total, avg = total/days, min, minDate, max, maxDate}` (the first minimum and first maximum in date order). Null when empty.
- `volumeCompliance(days)` (`volumeStats.js:29-32`) = `assetCompliance(days mapped to {date, entity_count: gb}, {integer:false})`. Neither avg nor limit is rounded.

---

## 9. Data requirements for the new Sync

The minimal set of fields to collect and store so every section above can render.
- Period boundaries: `FROM = pocStartDate 00:00:00.000 UTC` and `TO = pocEndDate 23:59:59.999 UTC`, in epoch ms (`api.js:15-16`).
- A tenant is always required.

### 9.1 `GET /connect/api/v1/cases` — per-severity case lists ("loaded cases")

- Params: `tenantid`, `severity`, `FROM~created_at`, `TO~created_at`, `sort=created_at`, `order=desc`, `limit`, `skip`.
- Response: `data.cases[]`, `data.total`.
- Split the time window when a window holds more than 1,000 cases (`casesInRange`, `api.js:24-52`; `PAGING.CASES_SAFE_SKIP`).

| Subset | How | Needed by |
|---|---|---|
| **Critical — all** (cap 5,000) | page up to `total` | everything case-based |
| **High — all** (cap 5,000) | page up to `total` | same |
| **Medium — the 100 most recent**, plus `total` (`mediumTotal`) | one page, `limit=100` | T1 4.1 table, Q3 matrix, histogram, detection types, average score, MTTD, alert paging |
| **Low — `total` only** (`lowCount`) | `limit=1` | counts only |

Fields to store per case: `_id`, `name`, `severity` (normalize it), `status`, `score`, `size` (fallbacks `assets_affected`, `alert_count`, `asset_count`), `start_timestamp`, `created_at`.

### 9.2 `GET /connect/api/v1/cases` — every case of the period (`caseStats`)

- All severities, cap 10,000, newest first. Store either these light per-case rows or the aggregates.
- Fields: `size`, `status`, `created_at`, `closed`, `acknowledged`. (`resolution` is collected but the PDF does not use it.)
- Also keep the API `total` from the first page (for the capped note).
- Aggregates to produce: `cases`, `total`, `alerts`, `byStatus`, `handled`, `closed`, `medianCloseHours`, `acknowledged`, `medianAckMinutes`, `top5Alerts` (§0.5).
- Needed by:
  - open/resolved counts (1.1, 4.2) and the status donuts;
  - 2.3 noise reduction;
  - Investigation Efficiency (10.1 / dashboard);
  - Executive Q1, Q4 (handled/ack/close) and Q5;
  - the capped note.

### 9.3 `GET /connect/api/v1/cases/{id}/alerts` — **per-case alert paging**

- **Case subset: every loaded case** = all Critical + all High + the 100 most recent Medium (no Low, no other Medium).
- Paging:
  - `limit=50` (the API maximum);
  - `skip = 0, 50, …` up to `min(case size, 500)` alerts per case (`PAGING.CASE_ALERTS_MAX`);
  - pages = `ceil(min(size||50, 500)/50)`;
  - retry a failed page once.
- Fields per alert (`_source`): `xdr_event.tactic.id`, `xdr_event.tactic.name`, `xdr_event.technique.id`, `xdr_event.technique.name`, `xdr_event.description`, `event_score`.
- Derived and stored (`caseTactics`):
  - `mitre.tactics[]`, `mitre.techniques[]`, `mitre.detectedTacticIds`, over all loaded cases (5.x, coverage %, 8.2, findings, radar, matrix);
  - `stellar.tactics[]`, `stellar.techniques[]` (5.3, XDR donut);
  - `byCase[caseId]`, **only needed for Critical + High** (Executive Q2 cards);
  - `topAlerts[caseId]` (at most 3 distinct descriptions, by max `event_score`), **only needed for Critical** (Technical 4.1 sub-rows).

### 9.4 `GET /connect/api/v1/entity_usages/daily_count/all`

- Params: `days=30` (the API accepts 1–31; the series ends yesterday), `cust_id`.
- Fields: `data[].date`, `data[].entity_count`. Keep only the days inside the period.
- Needed by: the 1.1 asset rows, the dashboard tile, 7.1, 7.3 (and its Executive chart), and the "Recommended asset license" finding.

### 9.5 `GET /connect/api/v1/connectors`

- Param: `cust_id`.
- Fields: `_id`, `name`, `active` (missing ⇒ true), `type`, `category`, `last_activity`, `last_data_received`.
- Needed by:
  - the KPI connector counts and the 1.2 text;
  - the sources donut / categories;
  - 2.3 integration, 3.1 and 3.2;
  - the Executive status and category charts;
  - recommendation rules 1, 2, 5 and 7;
  - the scorecard EDR detection.

### 9.6 `GET /connect/api/v1/ingestion-stats/sensor`

- Params: `cust_id`, `start_time = FROM`, `end_time = TO` (ms).
- Fields: `entry_identifier` (sensor UUID), `total_ingestion` (bytes; fallback names `total_bytes`, `bytes_ingested`, `bytes`).
- Must be joined with 9.8.
- Needed by: the 3.1 "Sensor Types" card (count), 3.3, the Executive origin pie, the GB-per-sensor bar, and the "Sensor with the most ingestion" finding.

### 9.7 `GET /connect/api/v1/ingestion-stats/connector`

- Same params as 9.6.
- Fields: `entry_identifier` (the connector **name**), `total_ingestion`.
- Needed by: the 3.2 "Ingested" column (joined by connector name), 3.3, and the Executive origin pie.

### 9.8 `GET /connect/api/v1/data_sensors`

- Param: `cust_id`.
- Fields: `sensor_id` / `internal_sensor_id`, `hostname`, `feature`, `mode`, `os`, `sw_version`, `connection_status`.
- Needed by: the sensor name/type/version in 3.3 and the charts, the Executive "Sensors by type" chart, and the scorecard NDR detection (Modular + connected).

### 9.9 `GET /connect/api/v1/storage-usages`

- Params: `aggr_type=tenant`, `cust_id`.
- Fields: `data[].time`, `data[].usages[].usage` (GB, summed per day).
- The API returns the last 31 complete UTC days. Drop today and keep only the days inside the period.
- Needed by:
  - "Total Data Ingested" / "Total Ingested" (3.1, 7.1, dashboard);
  - 7.4 and its Executive chart;
  - the Q1 funnel volume stage;
  - the "Recommended volume license" finding.

### 9.10 PoC metadata (user input, not API)

- All the fields in §0.6.
- `architectureImage` (+ Dims) is used only by Technical; the `effort*` fields only by Executive Q5.
- `version` and `seName` also feed Appendix B. `generatedAt` = the report generation time.

### 9.11 Not needed

- `/tenants` (only used to choose the tenant).
- `byResolution`.
- Connector `status.code` / `status.message`.
- `eventsCount` / `gbIngested` on the ingestion items.
- `deriveIngestionStats` (synthetic data, dashboard only).
- `ingestionTimeline` needs no extra call; it is derived from the connectors (9.5).