// One self-contained stylesheet for every Template. The page is shown in the browser and printed to
// A4 PDF by headless Chromium with network access disabled, so nothing may load from outside.
// Palette follows the previous tool's PDF: navy, blue, mid blue, cyan; severity red/orange/yellow/green.
export const REPORT_CSS = `
:root{--navy:#1f3863;--brand:#2e75b6;--mid:#3d5a99;--cyan:#00a3c4;--light:#9fc3ff;--slate:#5f6b7a;
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
.sec-num{background:var(--brand);color:#fff;border-radius:6px;min-width:30px;text-align:center;padding:1px 8px;font-size:16px}
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
.score-row{margin:6px 0}.score-head{display:flex;justify-content:space-between;gap:10px;font-size:12px}.score-head>span:last-child{white-space:nowrap}
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

/* ABNT (Executive and Technical): NBR 6024 headings, NBR 14724/IBGE captions, sources and tables. */
.report>.abnt-lists{padding-left:28px;padding-right:28px}
.abnt .sec-title{display:block;background:none;color:var(--navy);padding:0 0 6px;border-radius:0;border-bottom:2px solid var(--brand);font-size:19px;font-weight:700;text-transform:uppercase;letter-spacing:.01em;text-align:left}
.abnt .sec-num{background:none;color:inherit;border-radius:0;min-width:0;padding:0;font-size:inherit}
.abnt .sub{font-size:15px;font-weight:700;border-bottom:0;padding-bottom:0;text-align:left}
.abnt h4{font-weight:700;font-style:italic}
.caption{font-size:12.5px;line-height:1.3;color:var(--ink);margin:0 0 6px;text-align:left}
.caption b{font-weight:700}
.source{font-size:11.5px;line-height:1.3;color:#475263;margin:6px 0 0}
.fig{margin:12px 0}
.abnt table{border:0;border-radius:0;border-top:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink)}
.abnt th{background:none;color:var(--ink);border-bottom:1px solid var(--ink);letter-spacing:0}
.abnt td{border-bottom:0}
.abnt tbody tr:nth-child(even) td,.abnt tr.sub-row td{background:none!important}
.abnt-list{padding-top:26px}
.list-title{text-align:center;text-transform:uppercase;font-size:17px;font-weight:700;color:var(--navy);margin:0 0 18px}
.list-head{display:flex;justify-content:flex-end;font-size:11.5px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:3px;margin-bottom:6px}
.list-items{list-style:none;padding:0;margin:0}
.list-items li{display:flex;align-items:baseline;gap:6px;line-height:1.5;margin:2px 0}
.list-entry{flex:0 1 auto;min-width:0}
.list-dots{flex:1 1 24px;border-bottom:1px dotted #9aa3b2;transform:translateY(-4px)}
.list-where{flex:none;font-variant-numeric:tabular-nums;max-width:40%;text-align:right}

@media (max-width:720px){
  .report>section,.report>.grid,.report>.card,.report>.abnt-lists{padding-left:16px;padding-right:16px}
  .grid.cols-57,.grid.cols-62,.grid.cols-3,.threat-grid,.resp-grid,.tiles3,.tiles4,.signatures{grid-template-columns:1fr}
  .tactic-grid{grid-template-columns:repeat(2,1fr)}
  .stage-flow{grid-template-columns:1fr}
  .eff-row{grid-template-columns:1fr;gap:4px}
  .kpis[class*=' n-']{grid-template-columns:repeat(2,1fr)}
  .flow{grid-template-columns:1fr}
  .cover{padding:24px 18px;min-height:0}
}
/* Page margins, numbers and footers: see pageCss. */
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

  .report.insight{page:insight}
}
/* Priority matrix (600 units = 182 mm): 5.8 pt ticks, bold 6.8 pt quadrant names, bold navy 6.5 pt axis titles. */
.matrix .tick{font-size:6.8px;fill:#787878}.matrix .tick.strong{font-size:7px;fill:#1f3864}
.matrix .quad-label{font-size:7.9px;font-weight:700}.matrix .axis-title{font-size:7.6px;font-weight:700;fill:#1f3864}
.matrix .grid{stroke:#d7dee8;stroke-width:.5}
/* Executive (the previous tool's Template 2) and Technical (Template 1): the jsPDF Report, measured from its
   code. Print sizes are the original mm and pt; X = both Templates, T1 = Technical, T2 = Executive. */
.report:is(.executive,.technical){--navy:#1f3864;--brand:#0070c0;--mid:#2e75b6;--cyan:#00b4d8;--light:#9cc9ec;--slate:#5b6a82;
--ink:#1e1e1e;--muted:#787878;--line:#dce3ec;--soft:#f3f6fa;--row:#ebf3fb;--deep:#14233f;--gray:#f2f2f2;--grid:#c8c8c8}
.cover-texture{display:none}
@media print{
  .report:is(.executive,.technical){page:report;font-size:8.5pt;line-height:4.5mm;color:var(--ink)}

  /* Cover (no page bars, not counted): every element at the original's position, in mm from the top left. */
  .report:is(.executive,.technical) .cover{page:cover;position:relative;display:block;height:297mm;padding:0;min-height:0;overflow:hidden;background:#fff;color:var(--ink);border:0}
  .cover>*{position:absolute}
  .cover .cover-hero{position:static}
  .cover .cover-hero>*{position:absolute;margin:0}
  .cover h1{font:700 38pt/16mm Helvetica,Arial,sans-serif;color:var(--navy);letter-spacing:0}
  .cover-top{display:flex;justify-content:space-between;align-items:center;height:6mm}
  .cover .brand{font:700 12pt Helvetica,Arial,sans-serif;letter-spacing:0;color:var(--navy);white-space:pre}
  .cover .brand span{font-weight:400;color:var(--brand)}
  .cover .pill{display:flex;align-items:center;height:6mm;padding:0 3mm;border:.5mm solid var(--brand);border-radius:1.5mm;font:700 7pt Helvetica,Arial,sans-serif;letter-spacing:0;color:var(--brand)}
  .info-blocks{display:grid;gap:0;margin:0}
  .info-blocks::after{content:"";position:absolute;top:-.5mm;bottom:0;width:0;border-left:.25mm solid var(--gray)}
  .info-block{min-width:0;font:8pt/5.8mm Helvetica,Arial,sans-serif;color:var(--muted)}
  .info-block:nth-child(n+3){border-top:.25mm solid var(--gray)}
  .info-title{font:700 7pt/1 Helvetica,Arial,sans-serif;letter-spacing:0;color:var(--brand);border-bottom:.3mm solid currentColor;padding:0 0 1.2mm;margin:0 0 3.4mm}
  .info-block:nth-child(even) .info-title{color:var(--navy)}
  .info-strong{font:700 10pt/6.8mm Helvetica,Arial,sans-serif;color:var(--navy)}
  .cover-foot{font:7.5pt/1 Helvetica,Arial,sans-serif;color:var(--muted);border:0;padding:0;top:280.6mm;white-space:nowrap}
  .cover-foot b{font-weight:700;color:var(--navy)}
  .cover-foot i{font-style:normal;white-space:pre}
  .cover-foot i::before{content:" "}.cover-foot i::after{content:" "}
  /* Technical: navy→blue rail on the left, title in the middle, 2×2 contact grid from 190 mm. */
  .cover-tech::before{content:"";position:absolute;left:0;top:0;width:11mm;height:297mm;background:linear-gradient(var(--navy),var(--brand))}
  .cover-tech .cover-top{left:26mm;right:14mm;top:12.5mm}
  .cover-tech h1{left:26mm;top:86.4mm}
  .cover-tech .cover-sub{left:26mm;top:121mm;font:13pt/5.5mm Helvetica,Arial,sans-serif;color:var(--muted)}
  .cover-tech .cover-rule{left:26mm;top:130mm;width:70mm;border-top:.5mm solid var(--gray)}
  .cover-tech .info-blocks{left:26mm;right:14mm;top:187.5mm;height:100mm;grid-template-columns:82mm 1fr;grid-template-rows:50.5mm 1fr}
  .cover-tech .info-blocks::after{left:82mm}
  .cover-tech .info-block:nth-child(even){padding-left:5mm}
  .cover-tech .info-block:nth-child(odd){padding-right:4mm}
  .cover-tech .info-block:nth-child(n+3){padding-top:.5mm}
  .cover-tech .cover-foot{left:26mm}
  /* Executive: 166 mm dark band with the network map, white title; the contact grid stays on white. */
  .cover-exec::before{content:"";position:absolute;left:0;top:0;width:210mm;height:166mm;background:var(--deep)}
  .cover .cover-texture{display:block;left:0;top:0;width:210mm;height:166mm}
  .cover-exec .cover-top{left:17mm;right:17mm;top:15mm}
  .cover-exec .brand{font-size:11pt;color:#fff}.cover-exec .brand span{color:var(--cyan)}
  .cover-exec .pill{border:.4mm solid var(--cyan);border-radius:1.2mm;color:var(--cyan)}
  .cover-exec .eyebrow{left:17mm;top:101.1mm;font:700 9pt/4mm Helvetica,Arial,sans-serif;letter-spacing:.8mm;color:var(--cyan);opacity:1}
  .cover-exec h1{left:17mm;top:108.8mm;font-size:34pt;line-height:14mm;color:#fff}
  .cover-exec .cover-client{left:17mm;right:17mm;top:142.7mm;font:14pt/6mm Helvetica,Arial,sans-serif;color:#c9d6ea;opacity:1;max-width:none}
  .cover-exec .info-blocks{left:17mm;right:17mm;top:187.5mm;height:94mm;grid-template-columns:88mm 1fr;grid-template-rows:48.5mm 1fr}
  .cover-exec .info-blocks::after{left:88mm}
  .cover-exec .info-block:nth-child(even){padding-left:4mm}
  .cover-exec .info-block:nth-child(odd){padding-right:8mm}
  .cover-exec .info-block:nth-child(n+3){padding-top:2.5mm}
  .cover-exec .info-title{color:var(--brand)}.cover-exec .info-block:nth-child(even) .info-title{color:var(--navy)}
  .cover-exec .cover-foot{left:17mm;color:var(--muted)}

  /* Section titles. T1: navy bar (7.5 mm, white 9.5 pt; section 1: 10 mm, 12 pt); "1." numbering. */
  .report:is(.executive,.technical) .sec{padding:0}
  /* A title bar is never split between two pages. */
  .report:is(.executive,.technical) :is(.sec-title,.sub,.chip,.kpi,.verdict-banner){break-inside:avoid}
  .report:is(.executive,.technical) .sec:not(.page-break){margin-top:5mm}
  .technical .sec-title{display:flex;align-items:center;gap:1.4mm;height:7.5mm;margin:0 0 5mm;padding:0 3mm;border:0;border-radius:0;background:var(--navy);color:#fff;font:700 9.5pt/1 Helvetica,Arial,sans-serif;letter-spacing:0;text-transform:none}
  .technical .sec:first-of-type .sec-title{height:10mm;font-size:12pt;margin-bottom:9mm}
  .technical .sec-num{background:none;color:inherit;padding:0;min-width:0;border-radius:0;font-size:inherit}
  .technical .sec-num::after{content:"."}
  /* T2: blue number chip (10 pt) + navy 14 pt title + 0.7 mm blue rule 10 mm below the top. */
  .executive .sec-title{display:flex;align-items:center;gap:3mm;height:auto;margin:0 0 5.3mm;padding:0 0 2.15mm;border:0;border-bottom:.7mm solid var(--brand);border-radius:0;background:none;color:var(--navy);font:700 14pt/7.5mm Helvetica,Arial,sans-serif;letter-spacing:0;text-transform:none}
  .executive .sec-num{display:flex;align-items:center;justify-content:center;height:7.5mm;min-width:0;padding:0 2.5mm;border-radius:1.2mm;background:var(--brand);color:#fff;font:700 10pt/1 Helvetica,Arial,sans-serif}
  /* Appendices and the architecture page (both): mid-blue bar, 7.5 mm, white 9.5 pt. */
  .report:is(.executive,.technical) .sec-title:not(:has(.sec-num)){display:flex;align-items:center;height:7.5mm;margin:0 0 2mm;padding:0 3mm;border:0;background:var(--mid);color:#fff;font:700 9.5pt/1 Helvetica,Arial,sans-serif}
  /* Subtitles: mid blue bold 9 pt (section 1's first: 11 pt) over a 0.3 mm rule 2 mm under the baseline. */
  .report:is(.executive,.technical) .sub{font:700 9pt/1.2 Helvetica,Arial,sans-serif;color:var(--mid);border:0;border-bottom:.3mm solid var(--mid);padding:0 0 1.3mm;margin:5mm 0 4.5mm;text-align:left;letter-spacing:0}
  .report:is(.executive,.technical) .sec:first-of-type .sub:first-of-type{font-size:11pt}
  .report:is(.executive,.technical) .sec-title+.sub{margin-top:0}

  /* Running text: 8.5 pt, 4.5 mm lines, left aligned; section 1 reads at 10.5 pt, 5.5 mm. */
  .report:is(.executive,.technical) p.body{font-size:8.5pt;line-height:4.5mm;margin:0 0 2.5mm;text-align:left;text-indent:0;color:var(--ink)}
  .report:is(.executive,.technical) .sec:first-of-type p.body{font-size:10.5pt;line-height:5.5mm;margin-bottom:4mm}
  .report:is(.executive,.technical) p.body.strong{font-weight:700}
  .report:is(.executive,.technical) p.body.navy{color:var(--navy);font-size:9.5pt}
  .report:is(.executive,.technical) .bullets{font-size:8.5pt;line-height:4.5mm;margin:0 0 3mm;padding-left:5mm}
  .report:is(.executive,.technical) .sec:first-of-type .bullets{font-size:10.5pt;line-height:5.5mm}
  .report:is(.executive,.technical) .muted,.report:is(.executive,.technical) .volume-note{font-size:7.5pt;line-height:1.35;color:var(--muted);margin:0 0 3mm}
  /* Info note: light blue band, muted italic 8 pt. */
  .report:is(.executive,.technical) .note{background:var(--row);border:0;border-radius:0;color:var(--muted);font:italic 8pt/1.35 Helvetica,Arial,sans-serif;padding:2.4mm 3mm;margin:0 0 4mm;min-height:8mm}
  .report:is(.executive,.technical) .note.banner{font-style:normal;font-weight:700;color:var(--navy)}

  /* Tables (jspdf-autotable "grid"): navy header, white bold 7.5 pt, 2.5 mm padding; body 7.5 pt, 2 mm; 0.1 mm
     #c8c8c8 lines; every other row #ebf3fb. Compact tables: mid-blue header 7 pt, 2/1.8 mm padding. */
  .report:is(.executive,.technical) .table-wrap{margin:0 0 5mm;overflow:visible}
  .report:is(.executive,.technical) table{border:0;border-radius:0;border-collapse:collapse;font-size:7.5pt;line-height:1.15}
  .report:is(.executive,.technical) th{background:var(--navy);color:#fff;font:700 7.5pt/1.15 Helvetica,Arial,sans-serif;letter-spacing:0;text-transform:none;padding:2.5mm;border:.1mm solid var(--grid);vertical-align:top}
  .report:is(.executive,.technical) td{padding:2mm;border:.1mm solid var(--grid);color:var(--ink);font-size:7.5pt;line-height:1.15;vertical-align:top}
  .report:is(.executive,.technical) tbody tr:nth-child(odd) td{background:#fff}
  .report:is(.executive,.technical) tbody tr:nth-child(even) td{background:var(--row)}
  .report:is(.executive,.technical) table.compact th{background:var(--mid);font-size:7pt;padding:2mm}
  .report:is(.executive,.technical) table.compact td{font-size:7pt;padding:1.8mm}
  /* The alert lines under each Critical case: 6.3 pt, #464646 on #f8f9fb, indented 6 mm. */
  .report:is(.executive,.technical) tr.sub-row td{font-size:6.3pt;color:#464646;background:#f8f9fb!important;padding:1.2mm 2mm 1.2mm 6mm}
  .report:is(.executive,.technical) .cell-note{font-size:6.3pt;color:var(--muted)}
  .report:is(.executive,.technical) .sev{font-weight:700}

  /* KPI cards. T1: solid colour, r 2 mm, white 13 pt value and 5.5 pt label, centred; 7 in a row (22 mm),
     4 (18 mm, gap 3) and 3 (16 mm). T2: #f3f6fa tile, 1.2 mm colour strip on top, navy 14 pt value, slate 6.5 pt
     label, left aligned; 6 in a row (22 mm, gap 2.5). */
  .report:is(.executive,.technical) .kpis{gap:2mm;margin:0 0 5mm}
  .report:is(.executive,.technical) .kpis.n-3{grid-template-columns:repeat(3,1fr);gap:3mm}
  .report:is(.executive,.technical) .kpis.n-4{grid-template-columns:repeat(4,1fr);gap:3mm}
  .report:is(.executive,.technical) .kpis.n-5{grid-template-columns:repeat(5,1fr)}
  .report:is(.executive,.technical) .kpis.n-6{grid-template-columns:repeat(6,1fr);gap:2.5mm}
  .report:is(.executive,.technical) .kpis.n-7{grid-template-columns:repeat(7,1fr)}
  .technical .kpi{display:flex;flex-direction:column;align-items:center;justify-content:center;height:22mm;padding:0 1mm;border-radius:2mm;text-align:center}
  .technical .kpis.n-4 .kpi{height:18mm}.technical .kpis.n-3 .kpi{height:16mm}
  .technical .kpi-value{font:700 13pt/1 Helvetica,Arial,sans-serif;color:#fff}
  .technical .kpi-label{font:5.5pt/3.2mm Helvetica,Arial,sans-serif;color:#fff!important;margin-top:1.6mm}
  .executive .kpi{display:block;height:22mm;padding:5.6mm 3mm 0;border:0;border-top:1.2mm solid var(--navy);border-radius:1.8mm;background:var(--soft);color:var(--navy)}
  .executive .kpis.n-4 .kpi{height:18mm;padding-top:3.6mm}.executive .kpis.n-3 .kpi{height:16mm;padding-top:2.8mm}
  .executive .kpi-value{font:700 14pt/1 Helvetica,Arial,sans-serif;color:var(--navy);white-space:nowrap}
  .executive .kpi-label{font:6.5pt/1.25 Helvetica,Arial,sans-serif;color:var(--slate)!important;margin-top:2.2mm;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .executive .kpis.tiles .tone-crit{border-color:var(--crit)}.executive .kpis.tiles .tone-high{border-color:var(--high)}.executive .kpis.tiles .tone-med{border-color:var(--med)}.executive .kpis.tiles .tone-ok{border-color:var(--ok)}
  .executive .kpis.tiles .tone-brand{border-color:var(--brand)}.executive .kpis.tiles .tone-mid{border-color:var(--mid)}.executive .kpis.tiles .tone-cyan{border-color:var(--cyan)}.executive .kpis.tiles .tone-muted{border-color:var(--muted)}
  .technical .kpis.solid .tone-muted{background:var(--muted)}

  /* Chart frames. T2: 0.3 mm #dce3ec outline, r 2 mm, navy bold 8 pt title, muted 6 pt note; 4 mm gaps.
     T1: no frame, navy bold 7.5 pt title centred over the chart; 6 mm gaps. */
  .report:is(.executive,.technical) .grid{gap:4mm;margin:0 0 4mm}
  .report:is(.executive,.technical) .grid.cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  .report:is(.executive,.technical) .card{box-shadow:none;margin:0}
  .report:is(.executive,.technical) .card.wide{margin:0 0 4mm}
  .executive .card{border:.3mm solid var(--line);border-radius:2mm;padding:1.6mm 2mm 2mm}
  .executive .card-title{font:700 8pt/1.2 Helvetica,Arial,sans-serif;color:var(--navy);margin:0 0 2mm 1mm}
  .executive .card-note{font:6pt/2.6mm Helvetica,Arial,sans-serif;color:var(--muted);margin:1.5mm 1mm 0}
  .technical .grid{gap:6mm}
  .technical .card{border:0;border-radius:0;padding:0}
  .technical .card-title{font:700 7.5pt/1.2 Helvetica,Arial,sans-serif;color:var(--navy);text-align:center;margin:0 0 1.5mm}
  .technical .card-note{font:6.5pt/1.3 Helvetica,Arial,sans-serif;color:var(--muted);text-align:center;margin:1mm 0 0}
  .report:is(.executive,.technical) .fig-note{font:italic 6.5pt/1.3 Helvetica,Arial,sans-serif;color:var(--muted);margin:0 0 3mm}
  /* Chart text: legends 6.5 pt (T1 7 pt), bar labels 6.5–7 pt. */
  .report:is(.executive,.technical) .legend{font-size:6.5pt;line-height:1.3;color:var(--ink);gap:1.2mm 3.5mm;margin-top:1.5mm}
  .technical .legend{font-size:7pt;justify-content:center}
  .report:is(.executive,.technical) .legend i{width:2.5mm;height:2.1mm;border-radius:0;margin-right:1.2mm}
  .report:is(.executive,.technical) .hbars{gap:1.4mm}
  .report:is(.executive,.technical) .hbar{grid-template-columns:minmax(30mm,38%) 1fr 14mm;gap:2mm;font-size:6.5pt;color:var(--ink)}
  .technical .hbar{font-size:7pt}
  .report:is(.executive,.technical) .hbar-track{height:3.2mm;background:none;border-radius:0}
  .report:is(.executive,.technical) .hbar-fill{border-radius:.8mm}
  .report:is(.executive,.technical) .hbar-value{font-weight:700}

  /* MITRE tactic grid, 7 × 2. T1: 14 mm cells, gap 1 mm, navy when detected else #f2f2f2; bold 6 pt ID and
     5.5 pt name, centred. T2: 17 mm cells, gap 1.4 mm, heat by alerts; 5.5 pt ID, bold 6 pt name, bold 8 pt count. */
  .technical .tactic-grid{gap:1mm;margin:0 0 6mm}
  .technical .tactic{height:14mm;min-height:0;padding:1.8mm 1mm 0;border-radius:1.5mm;align-items:center;text-align:center;gap:.6mm;font-size:5.5pt;line-height:1.25}
  .technical .tactic b{font-size:6pt;font-weight:700}
  .technical .tactic.on{background:var(--navy);color:#fff}.technical .tactic.off{background:var(--gray);color:var(--muted)}
  .executive .tactic-grid{gap:1.4mm;margin:0 0 3mm}
  .executive .tactic{height:17mm;min-height:0;padding:1.6mm 2mm 1.4mm;border-radius:1.5mm;gap:.5mm;font:700 6pt/1.2 Helvetica,Arial,sans-serif}
  .executive .tactic b{font-size:5.5pt;font-weight:400}
  .executive .tactic small{font-size:8pt;font-weight:700;margin-top:auto}
  .executive .tactic.heat-none{background:var(--empty,#eef1f5);color:#8a96a8}
  .executive .tactic.heat-low{background:var(--light);color:var(--deep)}
  .executive .tactic.heat-mid{background:var(--brand);color:#fff}
  .executive .tactic.heat-high{background:var(--navy);color:#fff}
  .executive i.heat-none{background:#eef1f5}.executive i.heat-low{background:var(--light)}.executive i.heat-mid{background:var(--brand)}.executive i.heat-high{background:var(--navy)}

  /* T2 methodology: chevrons 17 mm tall, 5 mm notch, 1.2 mm gaps, navy → cyan; "PHASE n" 6 pt, name bold
     7.5 pt; a 0.6 mm rule in the phase colour and the 7 pt description underneath. */
  .executive .flow{gap:1.2mm;margin:0 0 5mm}
  .executive .chevron{height:17mm;padding:2.6mm 6mm 0 2.5mm;clip-path:polygon(0 0,calc(100% - 5mm) 0,100% 50%,calc(100% - 5mm) 100%,0 100%,5mm 50%);font:700 7.5pt/1.2 Helvetica,Arial,sans-serif;color:#fff}
  .executive .flow li:not(:first-child) .chevron{padding-left:7.5mm}
  .executive .flow li:first-child .chevron{clip-path:polygon(0 0,calc(100% - 5mm) 0,100% 50%,calc(100% - 5mm) 100%,0 100%)}
  .executive .chevron b{font-size:6pt;font-weight:400;letter-spacing:0;margin-bottom:1mm}
  .executive .flow li:nth-child(1) .chevron{background:#1f3864}.executive .flow li:nth-child(2) .chevron{background:#175781}.executive .flow li:nth-child(3) .chevron{background:#10769e}.executive .flow li:nth-child(4) .chevron{background:#0895bb}.executive .flow li:nth-child(5) .chevron{background:#00b4d8}
  .executive .flow p{margin:1.8mm 5mm 0 1mm;padding-top:2.2mm;border-top:.6mm solid #1f3864;font:7pt/3.4mm Helvetica,Arial,sans-serif;color:var(--ink)}
  .executive .flow li:nth-child(2) p{border-color:#175781}.executive .flow li:nth-child(3) p{border-color:#10769e}.executive .flow li:nth-child(4) p{border-color:#0895bb}.executive .flow li:nth-child(5) p{border-color:#00b4d8}

  /* T2 executive dashboard scorecard: 7 pt label, bold coloured rating, 2.6 mm #eef1f5 track. */
  .executive .score-row{margin:0 0 4.6mm}
  .executive .score-head{font-size:7pt;color:var(--ink)}.executive .score-head>span:last-child{font-weight:700}
  .executive .rating-high .score-head>span:last-child{color:var(--ok)}.executive .rating-medium .score-head>span:last-child{color:var(--high)}.executive .rating-low .score-head>span:last-child{color:var(--crit)}
  .executive .score-track{height:2.6mm;border-radius:1.3mm;background:#eef1f5;margin-top:.8mm}
  .executive .findings{font-size:7pt;line-height:3.4mm}
  .executive .findings li{margin:0 0 2.2mm}

  /* T2 detection story: no frame; blue "QUESTION n OF t" chip 6.5 pt, navy bold 12 pt question, 8.5 pt answer
     (4.2 mm lines), muted 6.2 pt note. */
  .executive .story-q{border:0;border-radius:0;padding:0;margin:0 0 6mm}
  .executive .chip{display:inline-flex;align-items:center;height:5mm;padding:0 2.5mm;border-radius:1mm;background:var(--brand);font:700 6.5pt/1 Helvetica,Arial,sans-serif;letter-spacing:0}
  .executive .story-q h4{font:700 12pt/1.2 Helvetica,Arial,sans-serif;color:var(--navy);margin:2.4mm 0 2mm}
  .executive .answer{font-size:8.5pt;line-height:4.2mm;margin:0 0 3mm;color:var(--ink)}
  .executive .story-q .card-note{font:6.2pt/2.7mm Helvetica,Arial,sans-serif;color:var(--muted);margin:2mm 0 0}
  /* Q1 funnel: 10 mm stages #8fa3bf → mid blue → blue → navy → red/green, white bold 10.5 pt values. */
  .executive .stage{min-height:10mm;padding:1.6mm 3mm;border-radius:0;font-size:6.6pt}
  .executive .stage b{font-size:10.5pt}.executive .stage small{font-size:6.6pt}
  .executive .stage:nth-child(1){background:#8fa3bf}.executive .stage:nth-child(2){background:var(--mid)}.executive .stage:nth-child(3){background:var(--brand)}.executive .stage:nth-child(4){background:var(--navy)}
  .executive .stage.bad{background:var(--crit)}.executive .stage.good{background:var(--ok)}
  .executive :is(.tiles3,.tiles4){gap:3mm;margin-top:3mm}
  .executive .tiles4{gap:4mm}
  .executive :is(.tiles3,.tiles4) div{min-height:15mm;padding:2.4mm 3mm;border:.25mm solid var(--line);border-radius:1.5mm;background:var(--soft);font-size:6.3pt;line-height:1.3;color:var(--slate)}
  .executive :is(.tiles3,.tiles4) b{font-size:13pt;color:var(--navy)}
  /* Q2 threats: deep headline card (white 10.5 pt name, cyan 6.8 pt tactics, light 6.3 pt facts, 20 pt count);
     outlined small cards (navy 7.8 pt name, blue 6 pt tactic, slate 6.2 pt facts); 1.4/1.2 mm severity strip. */
  .executive .threat{margin:0;padding:2.2mm 3mm 2.2mm 4mm;border:.3mm solid var(--line);border-left:1.2mm solid var(--high);border-radius:1.8mm;background:#fff}
  .executive .threat.sev-critical{border-left-color:var(--crit)}
  .executive .threat-head{font-size:6pt;letter-spacing:0;color:var(--high)}.executive .threat.sev-critical .threat-head{color:var(--crit)}
  .executive .threat-name{font-size:7.8pt;line-height:3.4mm;color:var(--navy);margin:1.4mm 0}
  .executive .threat-tactics{font-size:6pt;font-weight:700;color:var(--brand)}
  .executive .threat-facts{font-size:6.2pt;color:var(--slate)}
  .executive .threat.headline{border:0;border-left:1.4mm solid var(--high);background:var(--deep);color:#fff;padding:3mm 4mm}
  .executive .threat.headline.sev-critical{border-left-color:var(--crit)}
  .executive .threat.headline .threat-head{font-size:6.6pt;color:#ffb86c}.executive .threat.headline.sev-critical .threat-head{color:#ff8a8a}
  .executive .threat.headline .threat-name{font-size:10.5pt;line-height:4.6mm;color:#fff}
  .executive .threat.headline .threat-tactics{font-size:6.8pt;color:var(--cyan)}
  .executive .threat.headline .threat-facts{font-size:6.3pt;color:var(--light)}
  .executive .threat-big b{font-size:20pt}
  .executive .chip-ent{font-size:6pt}
  .executive .threat-grid{gap:3mm;grid-auto-rows:1fr}
  /* The headline card is a 76 mm column on the left, the four smaller cards a 2 × 2 grid on its right. */
  .executive .story-visual:has(>.threat.headline){display:grid;grid-template-columns:76mm minmax(0,1fr);gap:3mm;break-inside:avoid}
  .executive .threat.headline{display:flex;flex-direction:column;min-height:70mm}
  .executive .threat.headline .threat-big{margin-top:auto}
  .executive .pill-status{display:inline-flex;align-items:center;height:4.2mm;padding:0 2mm;border-radius:2.1mm;font:700 5.8pt/1 Helvetica,Arial,sans-serif}
  .executive .pill-status.good{background:#d6f2e3;color:var(--ok)}.executive .pill-status.bad{background:#f5d6d6;color:var(--crit)}.executive .pill-status.warn{background:#ffebd6;color:var(--high)}
  /* Q4 response: 6 outlined tiles 22 mm (lamp r 1.7 mm, slate 6.8 pt label, navy 15 pt value, muted 5.9 pt line);
     deep verdict bar 14 mm. */
  .executive .resp-grid{gap:3mm}
  .executive .resp-tile{min-height:22mm;padding:2.6mm 3mm;border:.3mm solid var(--line);border-radius:1.8mm;background:#fff}
  .executive .resp-label{font-size:6.8pt;color:var(--slate)}
  .executive .resp-tile b{font-size:15pt;color:var(--navy)}
  .executive .resp-tile small{font-size:5.9pt;color:var(--muted)}
  .executive .lamp{width:3.4mm;height:3.4mm;margin-right:1.4mm;vertical-align:-.6mm}
  .executive .lamp-yellow{background:#e8a000}.executive .lamp-none{background:#bec4cd}.executive .lamp-info{background:var(--brand)}
  .executive .resp-verdict{min-height:14mm;margin-top:3mm;padding:2.4mm 4mm;border-radius:1.8mm;background:var(--deep);font:700 8.5pt/1.3 Helvetica,Arial,sans-serif}
  .executive .resp-verdict small{font-size:6.6pt;font-weight:400;color:var(--light)}
  /* Q5 effort: 32 mm label column, 11 mm bars; investigation #607daa, alert triage #cdd6e4, case triage blue,
     avoided triage dashed #22a05a. */
  .executive .eff-row{grid-template-columns:32mm 1fr 18mm;gap:2mm}
  .executive .eff-label{font-size:7.5pt;color:var(--navy)}.executive .eff-label small{font-size:6pt;color:var(--muted)}
  .executive .eff-bar{height:11mm;border-radius:0;background:none}
  .executive .seg{font:700 6.5pt/11mm Helvetica,Arial,sans-serif;color:#fff;text-align:center}
  .executive .seg.tri-alerts{color:var(--navy)}
  .executive .seg.tri-cases,.executive i.tri-cases{background:var(--brand)}
  .executive .seg.saved,.executive i.saved{border:.5mm dashed #22a05a}

  /* Verdict: rounded 3 mm band, 16 mm, white bold 12 pt label over 14 pt verdict, centred. */
  .report:is(.executive,.technical) .verdict-banner{align-items:center;justify-content:center;min-height:16mm;margin:0 0 6mm;padding:1.6mm 4mm;border-radius:3mm;text-align:center}
  .report:is(.executive,.technical) .verdict-banner span{font:700 12pt/1.2 Helvetica,Arial,sans-serif;letter-spacing:0;text-transform:none;opacity:1}
  .report:is(.executive,.technical) .verdict-banner b{font:700 14pt/1.25 Helvetica,Arial,sans-serif}
  .report:is(.executive,.technical) .verdict-approved{background:var(--ok)}.report:is(.executive,.technical) .verdict-conditional{background:var(--high)}.report:is(.executive,.technical) .verdict-rejected{background:var(--crit)}
  /* Signatures: two columns 10 mm apart; 0.4 mm muted line 14 mm down; navy bold 7.5 pt role, muted 7 pt name. */
  .report:is(.executive,.technical) .signatures{gap:10mm;margin-top:0}
  .report:is(.executive,.technical) .sig-line{height:14mm;border-top:0;border-bottom:.4mm solid var(--muted);margin:0 0 2.6mm}
  .report:is(.executive,.technical) .signatures b{font:700 7.5pt/1.3 Helvetica,Arial,sans-serif;color:var(--navy)}
  .report:is(.executive,.technical) .signatures span:not(.sig-line){font-size:7pt;color:var(--muted)}
}
`

