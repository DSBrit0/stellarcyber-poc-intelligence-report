# Report porting decisions

The Technical and Executive Templates keep the structure, sections, texts (pt-BR, en, es, carried over verbatim) and metrics of the previous tool, as described in [report-templates-spec.md](report-templates-spec.md). The table lists every place where the logic deliberately differs, and why. Each one is marked `FIX` in `apps/server/src/report/model/`.

| # | Previous behaviour | New behaviour | Why |
|---|---|---|---|
| 1 | MITRE coverage counted every `TA…` id seen, so it could exceed 100%. | Counts only the 14 Enterprise tactics. | A percentage of 14 tactics cannot pass 100%. |
| 2 | "Average score" in 4.2 counted a missing score as 0. The scorecard ignored missing and zero scores. | One definition everywhere: the mean of Cases with a numeric score above 0. | The same number appeared with two values in the same report. |
| 3 | MTTD used the upper middle value; every other median was a true median. | True median. | Consistency with the Q4 "first alert to case" median. |
| 4 | Recommendations measured ages from the moment the PDF was generated. | They are measured at the end of the PoC period, or at collection time if that was earlier. | Report Data is frozen; a Report regenerated later must say the same thing. Measured at render time, "last data 2,000 hours ago" would be wrong. |
| 5 | "Critical cases open over 24 h" counted Critical Cases of any status. | Counts only pending ones (not Resolved, Closed or Cancelled). | The rule's own text says "unresolved". |
| 6 | An empty verdict showed a red "Pending" banner. | A neutral gray banner. | Red reads as "Not Approved". |
| 7 | Section titles had no numbers; only subtitles did. | Titles carry their number, using the Executive numbering in the Executive Template. | This is the spec's recommendation, and the subtitles already assume it. |
| 8 | Page numbers skipped values, because every table advanced the counter. | Real page numbers from the PDF renderer. | It was a bug. |
| 9 | The "Sensor Types" card showed the number of sensors with ingestion. | It shows the number of distinct sensor types. | It now matches its label. |
| 10 | The status donut's centre text "open · N%" was hard-coded in English. | Translated. | i18n. |
| 11 | Alert pages that failed for any reason were dropped silently. | HTTP 403 pages are reported separately ("alerts not readable with this credential for N Cases"). | Validated on live tenants: the API answers 403 `security_exception` for Cases whose Alerts the key's role cannot read. |
| 12 | Ingestion from a removed sensor was labelled "Sensor N". | "Sensor <id prefix>", marked as removed. | Ingestion history outlives the sensor; validated on live tenants. |
