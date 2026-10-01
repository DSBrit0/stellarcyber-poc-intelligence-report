// One self-contained stylesheet for every Template: the HTML is shown in the browser and printed to
// PDF by headless Chromium with network access disabled, so nothing may load from outside.
export const REPORT_CSS = `
:root{--ink:#14161a;--muted:#5b6270;--line:#e3e6eb;--bg:#fff;--brand:#3b5bdb;--crit:#c92a2a;--high:#e8590c;--med:#f08c00;--low:#2f9e44;--ok:#2b8a3e}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.report{max-width:1040px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:clamp(28px,5vw,44px);line-height:1.1;margin:.2em 0}
h2{font-size:20px;margin:0 0 12px;display:flex;gap:10px;align-items:baseline}
h3{font-size:15px;margin:20px 0 8px;color:var(--muted)}
.num{color:var(--brand);font-variant-numeric:tabular-nums}
.muted{color:var(--muted)}
.prose{white-space:pre-wrap}
.section{padding:28px 0;border-top:1px solid var(--line)}
.cover{padding:48px 24px;border-radius:12px;margin-bottom:24px}
.cover-light{background:#f4f6fb}
.cover-dark{background:#0f1729;color:#f1f3f9}.cover-dark .cover-sub,.cover-dark dt{color:#aab3c5}
.cover-kicker,.hero-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.cover-dark .cover-kicker{color:#aab3c5}
.cover-meta{display:flex;flex-wrap:wrap;gap:24px;margin:24px 0 0}
.cover-meta dt{font-size:12px;color:var(--muted)}.cover-meta dd{margin:0;font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:12px 0}
.kpi{border:1px solid var(--line);border-radius:10px;padding:14px}
.kpi-value{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
.kpi-label{font-size:13px;color:var(--muted)}
.kpi.critical .kpi-value{color:var(--crit)}.kpi.high .kpi-value{color:var(--high)}.kpi.ok .kpi-value{color:var(--ok)}
.bars{display:grid;gap:8px}
.bar-row{display:grid;grid-template-columns:90px 1fr 70px;gap:10px;align-items:center}
.bar-track{height:12px;background:#f1f3f5;border-radius:6px;overflow:hidden}
.bar-fill{display:block;height:100%}
.sev-critical{background:var(--crit)}.sev-high{background:var(--high)}.sev-medium{background:var(--med)}.sev-low{background:var(--low)}
.bar-value{text-align:right;font-variant-numeric:tabular-nums}
.spark{width:100%;height:64px;color:var(--brand);display:block}
table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line)}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.table-wrap{overflow-x:auto}
.level-warning{color:var(--med);font-weight:600}.level-violation{color:var(--high);font-weight:600}.level-ooc{color:var(--crit);font-weight:700}
.verdict,.pill{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:600;text-transform:capitalize}
.verdict-approved{background:#d3f9d8;color:#2b8a3e}.verdict-conditional{background:#fff3bf;color:#e67700}.verdict-rejected{background:#ffe3e3;color:#c92a2a}
.insight .hero{padding:40px 0 24px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.card{border:1px solid var(--line);border-radius:14px;padding:20px;min-width:0}
.card.wide{margin-top:16px}
@media (max-width:560px){.bar-row{grid-template-columns:70px 1fr 50px}.cover{padding:32px 16px}}
@page{size:A4;margin:14mm}
@media print{
  body{font-size:11pt}
  .report{max-width:none;padding:0}
  .section,.card{break-inside:avoid}
  .cover{break-after:page;min-height:250mm;display:flex;flex-direction:column;justify-content:center}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`
