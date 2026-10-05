// One self-contained stylesheet for every Template. The page is shown in the browser and printed to
// A4 PDF by headless Chromium with network access disabled, so nothing may load from outside.
// Palette follows the previous tool's PDF: navy, blue, mid blue, cyan; severity red/orange/yellow/green.
export const REPORT_CSS = `
:root{--navy:#0b1f4d;--brand:#1f6feb;--mid:#3d5a99;--cyan:#00a3c4;--light:#9fc3ff;--slate:#5f6b7a;
--crit:#c00000;--high:#ff8200;--med:#c8a000;--low:#00b050;--ok:#00b050;
--ink:#1f2733;--muted:#5f6b7a;--line:#e6eaf0;--bg:#fff;--soft:#f5f7fb;--head:#eaf0f9}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#eef1f6;color:var(--ink);font:13.5px/1.6 Helvetica,"Helvetica Neue",Arial,"Liberation Sans",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.report{max-width:960px;margin:0 auto;background:var(--bg);padding:0 0 48px}
.report>section,.report>.grid,.report>.card{padding-left:28px;padding-right:28px}
h1{font-size:clamp(28px,5vw,44px);line-height:1.08;margin:.2em 0}
.body{margin:6px 0 10px;text-align:justify}.prose{white-space:pre-wrap}
.strong,b{font-weight:600}h1,h2,h3,h4{font-weight:600;letter-spacing:-.005em}.muted{color:#475263;font-size:12.5px}.italic{font-style:italic}.navy{color:var(--navy)}.brand{color:var(--brand)}
.ok{color:var(--ok)}.bad{color:var(--crit)}
.note{background:#eef4ff;border-left:3px solid var(--brand);padding:8px 12px;margin:8px 0;font-size:13px;border-radius:0 6px 6px 0}
.banner{font-size:14.5px;font-weight:600;color:var(--navy);padding:14px 18px;border-left-width:5px;margin:12px 0}
.warn{color:#b35c00}
.clamp1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}

/* Cover */
.cover{padding:36px 32px;min-height:560px;display:flex;flex-direction:column;gap:28px;position:relative}
.cover-tech{border-left:10px solid var(--navy);background:linear-gradient(180deg,#fff,#f6f8fc)}
.cover-exec{background:radial-gradient(circle at 80% 10%,#1d3a7a 0,#0b1f4d 55%) ;color:#f1f4fa}
.cover-exec .info-title,.cover-exec .cover-foot{color:#aab7d4}
.cover-top{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:700;letter-spacing:.14em;color:var(--navy)}.brand span{font-weight:400;letter-spacing:0;color:var(--muted)}
.cover-exec .brand{color:#fff}.cover-exec .brand span{color:#aab7d4}
.pill{border:1px solid currentColor;border-radius:999px;padding:2px 12px;font-size:11px;letter-spacing:.1em}
.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:12px;opacity:.85}
.cover-sub{font-size:20px;color:var(--brand)}.cover-client{font-size:18px;line-height:1.35;opacity:.9;max-width:60ch}.cover-dept{font-size:15px;opacity:.85;margin-top:4px}
.info-blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-top:auto}
.info-block{min-width:0;font-size:12.5px;line-height:1.45}.info-block>div{max-width:100%}
.info-title{font-size:11px;letter-spacing:.12em;color:var(--brand);font-weight:700;margin-bottom:4px}
.info-strong{font-weight:700}
.cover-foot{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
.cover-exec .cover-foot{border-color:#2c4682}

/* Sections */
.sec{padding-top:26px}
.sec-title{display:flex;align-items:center;gap:12px;margin:0 0 16px;font-size:18px;font-weight:600;color:#fff;background:linear-gradient(90deg,var(--navy),#23468f);padding:10px 16px;border-radius:8px}
.executive .sec-title{background:none;color:var(--navy);padding:0 0 8px;border-bottom:2px solid var(--brand);border-radius:0;font-size:21px}
.sec-num{background:var(--brand);color:#fff;border-radius:6px;min-width:30px;text-align:center;padding:1px 8px;font-size:16px}
.technical .sec-num{background:rgba(255,255,255,.18)}
.sub{font-size:15px;font-weight:600;color:var(--navy);margin:22px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line)}

/* Tables */
.table-wrap{overflow-x:auto;margin:8px 0 12px}
table.fixed{table-layout:fixed}table.fixed td{overflow-wrap:anywhere}
td .clamp2{line-height:1.35}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}
th{overflow-wrap:normal}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:var(--head);color:var(--navy);text-align:left;font-weight:600;padding:8px 10px;font-size:11.5px;letter-spacing:.02em;border-bottom:1px solid #d5deeb}
td{padding:7px 10px;border-bottom:1px solid #eef1f5;vertical-align:top}
tbody tr:nth-child(even) td{background:#fbfcfe}
table{border:1px solid var(--line);border-radius:8px;overflow:hidden}
table.compact td,table.compact th{padding:4px 7px;font-size:12px}
tr.sub-row td{padding-top:0;color:var(--muted);font-size:11.5px;background:#fff!important}
.top-alert{display:block;padding-left:10px}.top-alert.clamp2{display:-webkit-box}
.cell-note{display:block;font-size:11px;line-height:1.3;color:#475263;margin-top:2px}.cell-note.warn{color:#b35c00}.cell-note.clamp2{display:-webkit-box}
.sev{font-weight:700}.sev-critical{color:var(--crit)}.sev-high{color:var(--high)}.sev-medium{color:var(--med)}.sev-low{color:var(--low)}
.status-open{color:var(--high)}.status-done{color:var(--ok)}.status-other{color:var(--muted)}

/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:10px 0 14px}
/* Rows of equal tiles: 6 → 3×2, 7 → 4+3, 8 → 4×2. */
.kpis.n-2{grid-template-columns:repeat(2,1fr)}.kpis.n-3,.kpis.n-6{grid-template-columns:repeat(3,1fr)}.kpis.n-4,.kpis.n-7,.kpis.n-8{grid-template-columns:repeat(4,1fr)}.kpis.n-5{grid-template-columns:repeat(5,1fr)}.kpis.n-5 .kpi-value{font-size:19px}
.kpi{border-radius:10px;padding:13px 14px}
.kpis.solid .kpi{color:#fff}.kpis.solid .kpi-label{color:rgba(255,255,255,.85)}
.kpi-value{font-size:21px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.15}
.kpi-label{font-size:11.5px;margin-top:4px}
.kpis.solid .tone-navy{background:var(--navy)}.kpis.solid .tone-brand{background:var(--brand)}.kpis.solid .tone-mid{background:var(--mid)}.kpis.solid .tone-cyan{background:var(--cyan)}
.kpis.solid .tone-crit{background:var(--crit)}.kpis.solid .tone-high{background:var(--high)}.kpis.solid .tone-med{background:var(--med)}.kpis.solid .tone-ok{background:var(--ok)}.kpis.solid .tone-muted{background:#8a94a6}
.kpis.tiles .kpi{background:var(--soft);border-top:4px solid var(--navy);color:var(--navy)}.kpis.tiles .kpi-label{color:var(--muted)}
.kpis.tiles .tone-brand{border-color:var(--brand)}.kpis.tiles .tone-mid{border-color:var(--mid)}.kpis.tiles .tone-cyan{border-color:var(--cyan)}
.kpis.tiles .tone-crit{border-color:var(--crit)}.kpis.tiles .tone-high{border-color:var(--high)}.kpis.tiles .tone-ok{border-color:var(--ok)}.kpis.tiles .tone-muted{border-color:#b9c0cc}

/* Cards and grids */
.grid{display:grid;gap:14px;margin:12px 0}
.grid.cols-2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.grid.cols-57{grid-template-columns:57fr 43fr}.grid.cols-62{grid-template-columns:62fr 38fr}
.card{margin:0;border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#fff;min-width:0;break-inside:avoid;box-shadow:0 1px 2px rgba(11,31,77,.04)}
.card.wide{margin:12px 0}
.card-title{font-weight:600;color:var(--navy);font-size:13px;margin-bottom:8px}
.card-note{color:#475263;font-size:12px;margin:8px 0 0}

/* Charts */
.chart{margin:0}
.donut svg,.gauge svg{width:100%;max-width:230px;display:block;margin:0 auto}
.radar svg{width:100%;max-width:420px;display:block;margin:0 auto;overflow:visible}
.radar-label{font-size:11.5px;fill:#9aa3b2}.radar-label.on{fill:var(--ink)}.radar-value{font-weight:700}
.gauge-label{font-size:7px;fill:var(--muted)}
.stage-flow{list-style:none;padding:0;margin:4px 0 0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.stage-flow li{display:flex;flex-direction:column;gap:3px;min-width:0}
.stage-head{color:#fff;padding:6px 16px 6px 18px;clip-path:polygon(0 0,90% 0,100% 50%,90% 100%,0 100%,7% 50%);font-size:11px;line-height:1.25;min-height:42px;display:flex;align-items:center;gap:6px}
.stage-flow li:first-child .stage-head{clip-path:polygon(0 0,90% 0,100% 50%,90% 100%,0 100%);padding-left:10px}
.stage-head b{font-size:13px;opacity:.85}
.stage-value{font-size:20px;font-weight:600;color:var(--navy);font-variant-numeric:tabular-nums;margin-top:4px}
.stage-sub{font-size:11.5px;color:#475263}
.stage-track{height:6px;background:#eef1f5;border-radius:3px;overflow:hidden;margin-top:2px}.stage-track span{display:block;height:100%}
.stage-flow li.empty .stage-value{color:#9aa3b2}
.donut-center{font-size:16px;font-weight:600;fill:var(--navy)}.donut-sub{font-size:6.5px;fill:var(--muted)}
.slice-label{font-size:7px;fill:#fff;font-weight:700}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#475263;margin-top:6px;align-items:center}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.legend i.dashed{background:none!important;border-top:2px dashed;height:0;width:14px;border-radius:0}
.chart-svg{width:100%;height:auto;display:block;overflow:visible}
.chart-svg .grid{stroke:var(--line);stroke-width:1}.grid-area{fill:none;stroke:var(--line)}
.tick{font-size:11px;fill:var(--muted)}.tick.strong{fill:var(--ink);font-weight:600}
.halo{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.hbars{display:grid;gap:6px}
.hbar{display:grid;grid-template-columns:minmax(120px,38%) 1fr 64px;gap:8px;align-items:center;font-size:12px}
.hbar-label{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.25;overflow-wrap:anywhere}
.hbar-track{height:12px;background:#eef1f5;border-radius:6px;overflow:hidden}.hbar-fill{display:block;height:100%;border-radius:6px}
.hbar-value{text-align:right;font-variant-numeric:tabular-nums}
.hbars.stacked .hbar{grid-template-columns:1fr 48px;row-gap:2px}.hbars.stacked .hbar-label{grid-column:1/-1}
.heat-grid{display:grid;gap:2px;font-size:10px}
.heat-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:2px;font-size:9px}
.heat-h,.heat-d{color:var(--muted);font-size:10px;text-align:center}

/* Lists, flow, signatures */
.bullets{margin:6px 0 12px;padding-left:20px}.bullets li{margin:3px 0}
.findings{font-size:12.5px}
.flow{list-style:none;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.chevron{background:var(--navy);color:#fff;padding:8px 18px 8px 12px;clip-path:polygon(0 0,92% 0,100% 50%,92% 100%,0 100%,6% 50%);font-size:12px}
.flow li:nth-child(2) .chevron{background:var(--mid)}.flow li:nth-child(3) .chevron{background:var(--brand)}.flow li:nth-child(4) .chevron{background:#1b8fd6}.flow li:nth-child(5) .chevron{background:var(--cyan)}
.chevron b{display:block;font-size:10px;letter-spacing:.1em}.flow p{font-size:12px;color:var(--muted);margin:6px 2px}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px}
.signatures div{display:flex;flex-direction:column;gap:2px}.sig-line{border-top:1px solid var(--ink);margin-bottom:6px;height:34px}
.arch{max-width:100%;max-height:600px;display:block;margin:10px auto}

/* MITRE grid */
.tactic-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:10px 0}
.tactic{border-radius:6px;padding:8px;font-size:11px;min-height:70px;display:flex;flex-direction:column;gap:2px}
.tactic b{font-size:10.5px}.tactic small{margin-top:auto;font-weight:700}
.tactic.on{background:var(--navy);color:#fff}.tactic.off{background:#eef1f5;color:#9aa3b2}
.tactic.heat-none,i.heat-none{background:#eef1f5;color:#9aa3b2}.tactic.heat-low,i.heat-low{background:#cfe0ff;color:var(--navy)}
.tactic.heat-mid,i.heat-mid{background:var(--brand);color:#fff}.tactic.heat-high,i.heat-high{background:var(--navy);color:#fff}

/* Scorecard bars */
.score-row{margin:6px 0}.score-head{display:flex;justify-content:space-between;font-size:12px}
.score-track{height:9px;background:#eef1f5;border-radius:5px;overflow:hidden;margin-top:3px}.score-track span{display:block;height:100%}
.rating-high .score-track span{background:var(--ok)}.rating-medium .score-track span{background:var(--high)}.rating-low .score-track span{background:var(--crit)}

/* Detection story */
.story-q{border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0;break-inside:avoid}
.chip{display:inline-block;background:var(--brand);color:#fff;font-size:10px;letter-spacing:.12em;border-radius:999px;padding:2px 10px}
.story-q h4{font-size:17px;color:var(--navy);margin:8px 0 4px}.answer{margin:0 0 12px;font-size:14px}
.funnel{display:flex;flex-direction:column;align-items:center;gap:4px}
.stage{background:var(--navy);color:#fff;padding:7px 12px;border-radius:4px;text-align:center;min-width:180px}
.stage:nth-child(2){background:var(--mid)}.stage:nth-child(3){background:var(--brand)}.stage:nth-child(4){background:var(--cyan)}
.stage.bad{background:var(--crit)}.stage.good{background:var(--ok)}
.stage b{font-size:15px}.stage small{display:block;font-size:10.5px;opacity:.9}
.tiles3,.tiles4{display:grid;gap:10px;margin-top:12px}.tiles3{grid-template-columns:repeat(3,1fr)}.tiles4{grid-template-columns:repeat(4,1fr)}
.tiles3 div,.tiles4 div{background:var(--soft);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:2px;font-size:11.5px}
.tiles3 b,.tiles4 b{font-size:18px;color:var(--navy)}.tiles3 .bad b{color:var(--crit)}.tiles4 .good b{color:var(--ok)}.tiles4 .brand b{color:var(--brand)}
.threat{border-left:5px solid var(--high);background:var(--soft);border-radius:8px;padding:10px 12px;margin:6px 0}
.threat.sev-critical{border-color:var(--crit)}
.threat.headline{background:var(--navy);color:#fff}.threat.headline .threat-facts,.threat.headline .threat-tactics{color:#c8d3ea}
.threat-head{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.06em;font-weight:700}
.threat-name{font-weight:700;margin:4px 0}.threat-tactics,.threat-facts{font-size:11.5px;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 2px}.chip-ent{background:#e3eaf6;color:var(--navy);border-radius:4px;padding:1px 7px;font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.threat.headline .chip-ent{background:rgba(255,255,255,.16);color:#fff}
.threat-head .pill-status{margin-left:4px;white-space:nowrap}
.threat-big b{font-size:26px}.threat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pill-status{border-radius:999px;padding:1px 9px;font-size:10px}.pill-status.good{background:#d3f9d8;color:#1e7b34}.pill-status.bad{background:#ffe3e3;color:#c92a2a}.pill-status.warn{background:#fff3bf;color:#b35c00}
.resp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.resp-tile{background:var(--soft);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:3px}
.resp-tile b{font-size:19px;color:var(--navy)}.resp-tile small,.resp-label{font-size:11.5px;color:var(--muted)}
.lamp{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}
.lamp-green{background:#00b050}.lamp-yellow{background:#e8a000}.lamp-red{background:var(--crit)}.lamp-none{background:#bec4cd}.lamp-info{background:var(--brand)}
.resp-verdict{background:var(--navy);color:#fff;border-radius:8px;padding:10px 12px;margin-top:10px}.resp-verdict small{color:#c8d3ea}
.effort{display:grid;gap:8px}
.eff-row{display:grid;grid-template-columns:150px 1fr 70px;gap:10px;align-items:center}
.eff-label{font-weight:600;font-size:12.5px}.eff-label small{display:block;font-weight:400;color:var(--muted)}
.eff-bar{display:flex;height:22px;background:#f4f6fa;border-radius:4px;overflow:hidden}
.seg{height:100%}.seg.inv,i.inv{background:#607daa}.seg.tri-alerts,i.tri-alerts{background:#cdd6e4}.seg.tri-cases,i.tri-cases{background:var(--brand)}
.seg.saved{border:2px dashed var(--ok);background:transparent}i.saved{border:2px dashed var(--ok)}

/* Verdict */
.verdict-banner{border-radius:10px;padding:14px 18px;margin:16px 0;color:#fff;display:flex;flex-direction:column}
.verdict-banner span{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.9}.verdict-banner b{font-size:22px}
.verdict-approved{background:#00a04a}.verdict-conditional{background:#ff8200}.verdict-rejected{background:#c00000}.verdict-pending{background:#8a94a6}
.verdict-pill{display:inline-block;border-radius:999px;padding:4px 14px;color:#fff;font-weight:600}

/* Insight */
.insight .hero{padding:34px 28px 10px}.insight>.grid,.insight>.card{margin-left:28px;margin-right:28px;padding:12px 14px}
.insight>.grid{padding:0}

@media (max-width:720px){
  .report>section,.report>.grid,.report>.card{padding-left:16px;padding-right:16px}
  .grid.cols-57,.grid.cols-62,.grid.cols-3,.threat-grid,.resp-grid,.tiles3,.tiles4,.signatures{grid-template-columns:1fr}
  .tactic-grid{grid-template-columns:repeat(2,1fr)}
  .stage-flow{grid-template-columns:1fr}
  .eff-row{grid-template-columns:1fr;gap:4px}
  .kpis[class*=' n-']{grid-template-columns:repeat(2,1fr)}
  .flow{grid-template-columns:1fr}
  .cover{padding:24px 18px;min-height:0}
}
/* The bottom margin holds the PDF footer (client · Confidential · page X/Y) drawn by pdf.ts. */
@page{size:A4;margin:14mm 13mm 17mm}
@media print{
  body{background:#fff;font-size:10pt;line-height:1.55}
  table{border-radius:0}
  .report{max-width:none;padding:0}
  .report>section,.report>.grid,.report>.card{padding-left:0;padding-right:0}
  .page-break{break-before:page}
  /* The cover fills exactly one page whatever the length of the PoC's names. */
  .cover{break-after:page;min-height:0;height:264mm;overflow:hidden}
  .card,.story-q,tr,.kpi,.tactic,.threat{break-inside:avoid}
  .card,.kpi,.tactic{box-shadow:none!important}
  .card.breakable{break-inside:auto}
  /* A title never ends a page: it stays with the block it introduces. */
  .sec-title,.sub,.card-title,p.body.strong{break-after:avoid}
  .keep,.flow,.kpis,.score-bars,.legend,.resp-grid,.tiles3,.tiles4,.funnel,.killchain,.signatures,.verdict-banner{break-inside:avoid}
  .card-note,.muted,.legend{font-size:9pt}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`
