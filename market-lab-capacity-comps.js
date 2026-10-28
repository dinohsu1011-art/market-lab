// Comps chart kit + cloud growth and capex comps for the capacity page.
// Every chart puts all companies on ONE shared axis so values compare directly.
// Reported = solid line / filled dot / solid column.
// Estimate = dashed line / hollow dot / hatched column, inside a shaded band.
// Colors are CSS variables, so the light/dark switch restyles charts without a redraw.
(() => {
  const COLORS = {Microsoft:'var(--microsoft)', Google:'var(--capacity-gold)', Amazon:'var(--amazon)', Oracle:'var(--oracle)', Meta:'var(--capacity-purple)', SpaceX:'var(--spacex)', xAI:'var(--spacex)', OpenAI:'var(--openai)', Anthropic:'var(--anthropic)'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtB = v => v == null ? '–' : (v < 0 ? '-$' : '$') + (Math.abs(v) >= 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(2)) + 'B';
  const axisB = v => (v < 0 ? '-$' : '$') + Math.abs(v) + 'B';
  const fmtPct = (v, d = 0) => v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';

  // ---------- shared tooltip ----------
  const tip = document.createElement('div');
  tip.className = 'comp-tip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  const showTip = (evt, html) => {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect(), pad = 14;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const hideTip = () => { tip.hidden = true; };
  const tipRows = (title, rows) => `<div class="comp-tip-title">${esc(title)}</div>` + rows
    .map(r => `<div class="comp-tip-row${r.e ? ' est' : ''}"><i style="background:${r.color}"></i><span>${esc(r.name)}</span><b>${esc(r.text)}</b>${r.e ? '<em>est</em>' : '<em></em>'}</div>${r.note ? `<div class="comp-tip-note">${esc(r.note)}</div>` : ''}`).join('');
  addEventListener('scroll', hideTip, {passive: true});

  function ticks(lo, hi, count = 5) {
    if (lo === hi) hi = lo + 1;
    const span = hi - lo, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count + .5);
    const out = [];
    for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }

  const hatchId = color => 'hatch-' + color.replace(/[^a-z0-9]/gi, '');
  // Every comp chart shares one height so the 2x2 grid lines up.
  const CHART_H = 320;
  const hatchDefs = colors => `<defs>${[...new Set(colors)].map(c => `<pattern id="${hatchId(c)}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:${c};fill-opacity:.16"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:${c};stroke-width:2.2"/></pattern>`).join('')}</defs>`;

  // Rebuild on width change so text stays at true size instead of scaling.
  function responsive(host, draw) {
    host._draw = () => { hideTip(); draw(); };
    if (!host._observer) {
      let width = 0;
      host._observer = new ResizeObserver(() => {
        if (Math.abs(host.clientWidth - width) > 2) { width = host.clientWidth; host._draw(); }
      });
      host._observer.observe(host);
    }
    host._draw();
  }

  function legend(host, series, hidden, onToggle) {
    host.innerHTML = series.map(s => `<button type="button" class="comp-key" aria-pressed="${!hidden.has(s.name)}" data-name="${esc(s.name)}"><i style="background:${s.hatch ? `repeating-linear-gradient(135deg, transparent 0 3px, ${s.color} 3px 4.5px)` : s.color}"></i>${esc(s.name)}</button>`).join('');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      hidden.has(b.dataset.name) ? hidden.delete(b.dataset.name) : hidden.add(b.dataset.name);
      if (series.every(s => hidden.has(s.name))) hidden.delete(b.dataset.name); // keep one visible
      onToggle();
    }));
  }

  function xLabels(periods, x, y, band) {
    const sparse = band < 26;
    return periods.map((p, i) => {
      const q = p.label, showQ = !sparse || /Q[13]|FY|^\d{4}/.test(q) || periods.length < 8;
      const showYear = p.year && (i === 0 || periods[i - 1].year !== p.year);
      return (showQ ? `<text x="${x(i)}" y="${y}" class="ax-x">${esc(q)}</text>` : '') +
        (showYear ? `<text x="${x(i)}" y="${y + 13}" class="ax-year">${esc(p.year)}</text>` : '');
    }).join('');
  }

  // ---------- line chart: periods on x, one line per company ----------
  function lineChart(host, cfg) {
    responsive(host, () => {
      const series = cfg.series.filter(s => !cfg.hidden?.has(s.name));
      const W = Math.max(280, host.clientWidth), H = cfg.height || CHART_H;
      // Right margin fits the longest end label ("Google Cloud +45%").
      const endText = s => { const p = [...s.points].reverse().find(Boolean); return p ? `${s.short || s.name} ${cfg.fmt(p.v)}` : ''; };
      const m = {t: 22, r: Math.min(150, 16 + 6.6 * Math.max(8, ...series.map(s => endText(s).length))), b: 40, l: 48};
      const iw = W - m.l - m.r, ih = H - m.t - m.b, n = cfg.periods.length, band = iw / n;
      const x = i => m.l + (i + .5) * band;
      const vals = series.flatMap(s => s.points.filter(Boolean).map(p => p.v));
      const t = ticks(Math.min(cfg.floor ?? 0, ...vals), Math.max(...vals, 0));
      const lo = t[0], hi = t[t.length - 1], y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
      const firstEst = cfg.periods.findIndex(p => p.estimate);
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.label)}">`;
      if (firstEst >= 0) {
        const bx = m.l + firstEst * band;
        svg += `<rect x="${bx}" y="${m.t - 14}" width="${m.l + iw - bx}" height="${ih + 14}" class="est-band"/><text x="${bx + 5}" y="${m.t - 4}" class="est-band-label">Estimates</text>`;
      }
      svg += t.map(v => `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'ax-zero' : 'ax-grid'}"/><text x="${m.l - 7}" y="${y(v) + 4}" class="ax-y">${esc(cfg.axisFmt(v))}</text>`).join('');
      svg += xLabels(cfg.periods, x, H - m.b + 16, band);
      const ends = [];
      series.forEach(s => {
        let segs = '', dots = '', last = -1;
        s.points.forEach((p, i) => {
          if (!p) return;
          const prev = s.points[i - 1];
          if (prev) segs += `<line x1="${x(i - 1)}" y1="${y(prev.v)}" x2="${x(i)}" y2="${y(p.v)}" style="stroke:${s.color}" class="ln${p.e ? ' ln-est' : ''}"/>`;
          dots += `<circle cx="${x(i)}" cy="${y(p.v)}" r="${n > 16 ? 2.7 : 3.4}" style="stroke:${s.color};fill:${p.e ? 'var(--ml-surface)' : s.color}" class="dot"/>`;
          last = i;
        });
        svg += `<g>${segs}${dots}</g>`;
        if (last >= 0) ends.push({s, x: x(last), y: y(s.points[last].v), v: s.points[last].v});
      });
      // Direct labels at the right edge, nudged apart so they never overlap.
      ends.sort((a, b) => a.y - b.y);
      ends.forEach((d, i) => { d.ly = Math.max(d.y, i ? ends[i - 1].ly + 14 : m.t); });
      for (let i = ends.length - 1; i >= 0; i--) {
        const max = i === ends.length - 1 ? H - m.b : ends[i + 1].ly - 14;
        if (ends[i].ly > max) ends[i].ly = max;
      }
      const lx = m.l + iw + 8;
      svg += ends.map(d => `<line x1="${d.x + 4}" y1="${d.y}" x2="${lx - 2}" y2="${d.ly}" style="stroke:${d.s.color}" class="leader"/><text x="${lx}" y="${d.ly + 4}" style="fill:${d.s.color}" class="end-label">${esc(d.s.short || d.s.name)} <tspan class="end-value">${esc(cfg.fmt(d.v))}</tspan></text>`).join('');
      svg += `<line class="hover-guide" x1="0" x2="0" y1="${m.t - 14}" y2="${m.t + ih}" visibility="hidden"/>`;
      svg += cfg.periods.map((p, i) => `<rect class="hover-band" data-i="${i}" x="${m.l + i * band}" y="${m.t - 14}" width="${band}" height="${ih + 14}"/>`).join('');
      host.innerHTML = svg + '</svg>';
      const guide = host.querySelector('.hover-guide');
      host.querySelectorAll('.hover-band').forEach(r => {
        const i = Number(r.dataset.i);
        r.addEventListener('mousemove', evt => {
          guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible');
          const rows = series.map(s => ({s, p: s.points[i]})).filter(d => d.p).sort((a, b) => b.p.v - a.p.v)
            .map(({s, p}) => ({name: s.name, color: s.color, text: cfg.fmt(p.v, true), e: p.e, note: p.note}));
          showTip(evt, tipRows(cfg.periods[i].title || cfg.periods[i].key, rows.length ? rows : [{name: 'No data', color: 'transparent', text: ''}]));
        });
        r.addEventListener('mouseleave', () => { guide.setAttribute('visibility', 'hidden'); hideTip(); });
      });
    });
  }

  // ---------- grouped column chart: groups on x, one column per series ----------
  // A value may carry parts [{v,e}] so a year that is half reported, half
  // estimated shows a solid base with a hatched top.
  function columnChart(host, cfg) {
    responsive(host, () => {
      const series = cfg.series.filter(s => !cfg.hidden?.has(s.name));
      const W = Math.max(280, host.clientWidth), H = cfg.height || CHART_H;
      const m = {t: 26, r: 14, b: 40, l: 48};
      const iw = W - m.l - m.r, ih = H - m.t - m.b, n = cfg.groups.length, band = iw / n;
      const vals = series.flatMap(s => s.values.filter(Boolean).map(v => v.v));
      const t = ticks(Math.min(0, ...vals), Math.max(...vals, 0));
      const lo = t[0], hi = t[t.length - 1], y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
      const bw = Math.min(30, band * .82 / Math.max(1, series.length)), gap = Math.min(3, bw * .15);
      const colors = series.flatMap(s => [s.color, ...s.values.filter(Boolean).map(v => v.color || s.color)]);
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.label)}">${hatchDefs(colors)}`;
      svg += t.map(v => `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'ax-zero' : 'ax-grid'}"/><text x="${m.l - 7}" y="${y(v) + 4}" class="ax-y">${esc(cfg.axisFmt(v))}</text>`).join('');
      cfg.groups.forEach((g, gi) => {
        const left = m.l + gi * band + (band - series.length * bw) / 2;
        if (g.estimate) svg += `<rect x="${m.l + gi * band + 1}" y="${m.t - 18}" width="${band - 2}" height="${ih + 18}" class="est-band"/>`;
        series.forEach((s, si) => {
          const val = s.values[gi], bx = left + si * bw + gap / 2, w = bw - gap;
          if (!val) { svg += `<text x="${bx + w / 2}" y="${y(0) - 4}" class="na">n/a</text>`; return; }
          const color = val.color || s.color;
          const parts = val.parts || [{v: val.v, e: val.e}];
          const solid = parts.filter(p => !p.e).reduce((a, p) => a + p.v, 0);
          const est = parts.filter(p => p.e).reduce((a, p) => a + p.v, 0);
          if (solid) svg += `<rect x="${bx}" y="${Math.min(y(solid), y(0))}" width="${w}" height="${Math.abs(y(0) - y(solid))}" style="fill:${color}" class="col"/>`;
          if (est) svg += `<rect x="${bx}" y="${Math.min(y(solid + est), y(solid))}" width="${w}" height="${Math.abs(y(solid) - y(solid + est))}" style="fill:url(#${hatchId(color)});stroke:${color}" class="col col-est"/>`;
          if (w >= 15) svg += `<text x="${bx + w / 2}" y="${(val.v >= 0 ? y(val.v) - 4 : y(val.v) + 11)}" class="col-label" style="fill:${color}">${esc(cfg.labelFmt ? cfg.labelFmt(val.v) : cfg.fmt(val.v))}</text>`;
        });
        svg += `<text x="${m.l + (gi + .5) * band}" y="${H - m.b + 16}" class="ax-x">${esc(g.label)}</text>` + (g.sub ? `<text x="${m.l + (gi + .5) * band}" y="${H - m.b + 29}" class="ax-year">${esc(g.sub)}</text>` : '');
        svg += `<rect class="hover-band" data-i="${gi}" x="${m.l + gi * band}" y="${m.t - 18}" width="${band}" height="${ih + 18}"/>`;
      });
      host.innerHTML = svg + '</svg>';
      host.querySelectorAll('.hover-band').forEach(r => {
        const gi = Number(r.dataset.i);
        r.addEventListener('mousemove', evt => {
          const rows = series.map(s => ({s, v: s.values[gi]})).filter(d => d.v).sort((a, b) => b.v.v - a.v.v)
            .map(({s, v}) => ({name: s.name, color: v.color || s.color, text: cfg.fmt(v.v, true), e: v.e, note: v.note}));
          showTip(evt, tipRows(cfg.groups[gi].title || cfg.groups[gi].label, rows.length ? rows : [{name: 'No data', color: 'transparent', text: ''}]));
        });
        r.addEventListener('mouseleave', hideTip);
      });
    });
  }

  // Two bars per series inside each group: a faint outlined bar (a) beside a solid
  // one (b). series: [{name, color, a:[v|null], b:[v|null], note:(gi)=>string}]
  function pairChart(host, cfg) {
    responsive(host, () => {
      const series = cfg.series.filter(s => !cfg.hidden?.has(s.name));
      const W = Math.max(280, host.clientWidth), H = cfg.height || CHART_H;
      const m = {t: 26, r: 14, b: 40, l: 48};
      const iw = W - m.l - m.r, ih = H - m.t - m.b, n = cfg.groups.length, band = iw / n, k = Math.max(1, series.length);
      const vals = series.flatMap(s => [...s.a, ...s.b].filter(v => v != null));
      const t = ticks(0, Math.max(...vals, 0));
      const hi = t[t.length - 1], y = v => m.t + ih - v / hi * ih;
      const bw = Math.min(22, band * .86 / (k * 2 + (k - 1) * .7)), pairGap = bw * .7, gap = Math.min(1.5, bw * .1);
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.label)}">`;
      svg += t.map(v => `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'ax-zero' : 'ax-grid'}"/><text x="${m.l - 7}" y="${y(v) + 4}" class="ax-y">${esc(cfg.axisFmt(v))}</text>`).join('');
      const keyX = m.l + iw - 4;
      svg += `<g class="pair-key"><rect x="${keyX - 196}" y="${m.t - 17}" width="9" height="9" class="pair-a" style="stroke:var(--ml-ink);fill:var(--ml-ink)"/><text x="${keyX - 183}" y="${m.t - 9}">${esc(cfg.aLabel)}</text>`
        + `<rect x="${keyX - 84}" y="${m.t - 17}" width="9" height="9" style="fill:var(--ml-ink)"/><text x="${keyX - 71}" y="${m.t - 9}">${esc(cfg.bLabel)}</text></g>`;
      cfg.groups.forEach((g, gi) => {
        const left = m.l + gi * band + (band - (k * 2 * bw + (k - 1) * pairGap)) / 2;
        series.forEach((s, si) => {
          [['a', s.a[gi]], ['b', s.b[gi]]].forEach(([which, v], wi) => {
            if (v == null) return;
            const bx = left + si * (2 * bw + pairGap) + wi * bw + gap / 2, w = bw - gap;
            svg += `<rect x="${bx}" y="${y(v)}" width="${w}" height="${Math.max(0, y(0) - y(v))}" style="fill:${s.color};stroke:${s.color}" class="col${which === 'a' ? ' pair-a' : ''}"/>`;
            if (w >= 18) svg += `<text x="${bx + w / 2}" y="${y(v) - 4}" class="col-label" style="fill:${s.color}">${esc(cfg.labelFmt(v))}</text>`;
          });
        });
        svg += `<text x="${m.l + (gi + .5) * band}" y="${H - m.b + 16}" class="ax-x">${esc(g.label)}</text>`;
        svg += `<rect class="hover-band" data-i="${gi}" x="${m.l + gi * band}" y="${m.t - 18}" width="${band}" height="${ih + 18}"/>`;
      });
      host.innerHTML = svg + '</svg>';
      host.querySelectorAll('.hover-band').forEach(r => {
        const gi = Number(r.dataset.i);
        r.addEventListener('mousemove', evt => {
          const rows = series.filter(s => s.a[gi] != null || s.b[gi] != null)
            .map(s => ({name: s.name, color: s.color, text: `${cfg.fmt(s.b[gi])} vs ${cfg.fmt(s.a[gi])}`, e: true, note: s.note(gi)}));
          showTip(evt, tipRows(`${cfg.groups[gi].title}: ${cfg.bLabel} vs ${cfg.aLabel}`, rows));
        });
        r.addEventListener('mouseleave', hideTip);
      });
    });
  }

  // ---------- figures table: same numbers the chart plots ----------
  // rowGroups: [{name, color, rows:[{label, cells:[{v,e,text,vs}|null], fmt}]}]
  // A cell's vs line (estimate before the report) prints small under the reported value.
  function figuresTable(host, {columns, rowGroups, caption}) {
    const head = `<tr><th scope="col" class="sticky">${esc(caption || '')}</th><th scope="col" class="metric-col"></th>${columns.map(c => `<th scope="col" class="${c.estimate ? 'est' : ''}${c.divider ? ' divider' : ''}">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</th>`).join('')}</tr>`;
    const body = rowGroups.map(g => g.rows.map((r, ri) => `<tr class="${ri === 0 ? 'group-start' : ''}">${ri === 0 ? `<th scope="rowgroup" rowspan="${g.rows.length}" class="sticky" style="color:${g.color}">${esc(g.name)}</th>` : ''}<td class="metric-col">${esc(r.label)}</td>${r.cells.map((c, i) => `<td class="${c && c.e ? 'est' : ''}${c && c.vs ? ' has-vs' : ''}${columns[i].divider ? ' divider' : ''}">${c == null || c.v == null ? '<span class="nd">–</span>' : esc(c.text ?? r.fmt(c.v)) + (c.vs ? `<small class="vs">${esc(c.vs)}</small>` : '')}</td>`).join('')}</tr>`).join('')).join('');
    host.innerHTML = `<div class="figures-scroll"><table class="figures-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function segmented(host, options, value, onChange) {
    host.innerHTML = options.map(o => `<button type="button" data-v="${esc(o[0])}" aria-pressed="${o[0] === value}">${esc(o[1])}</button>`).join('');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onChange(b.dataset.v)));
  }

  const dividerFlags = columns => {
    const first = columns.findIndex(c => c.estimate);
    return columns.map((c, i) => ({...c, divider: i === first}));
  };

  // Estimate beside a reported value: "est $41.0B, -17%". When either side is
  // negative a percent means nothing, so the gap is shown in units instead.
  const vsLine = (actual, est, fmt) => est == null || actual == null ? '' : `est ${fmt(est)}, ` +
    (actual > 0 && est > 0 ? fmtPct((actual / est - 1) * 100, 0) : (actual >= est ? '+' : '-') + fmt(Math.abs(actual - est)).replace(/^-/, ''));

  window.CompChart = {lineChart, columnChart, pairChart, figuresTable, legend, segmented, dividerFlags, vsLine, fmtB, fmtPct, COLORS, esc};

  // ---------- clean view: hide the option buttons so a chart screenshots clean ----------
  const CLEAN_KEY = 'equinox.capacity.clean';
  const comps = document.querySelector('.comps');
  const cleanBtn = document.querySelector('[data-clean-toggle]');
  if (comps && cleanBtn) {
    const setClean = on => {
      comps.classList.toggle('clean', on);
      cleanBtn.setAttribute('aria-pressed', String(on));
      cleanBtn.textContent = on ? 'Show buttons' : 'Hide buttons';
      try { localStorage.setItem(CLEAN_KEY, on ? '1' : '0'); } catch (_) {}
    };
    let start = false;
    try { start = localStorage.getItem(CLEAN_KEY) === '1'; } catch (_) {}
    setClean(start);
    cleanBtn.addEventListener('click', () => setClean(!comps.classList.contains('clean')));
    addEventListener('keydown', e => {
      if (e.key !== 'h' || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      setClean(!comps.classList.contains('clean'));
    });
  }

  // ---------- cloud + capex from Hyperscaler Comps.xlsx ----------
  const data = window.compsData;
  if (!data) return;
  const ACTUALS = window.capacityActuals?.entries || [];
  // A reported actual replaces the workbook estimate for that quarter and keeps the
  // estimate as est, so tables and tooltips can show both.
  ACTUALS.filter(a => a.actual != null).forEach(a => {
    const m = data.companies.find(c => c.name === a.company)?.metrics[a.metric];
    if (m) m.series[a.quarter] = {...m.series[a.quarter], v: a.actual, e: false, est: a.estimate};
  });
  const quarterKey = (y, q) => `${y} Q${q}`;
  const prevYearKey = k => quarterKey(Number(k.slice(0, 4)) - 1, k.slice(-1));
  const periodObj = k => ({key: k, label: 'Q' + k.slice(-1), year: k.slice(0, 4), title: `${k.slice(0, 4)} Q${k.slice(-1)} (calendar)`});
  const state = {cloudMode: 'yoy', cloudBasis: 'est', cloudHidden: new Set()};

  // "Reported only" drops every estimate point, so each company stops at its own
  // latest reported quarter (one early reporter runs a quarter past the rest).
  const onBasis = (raw, basis) => basis === 'rep' ? Object.fromEntries(Object.entries(raw).filter(([, p]) => !p.e)) : raw;
  const BASIS = [['rep', 'Reported only'], ['est', 'With estimates']];
  const allQuarters = seriesList => [...new Set(seriesList.flatMap(s => Object.keys(s)))].sort();
  const markPeriods = (keys, seriesList) => keys.map(k => ({...periodObj(k), estimate: seriesList.every(s => !s[k] || s[k].e)}));
  // Microsoft and Oracle fiscal years differ from the calendar; say which company quarter a point is.
  const fiscalNote = (owner, p) => p && p.fiscal && /^(Microsoft|Oracle)$/.test(owner) ? `Company ${p.fiscal}` : '';
  const vsB = p => p && p.est != null ? vsLine(p.v, p.est, fmtB) : '';
  const joinNotes = (...parts) => parts.filter(Boolean).join('; ');
  const withVs = p => p ? {...p, vs: vsB(p)} : null;

  const cloudSeries = () => data.companies.filter(c => c.metrics.cloud).map(c => ({
    name: c.metrics.cloud.label, owner: c.name, color: COLORS[c.name] || 'var(--benchmark)', raw: c.metrics.cloud.series}));
  // Capex and free cash flow share one renderer; only the source row differs.
  const flowSeries = key => data.companies.filter(c => c.metrics[key]).map(c => ({
    name: c.name === 'SpaceX' ? (key === 'capex' ? 'SpaceX (AI)' : 'SpaceX') : c.name,
    short: c.name === 'SpaceX' && key === 'capex' ? 'SpaceX AI' : c.name, owner: c.name,
    color: COLORS[c.name] || 'var(--benchmark)', raw: c.metrics[key].series, field: c.metrics[key].label}));
  // Growth needs both periods positive. A reported quarter also carries the growth its estimate implied.
  const yoy = (raw, k) => {
    const cur = raw[k], base = raw[prevYearKey(k)];
    if (!cur || !base || !(base.v > 0) || !(cur.v > 0)) return null;
    return {v: (cur.v / base.v - 1) * 100, e: cur.e, vs: cur.est > 0 ? 'est ' + fmtPct((cur.est / base.v - 1) * 100, 0) : ''};
  };
  const quarterColumns = periods => dividerFlags(periods.map(p => ({label: `${p.label} '${p.year.slice(2)}`, estimate: p.estimate})));
  const pctCell = v => fmtPct(v, 0);

  function renderCloud() {
    const panel = document.querySelector('#cloudPanel');
    const full = cloudSeries();
    const list = full.map(s => ({...s, raw: onBasis(s.raw, state.cloudBasis)}));
    const reported = state.cloudBasis === 'rep';
    const yoyMode = state.cloudMode === 'yoy';
    const keys = allQuarters(list.map(s => s.raw)).filter(k => !yoyMode || list.some(s => yoy(s.raw, k)));
    const periods = markPeriods(keys, list.map(s => s.raw));
    const series = list.map(s => ({...s, points: keys.map(k => {
      const p = yoyMode ? yoy(s.raw, k) : s.raw[k];
      return p ? {v: p.v, e: p.e, note: joinNotes(fiscalNote(s.owner, s.raw[k]), yoyMode ? p.vs : vsB(p))} : null;
    })}));
    segmented(panel.querySelector('[data-ctl=mode]'), [['yoy', 'YoY growth'], ['rev', 'Revenue $B']], state.cloudMode, v => { state.cloudMode = v; renderCloud(); });
    segmented(panel.querySelector('[data-ctl=basis]'), BASIS, state.cloudBasis, v => { state.cloudBasis = v; renderCloud(); });
    legend(panel.querySelector('.comp-legend'), series, state.cloudHidden, renderCloud);
    panel.querySelector('.panel-heading p').textContent = (yoyMode ? 'Cloud segment revenue, year-over-year %' : 'Cloud segment revenue, $B per quarter') + (reported ? ', reported only' : '');
    lineChart(panel.querySelector('.comp-chart'), {
      label: 'Cloud growth comps', periods, series, hidden: state.cloudHidden,
      fmt: (v, long) => yoyMode ? fmtPct(v, long ? 1 : 0) : fmtB(v), axisFmt: v => yoyMode ? v + '%' : '$' + v + 'B',
    });
    // The table always shows every quarter, reported and estimated, whatever the chart shows.
    const allKeys = allQuarters(full.map(s => s.raw));
    figuresTable(document.querySelector('#cloudTable'), {caption: 'Quarterly', columns: quarterColumns(markPeriods(allKeys, full.map(s => s.raw))), rowGroups: full.map(s => ({
      name: `${s.name} · ${s.owner}`, color: s.color, rows: [
        {label: 'Revenue', fmt: fmtB, cells: allKeys.map(k => withVs(s.raw[k]))},
        {label: 'YoY', fmt: pctCell, cells: allKeys.map(k => yoy(s.raw, k))},
      ]}))});
  }

  // Sum of a run of quarters. Null unless every quarter is present.
  function sumQuarters(raw, keys) {
    const parts = keys.map(k => raw[k]);
    if (parts.some(p => !p)) return null;
    const nEst = parts.filter(p => p.e).length;
    return {v: parts.reduce((a, p) => a + p.v, 0), e: nEst > 0, parts: parts.map(p => ({v: p.v, e: p.e})), note: nEst && nEst < parts.length ? `${parts.length - nEst} reported + ${nEst} estimated quarters` : ''};
  }
  const yearKeys = year => [1, 2, 3, 4].map(q => quarterKey(year, q));
  const trailingKeys = k => { const y = Number(k.slice(0, 4)), q = Number(k.slice(-1)); return [3, 2, 1, 0].map(b => { const n = (y * 4 + q - 1) - b; return quarterKey(Math.floor(n / 4), n % 4 + 1); }); };
  const growth = (a, b) => a && b && b.v > 0 && a.v > 0 ? {v: (a.v / b.v - 1) * 100, e: a.e} : null;

  const FLOWS = {
    capex: {panel: '#capexPanel', table: '#capexTable', method: '#capexMethod', what: 'Capital expenditures', row: 'Capex',
      modes: [['quarterly', 'Quarterly'], ['annual', 'Calendar year']],
      note: 'Spend shown as a positive number.'},
    fcf: {panel: '#fcfPanel', table: '#fcfTable', method: '#fcfMethod', what: 'Free cash flow', row: 'FCF',
      modes: [['annual', 'Calendar year'], ['ttm', 'Trailing 4 quarters'], ['quarterly', 'Quarterly']],
      note: 'Free cash flow is cash from operations minus capex, as each company or Bloomberg defines it. SpaceX is the whole company, not only its AI unit. Trailing 4 quarters smooths out seasonal swings.'},
  };
  const flowState = {capex: {mode: 'quarterly', basis: 'est', hidden: new Set()}, fcf: {mode: 'annual', basis: 'est', hidden: new Set()}};

  function renderFlow(key) {
    const cfg = FLOWS[key], st = flowState[key], again = () => renderFlow(key);
    const panel = document.querySelector(cfg.panel);
    const list = flowSeries(key).map(s => ({...s, raw: onBasis(s.raw, st.basis)}));
    const reported = st.basis === 'rep';
    segmented(panel.querySelector('[data-ctl=mode]'), cfg.modes, st.mode, v => { st.mode = v; again(); });
    segmented(panel.querySelector('[data-ctl=basis]'), BASIS, st.basis, v => { st.basis = v; again(); });
    const unit = {quarterly: '$B per quarter', ttm: '$B, trailing 4 quarters', annual: '$B per calendar year'}[st.mode];
    panel.querySelector('.panel-heading p').textContent = `${cfg.what}, ${unit}${reported ? ', reported only' : ''}`;
    const host = panel.querySelector('.comp-chart');
    const keys = allQuarters(list.map(s => s.raw));
    if (st.mode === 'annual') {
      const years = [...new Set(keys.map(k => k.slice(0, 4)))].filter(y => list.some(s => sumQuarters(s.raw, yearKeys(y))));
      const series = list.map(s => ({...s, values: years.map(y => sumQuarters(s.raw, yearKeys(y)))}));
      legend(panel.querySelector('.comp-legend'), series, st.hidden, again);
      const groups = years.map(y => ({label: y, title: `Calendar ${y}`, estimate: series.every(s => { const a = s.values[years.indexOf(y)]; return !a || a.parts.every(p => p.e); })}));
      columnChart(host, {label: `${cfg.what}, calendar year`, groups, series, hidden: st.hidden, fmt: fmtB, labelFmt: v => Math.round(v).toString(), axisFmt: axisB});
    } else {
      const ttm = st.mode === 'ttm';
      const value = (s, k) => ttm ? sumQuarters(s.raw, trailingKeys(k)) : s.raw[k] || null;
      const shown = keys.filter(k => list.some(s => value(s, k)));
      const periods = markPeriods(shown, list.map(s => s.raw));
      const series = list.map(s => ({...s, points: shown.map(k => { const p = value(s, k); return p ? {v: p.v, e: p.e, note: p.note || joinNotes(fiscalNote(s.owner, s.raw[k]), vsB(p))} : null; })}));
      legend(panel.querySelector('.comp-legend'), series, st.hidden, again);
      lineChart(host, {label: `${cfg.what}, ${ttm ? 'trailing 4 quarters' : 'quarterly'}`, periods, series, hidden: st.hidden, fmt: fmtB, axisFmt: axisB});
    }
    flowTables(key);
    document.querySelector(cfg.method).textContent = `${cfg.note} Line items differ by company: ${list.map(s => `${s.owner}, ${s.field.trim()}`).join('; ')}. A calendar year needs all four quarters; a year that mixes reported and estimated quarters counts as an estimate. Growth is left blank when either period is negative. Under a reported quarter, the small line is the estimate this page showed before the report.`;
  }

  // Quarterly and calendar-year tables, always every period, whatever the chart shows.
  function flowTables(key) {
    const cfg = FLOWS[key], list = flowSeries(key), host = document.querySelector(cfg.table);
    const keys = allQuarters(list.map(s => s.raw));
    if (!host.querySelector('[data-part]')) host.innerHTML = '<div data-part="q"></div><div data-part="y"></div>';
    figuresTable(host.querySelector('[data-part=q]'), {caption: 'Quarterly', columns: quarterColumns(markPeriods(keys, list.map(s => s.raw))), rowGroups: list.map(s => ({
      name: s.name, color: s.color, rows: [
        {label: cfg.row, fmt: fmtB, cells: keys.map(k => withVs(s.raw[k]))},
        {label: 'YoY', fmt: pctCell, cells: keys.map(k => yoy(s.raw, k))},
      ]}))});
    const years = [...new Set(keys.map(k => k.slice(0, 4)))].filter(y => list.some(s => sumQuarters(s.raw, yearKeys(y))));
    const cols = dividerFlags(years.map(y => ({label: 'CY' + y, estimate: list.some(s => sumQuarters(s.raw, yearKeys(y))?.e)})));
    figuresTable(host.querySelector('[data-part=y]'), {caption: 'Calendar year', columns: cols, rowGroups: list.map(s => ({
      name: s.name, color: s.color, rows: [
        {label: cfg.row, fmt: fmtB, cells: years.map(y => sumQuarters(s.raw, yearKeys(y)))},
        {label: 'YoY', fmt: pctCell, cells: years.map(y => growth(sumQuarters(s.raw, yearKeys(y)), sumQuarters(s.raw, yearKeys(y - 1))))},
      ]}))});
  }

  // ---------- capex growth: year-over-year % by calendar quarter ----------
  // SpaceX AI capex starts from a tiny 2025 base (+2,000% in Q2 2026), which would
  // flatten every other line, so it starts hidden; its key brings it back.
  const growthState = {basis: 'est', hidden: new Set(['SpaceX (AI)'])};
  function renderCapexGrowth() {
    const panel = document.querySelector('#capexGrowthPanel');
    if (!panel) return;
    const again = renderCapexGrowth;
    const list = flowSeries('capex').map(s => ({...s, raw: onBasis(s.raw, growthState.basis)}));
    const keys = allQuarters(list.map(s => s.raw)).filter(k => list.some(s => yoy(s.raw, k)));
    const periods = markPeriods(keys, list.map(s => s.raw));
    const series = list.map(s => ({...s, points: keys.map(k => { const p = yoy(s.raw, k); return p ? {v: p.v, e: p.e, note: joinNotes(fiscalNote(s.owner, s.raw[k]), p.vs)} : null; })}));
    segmented(panel.querySelector('[data-ctl=basis]'), BASIS, growthState.basis, v => { growthState.basis = v; again(); });
    legend(panel.querySelector('.comp-legend'), series, growthState.hidden, again);
    panel.querySelector('.panel-heading p').textContent = `Capital expenditures, year-over-year % by calendar quarter${growthState.basis === 'rep' ? ', reported only' : ''}`;
    lineChart(panel.querySelector('.comp-chart'), {label: 'Capex growth', periods, series, hidden: growthState.hidden,
      fmt: (v, long) => fmtPct(v, long ? 1 : 0), axisFmt: v => v + '%'});
  }

  // ---------- estimates vs actuals ledger ----------
  const METRIC = {capex: ['Capex', fmtB], fcf: ['Free cash flow', fmtB], cloud: ['Cloud revenue', fmtB],
    capacity: ['Capacity added', v => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' GW']};
  const shortDate = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}); };
  function renderActuals() {
    const host = document.querySelector('#actualsTable');
    if (!host) return;
    const done = ACTUALS.filter(a => a.actual != null).sort((a, b) => (b.reported || '').localeCompare(a.reported || ''));
    const waiting = ACTUALS.filter(a => a.actual == null).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || a.company.localeCompare(b.company));
    const name = a => a.company === 'SpaceX' && a.metric === 'capex' ? 'SpaceX (AI)' : a.company;
    const row = a => {
      const [label, fmt] = METRIC[a.metric] || [a.metric, fmtB];
      const color = COLORS[a.company] || 'var(--benchmark)';
      const reported = a.actual != null;
      const gap = reported ? vsLine(a.actual, a.estimate, fmt).replace(/^est [^,]+, /, '') : '';
      return `<tr class="${reported ? '' : 'waiting'}"><th scope="row" class="sticky" style="color:${color}">${esc(name(a))}</th>`
        + `<td class="metric-col">${esc(label)}</td><td>${esc(a.quarter.slice(5) + " '" + a.quarter.slice(2, 4))}</td>`
        + `<td class="est">${a.estimate == null ? '<span class="nd">–</span>' : esc(fmt(a.estimate))}</td>`
        + `<td>${reported ? esc(fmt(a.actual)) : '<span class="nd">–</span>'}</td>`
        + `<td>${reported ? esc(gap) : ''}</td>`
        + `<td class="ledger-note"${a.source ? ` title="${esc(a.source)}"` : ''}>${reported ? 'reported ' + esc(shortDate(a.reported)) + (a.source ? ' <span class="ledger-i" aria-hidden="true">i</span>' : '') : (a.due ? 'reports ' + esc(shortDate(a.due)) : 'next report')}</td></tr>`;
    };
    host.innerHTML = `<div class="figures-scroll"><table class="figures-table ledger-table"><thead><tr><th scope="col" class="sticky">Company</th><th scope="col" class="metric-col">Metric</th><th scope="col">Quarter</th><th scope="col" class="est">Estimate</th><th scope="col">Actual</th><th scope="col">Actual vs est</th><th scope="col" class="ledger-note"></th></tr></thead>`
      + `<tbody>${done.map(row).join('')}${waiting.map(row).join('')}</tbody></table></div>`;
  }

  const d = new Date(data.updatedAt);
  const stamp = isNaN(d) ? data.updatedAt : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
  document.querySelectorAll('[data-comps-source]').forEach(el => { el.textContent = `Cloud, capex and cash flow from ${data.workbook}, saved ${stamp}`; });
  renderCloud();
  renderFlow('capex');
  renderCapexGrowth();
  renderFlow('fcf');
  renderActuals();
})();