/** A CSS string: quotes and backslashes escaped, and no "<" that could close the <style> element. */
const cssString = (s: string) => `"${s.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3c ')}"`

/**
 * The print pages, with the Report's footer text ("{client} · Confidential", in its language):
 * - report (with `bars`): Executive and Technical, the previous tool's navy bars with "STELLAR CYBER", the Report
 *   type and the page number on top, and "CONFIDENTIAL — {client}" and the copyright at the bottom;
 * - abnt, abnt-pre: the ABNT layout (turned off since 2026-10-19, kept to switch back): page number top right,
 *   and the Technical lists of figures and tables, counted but not numbered;
 * - cover: full bleed, not counted (the first page after it is page 1);
 * - insight: the brief keeps its previous margins and its "client · Confidential · p. X/Y" footer.
 */
export function pageCss(footer: string, bars: { header: string; footer: string } | null = null): string {
  const label = cssString(footer)
  // Executive and Technical: the previous tool's navy bars on every page but the cover, which has its own page.
  // Both bars are one A4-sized SVG (10 mm on top, 8 mm at the bottom) drawn by the top-left corner box, the first
  // margin box painted, overflowing under the others: painted margin boxes left hairlines where they met, and
  // Chromium does not print an @page background image. The text boxes on top are transparent.
  const font = 'Helvetica,Arial,sans-serif'
  const barsSvg = `url("data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='210mm' height='297mm' viewBox='0 0 210 297'><rect width='210' height='10' fill='#1f3864'/><rect y='289' width='210' height='8' fill='#1f3864'/></svg>",
  )}")`
  const top = 'margin-bottom:8mm;vertical-align:middle;color:#fff'
  const bottom = 'margin-top:8mm;vertical-align:middle;color:#fff'
  const report = bars
    ? `@page report{size:A4;margin:18mm 14mm 16mm;@top-left-corner{content:${barsSvg};vertical-align:top;text-align:left;overflow:visible}@top-left{content:"STELLAR CYBER";width:26mm;font:700 8pt ${font};${top}}@top-center{content:${cssString(bars.header)};width:130mm;text-align:left;font:8pt ${font};${top}}@top-right{content:counter(page);text-align:right;font:8pt ${font};${top}}@bottom-left{content:${cssString(bars.footer)};width:130mm;font:6.5pt ${font};${bottom}}@bottom-right{content:"© Stellar Cyber, Inc.";text-align:right;font:6.5pt ${font};${bottom}}}
`
    : ''
  const foot = `@bottom-left{content:${label};vertical-align:bottom;padding-bottom:4mm;font:8pt Helvetica,Arial,sans-serif;color:#5f6b7a}`
  return `@page abnt{size:A4;margin:14mm 13mm 17mm;@top-right{content:counter(page);vertical-align:top;padding-top:5mm;font:10pt Helvetica,Arial,sans-serif;color:#1f2733}${foot}}
@page abnt-pre{size:A4;margin:14mm 13mm 17mm;${foot}}
${report}@page cover{size:A4;margin:0;counter-increment:page 0}
@page insight{size:A4;margin:14mm 13mm 17mm;@bottom-right{content:${label} " " counter(page) "/" counter(pages);vertical-align:bottom;padding-bottom:2mm;font:7.5pt Helvetica,Arial,sans-serif;color:#5f6b7a}}
`
}
