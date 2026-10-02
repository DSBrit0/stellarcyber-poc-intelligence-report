// Presentation mode: the same Report page plus a small script, allowed only by a per-response CSP nonce.
// It shows the data-tip insights on hover/tap, toggles chart series from the legend, and moves
// between sections with the keyboard (←/→, PageUp/PageDown) or the toolbar.
export const INTERACTIVE_JS = `(() => {
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);
  let current = null;
  const show = (el, x, y) => {
    tip.textContent = el.getAttribute('data-tip');
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + 'px';
    tip.style.top = Math.max(8, y - r.height - 12) + 'px';
  };
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el.getAttribute('data-tip')) { current = el; show(el, e.clientX, e.clientY); }
    else if (current) { current = null; tip.style.display = 'none'; }
  });
  document.addEventListener('pointerleave', () => { tip.style.display = 'none'; });

  // Legend click: hide/show one series inside the same chart.
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-toggle]');
    if (!t) return;
    const fig = t.closest('figure, .card');
    if (!fig) return;
    const name = t.getAttribute('data-toggle');
    t.classList.toggle('off');
    fig.querySelectorAll('[data-series]').forEach((el) => {
      if (el.getAttribute('data-series') === name) el.classList.toggle('off');
    });
  });

  // Section navigation.
  const sections = () => Array.from(document.querySelectorAll('.cover, .sec, .hero'));
  const go = (dir) => {
    const list = sections();
    const y = window.scrollY + 10;
    let i = list.findIndex((s) => s.offsetTop > y);
    if (i < 0) i = list.length;
    const target = dir > 0 ? list[i] : list[Math.max(0, i - 2)];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  });
  document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
    const a = b.getAttribute('data-action');
    if (a === 'prev') go(-1);
    if (a === 'next') go(1);
    if (a === 'print') window.print();
    if (a === 'full') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }));
})();`

export const INTERACTIVE_CSS = `
.interactive [data-tip]{cursor:default}
.interactive .donut path,.interactive .chart-svg rect,.interactive .hbar,.interactive .tactic,.interactive .heat-cell,.interactive .kpi[data-tip]{transition:opacity .15s,transform .15s}
.interactive .donut svg:hover path{opacity:.45}.interactive .donut svg path:hover{opacity:1}
.interactive .chart-svg rect:hover,.interactive .hbar:hover .hbar-fill{filter:brightness(1.12)}
.interactive .tactic:hover,.interactive .kpi[data-tip]:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(11,31,77,.18)}
.interactive .pt{opacity:0}.interactive .pt:hover,.interactive .matrix .pt{opacity:1}
.interactive .chart-svg circle.pt:hover{stroke:#fff;stroke-width:2}
.interactive [data-toggle]{cursor:pointer;user-select:none}.interactive [data-toggle].off{opacity:.35;text-decoration:line-through}
.interactive [data-series].off{display:none}
.tip{position:fixed;z-index:20;display:none;max-width:340px;background:#0b1f4d;color:#fff;font-size:12.5px;line-height:1.4;padding:8px 11px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none}
.toolbar{position:fixed;right:18px;bottom:18px;z-index:15;display:flex;gap:6px;background:rgba(255,255,255,.92);backdrop-filter:blur(6px);border:1px solid var(--line);border-radius:10px;padding:6px;box-shadow:0 4px 18px rgba(11,31,77,.15)}
.toolbar button{border:0;background:var(--soft);color:var(--navy);border-radius:7px;padding:7px 11px;font:inherit;font-size:12.5px;cursor:pointer}
.toolbar button:hover{background:var(--navy);color:#fff}
@media print{.toolbar,.tip{display:none!important}}
`

export function toolbarHtml(labels: { prev: string; next: string; full: string; print: string }): string {
  const esc = (s: string) => s.replace(/[<>&"]/g, '')
  return `<nav class="toolbar" aria-label="Presentation"><button data-action="prev" title="${esc(labels.prev)}">◀</button><button data-action="next" title="${esc(labels.next)}">▶</button><button data-action="full">${esc(labels.full)}</button><button data-action="print">${esc(labels.print)}</button></nav>`
}
