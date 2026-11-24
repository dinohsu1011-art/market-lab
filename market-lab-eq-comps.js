/* Comps: a short list of tickers side by side. Fundamentals come from the same financials files and the
   same arithmetic as the Company page; technicals from the same published readings, so the two pages agree.
   The list lives in the address (#NVDA,AMD,AVGO) and in equinox.comps.tickers.v1. */
(() => {
  const { $, css, pct, tone, num, day, esc, json, trend, prices, href, pick, finder, onRedraw } = EQ;
  const KEY = 'equinox.comps.tickers.v1', MAX = 8, START = ['NVDA', 'AMD', 'AVGO'];
  const TINT = ['--accent', '#c2851a', '#8a63d2', '#1f9d94', '#cf5f93', '#7d9a2e', '#dd6b3a', '--muted'];
  const SECTIONS = ['fundamentals', 'technicals', 'together'], KINDS = ['equity', 'asset', 'etf'];
  let T = null, TI = null, OX = null, FIN = new Set(), list = [], missing = [], run = 0, ready = false;
  const D = {}, BENCH = {};

  // formatting, the same shapes the Company page prints
  const money = v => v == null || !isFinite(v) ? '' : (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1e3 ? (Math.abs(v) / 1e3).toFixed(1) + 'B' : Math.abs(v).toFixed(0) + 'M');
  const usd = v => v == null || !isFinite(v) ? '' : (v < 0 ? '−' : '') + '$' + num(Math.abs(v));
  const share = v => v == null || !isFinite(v) ? '' : v.toFixed(1) + '%';
  const col = id => { const t = TINT[Math.max(0, list.indexOf(id)) % TINT.length]; return t.startsWith('--') ? css(t) : t; };
  const sw = id => `<i class="cx-sw" style="background:${col(id)}"></i>`;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const read = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const readJ = k => { try { return JSON.parse(read(k)); } catch (_) { return null; } };

  // which series a typed ticker means: stocks first, then funds and indexes
  const ok = x => KINDS.includes(x.kind) && x.mode === 'log';
  const find = tok => { const up = String(tok).toUpperCase();
    return T.series.find(x => x.id === tok && ok(x)) || T.series.find(x => x.id.toUpperCase() === up && (x.kind === 'equity' || x.kind === 'asset') && ok(x)) ||
      T.series.find(x => (x.id.toUpperCase() === up || String(x.stem || '').toUpperCase() === up) && ok(x)); };
  const symOf = S => S.kind === 'etf' ? String(S.stem || S.id).toUpperCase() : S.id;
  const nameOf = (S, sym) => S.label.startsWith(sym + ' · ') ? S.label.slice(sym.length + 3) : S.label.endsWith(' · ' + sym) ? S.label.slice(0, -sym.length - 3) : S.label === sym ? '' : S.label;

  // every reading that is worked out from the full price history
  function derive(p) {
    const c = p.close, N = c.length, rsi = Array(N).fill(null), dd = Array(N).fill(null); let up = 0, dn = 0, m = 0;
    for (let i = 1; i < N; i++) { const ch = c[i] - c[i - 1], u = Math.max(ch, 0), w = Math.max(-ch, 0);
      if (i <= 14) { up += u / 14; dn += w / 14; } else { up = (up * 13 + u) / 14; dn = (dn * 13 + w) / 14; }
      if (i >= 14) rsi[i] = dn ? 100 - 100 / (1 + up / dn) : 100; }
    for (let i = 0; i < N; i++) { if (c[i] >= c[m]) m = i; dd[i] = (c[i] / c[m] - 1) * 100; }
    const gap = n => { const e = window.MarketLabTrendMath ? MarketLabTrendMath.ema(c, n) : []; return c.map((v, i) => e[i] ? (v / e[i] - 1) * 100 : null); };
    return { rsi, dd, gap: { 10: gap(10), 21: gap(21), 50: gap(50), 200: gap(200) }, high: m };
  }
  async function loadOne(id) {
    if (D[id]) return D[id];
    const S = T.series.find(x => x.id === id); if (!S) return null;
    const al = TI && TI.aliases || {}, tr = TI && (TI.rows[id] || TI.rows[al[id]] || TI.rows[al[id.toLowerCase()]]);
    const [p, tech, fin] = await Promise.all([prices(S.file).catch(() => null), tr ? json('cube/' + tr.file).catch(() => null) : null,
      FIN.has(id) ? json(`financials/${encodeURIComponent(id)}.json`).catch(() => null) : null]);
    if (!p || p.close.length < 2) return null;
    const sym = symOf(S), f = fin && fin.lines && fin.quarters && fin.lines.rev ? fin : null;
    return D[id] = { id, sym, name: nameOf(S, sym), p, m: derive(p), t: tech && tech.daily && tech.daily.latest || null, ox: OX && (OX[id] || OX[id.toLowerCase()]) || null, fin: f };
  }
  const have = () => list.map(id => D[id]).filter(Boolean);

  // ---------- the list itself ----------
  // Tickers are added from the search box in the left menu and removed from the key above the first chart.
  function paintSide() {
    const full = list.length >= MAX, inp = $('find').querySelector('input');
    inp.disabled = full; inp.placeholder = full ? 'Eight is the most at once' : 'Add a ticker';
    $('miss').textContent = missing.length ? 'No prices on file for ' + missing.join(', ') : ''; $('miss').hidden = !missing.length;
  }
  const sync = () => { store(KEY, JSON.stringify(list));
    const h = '#' + list.map(id => D[id] ? D[id].sym : id).join(','); if (location.hash !== h) history.replaceState(null, '', list.length ? h : location.pathname + location.search); };
  async function setList(tokens, keepMissing) {
    const me = ++run, ids = [], bad = [];
    tokens.forEach(t => { const S = find(t); if (!S) bad.push(String(t).toUpperCase()); else if (!ids.includes(S.id) && ids.length < MAX) ids.push(S.id); });
    const got = await Promise.all(ids.map(loadOne)); if (me !== run) return;
    list = ids.filter((id, i) => got[i] || (bad.push(id), false)); missing = keepMissing === false ? [] : bad;
    ready = true; sync(); render();
  }

  // ---------- dropdown menus, drawn like the ones in the title bar ----------
  // o = {value: () => text on the button, cols: () => [{head, radio, items: [{k, label, tip, on, off, note}], scroll, after}],
  // pick: (column, key) => 'close' to shut the menu, change: element => a select or date box inside it changed}.
  const CK = '<svg class="ck" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 6.4l2.3 2.3 4.7-5.2"/></svg>';
  const CHEV = '<svg class="cv" viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>';
  let opened = null, ddN = 0;
  function dd(host, title, o) {
    const id = 'cxdd' + ++ddN;
    host.innerHTML = `<button type="button" class="cx-dd-btn" aria-expanded="false" aria-controls="${id}"><span>${esc(title)}</span><b class="cx-dd-v"></b>${CHEV}</button>` +
      `<div class="cx-dd-panel" id="${id}" role="group" aria-label="${esc(title)}"><div class="cx-dd-sheet"></div></div>`;
    const btn = host.firstElementChild, panel = btn.nextElementSibling, sheet = panel.firstElementChild, M = { host, btn, panel, sheet, open: false };
    M.paint = () => {
      btn.querySelector('.cx-dd-v').textContent = o.value();
      const html = o.cols().map((c, ci) => `<div class="cx-dd-list" role="${c.radio ? 'radiogroup' : 'group'}" aria-label="${esc(c.head)}"><div class="cx-dd-head">${esc(c.head)}</div>` +
        (c.items.length ? `<div class="cx-dd-items${c.scroll ? ' cx-dd-scroll' : ''}">` + c.items.map(it => `<button type="button" class="cx-dd-item" role="${c.radio ? 'radio' : 'checkbox'}" aria-checked="${!!it.on}" data-c="${ci}" data-k="${esc(it.k)}"${it.off ? ' disabled' : ''}${it.tip ? ` title="${esc(it.tip)}"` : ''}>${CK}<span>${esc(it.label)}</span>${it.note ? `<small>${esc(it.note)}</small>` : ''}</button>`).join('') + '</div>' : '') +
        (c.after || '') + '</div>').join('');
      if (sheet._html === html) return;
      const a = document.activeElement, inside = a && sheet.contains(a);
      const fk = !inside ? null : a.dataset.k != null ? `[data-c="${a.dataset.c}"][data-k="${CSS.escape(a.dataset.k)}"]` : a.name ? `[name="${a.name}"]` : null;
      const sc = [...sheet.querySelectorAll('.cx-dd-scroll')].map(s => s.scrollTop);
      sheet.innerHTML = sheet._html = html;
      sheet.querySelectorAll('.cx-dd-scroll').forEach((s, i) => { s.scrollTop = sc[i] || 0; });
      if (fk) { const f = sheet.querySelector(fk); if (f) f.focus({ preventScroll: true }); }
      if (M.open) place(M);
    };
    btn.addEventListener('click', () => M.open ? shut(M) : show(M));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); if (!M.open) show(M); step(M, 0); } });
    panel.addEventListener('click', e => { const b = e.target.closest('.cx-dd-item'); if (!b || b.disabled) return;
      if (o.pick(+b.dataset.c, b.dataset.k) === 'close') shut(M, true); });
    panel.addEventListener('change', e => { if (o.change) o.change(e.target); });
    panel.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!e.target.closest('.cx-dd-item')) return; e.preventDefault(); step(M, e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Home' || e.key === 'End') { if (!e.target.closest('.cx-dd-item')) return; e.preventDefault(); step(M, e.key === 'Home' ? 'first' : 'last'); } });
    host.addEventListener('focusout', e => { if (M.open && e.relatedTarget && !host.contains(e.relatedTarget)) shut(M); });
    return M;
  }
  function place(M) {
    const r = M.btn.getBoundingClientRect(), p = M.panel, w = p.offsetWidth, h = M.sheet.scrollHeight + 2, below = innerHeight - r.bottom - 14, above = r.top - 14;
    p.style.left = Math.max(8, Math.min(r.left - 10, innerWidth - w - 8)) + 'px';
    if (h > below && above > below) { const m = Math.min(h, above); p.style.top = (r.top - 4 - m) + 'px'; M.sheet.style.maxHeight = m + 'px'; }
    else { p.style.top = (r.bottom + 4) + 'px'; M.sheet.style.maxHeight = Math.max(160, below) + 'px'; }
  }
  function show(M) { if (opened && opened !== M) shut(opened); M.paint(); M.open = true; opened = M; place(M);
    M.panel.classList.add('open'); M.btn.classList.add('open'); M.btn.setAttribute('aria-expanded', 'true'); }
  function shut(M, focus) { if (!M || !M.open) return; M.open = false; if (opened === M) opened = null;
    M.panel.classList.remove('open'); M.btn.classList.remove('open'); M.btn.setAttribute('aria-expanded', 'false'); if (focus) M.btn.focus({ preventScroll: true }); }
  function step(M, d) {
    const it = [...M.panel.querySelectorAll('.cx-dd-item:not(:disabled)')]; if (!it.length) return;
    const i = it.indexOf(document.activeElement);
    const n = d === 0 ? Math.max(0, it.findIndex(b => b.getAttribute('aria-checked') === 'true')) : d === 'first' ? 0 : d === 'last' ? it.length - 1 : i < 0 ? 0 : (i + d + it.length) % it.length;
    it[n].focus();
  }
  document.addEventListener('pointerdown', e => { if (opened && !opened.host.contains(e.target)) shut(opened); }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && opened) { e.preventDefault(); shut(opened, true); } });
  addEventListener('scroll', e => { if (opened && !(e.target instanceof Node && opened.panel.contains(e.target))) shut(opened); }, true);
  addEventListener('resize', () => shut(opened));

  // ---------- one chart drawer for both sections ----------
  const nice = (lo, hi) => { const raw = (hi - lo || Math.abs(hi) || 1) / 5, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    const st = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, a = Math.floor(lo / st + 1e-9) * st, b = Math.ceil(hi / st - 1e-9) * st, t = [];
    for (let v = a; v <= b + st / 2; v += st) t.push(Math.abs(v) < st / 1e6 ? 0 : v); return { a, b, t, st }; };
  const niceUp = v => { const p = 10 ** Math.floor(Math.log10(v)), m = v / p * (1 - 1e-9); return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
  // the right-hand scale, cut into the same n steps as the left so both read off the same grid lines.
  // p is the step zero sits on at the left (counted from the bottom); given one, the two zeros share a line.
  function fitR(lo, hi, n, p) {
    if (p != null) { const st = niceUp(Math.max(hi > 0 ? hi / (n - p) : 0, lo < 0 ? -lo / p : 0, 1e-9)); return { a: -p * st, st }; }
    let st = niceUp((hi - lo || Math.abs(hi) || 1) / n);
    for (let k = 0; k < 30; k++) { const a = Math.floor(lo / st + 1e-9) * st; if (a + n * st >= hi - st * 1e-9) return { a, st }; st = niceUp(st * 1.001); }
    return { a: lo, st: (hi - lo) / n };
  }
  // c = {chart, key}. L = [{id, sym, v, none}]: every company, so the key can list them all. o = {kind: 'bar' | 'line',
  // ticks: [{i, t, row}] date labels, bounds: [i] period edges, fmt, tick, tone, dash, label, rm: remove buttons in the key,
  // padR: the least right margin, r: a second metric drawn as lines on its own right-hand scale, {L, fmt, tick, dash}}.
  function plot(c, L, x, o) {
    const el = c.chart, R = o.r, has = l => l.v.some(v => v != null), live = L.filter(has), rl = R ? R.L.filter(has) : [], N = x.length;
    const shown = (l, a) => live.includes(l) || !!(R && has(R.L[a]));
    const sig = L.map((l, a) => l.id + ':' + (l.none || (shown(l, a) ? '' : '-'))).join(',') + (o.rm ? '|x' : '') + (R ? '|r' : '');
    if (c.key._sig !== sig) { c.key._sig = sig;
      c.key.innerHTML = L.map((l, a) => { const none = l.none || (shown(l, a) ? '' : 'no data');
        return `<span class="k"><i style="background:${col(l.id)}"></i><a href="${href(l.id)}" title="Open ${esc(l.sym)} on the Company page">${esc(l.sym)}</a>${none ? `<em>${esc(none)}</em>` : '<b class="num"></b>'}` +
          (o.rm ? `<button type="button" class="cx-x" data-x="${esc(l.id)}" aria-label="Remove ${esc(l.sym)} from the list" title="Remove ${esc(l.sym)}">×</button>` : '') + '</span>'; }).join('') + '<span class="when"></span>'; }
    const bs = [...c.key.querySelectorAll('.k')].map(s => s.querySelector('b')), when = c.key.querySelector('.when');
    const keyAt = i => { L.forEach((l, a) => { const b = bs[a]; if (!b) return; const r = R && R.L[a].v, at = j => l.v[j] != null || (r && r[j] != null);
      let j = i == null ? N - 1 : i; if (i == null) while (j > 0 && !at(j)) j--;
      const v = l.v[j], w = r && r[j], late = i == null && j !== N - 1 ? ' in ' + x[j] : '';
      b.innerHTML = (v == null ? '' : esc(o.fmt(v))) + (w != null ? `${v == null ? '' : '<span class="sep"> · </span>'}<span class="${tone(w)}">${esc(R.fmt(w))}</span>` : '') + esc(v != null || w != null ? late : '');
      b.className = 'num' + (o.tone && v != null ? ' ' + tone(v) : ''); });
      when.textContent = x[i == null ? N - 1 : i] || ''; };
    el._g = null;
    if ((!live.length && !rl.length) || N < (o.kind === 'bar' ? 1 : 2)) { el.innerHTML = '<p class="wait">Nothing to chart for this choice.</p>'; keyAt(null); return; }
    const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
    const all = live.flatMap(l => l.v).filter(v => v != null); let lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
    if (o.kind === 'bar') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (o.dash != null && o.kind === 'line' && o.dash >= lo - (hi - lo) * .15 && o.dash <= hi + (hi - lo) * .15) { lo = Math.min(lo, o.dash); hi = Math.max(hi, o.dash); }
    const Y = nice(lo, hi); let Z = null;
    if (rl.length) { const rv = rl.flatMap(l => l.v).filter(v => v != null); let rlo = Math.min(...rv), rhi = Math.max(...rv), n = Y.t.length - 1;
      if (o.kind === 'bar') { // bars stand on zero, so growth gets its zero on that same line, with room added below or above if it needs it
        let p = Math.round(-Y.a / Y.st);
        if (p === 0 && rlo < 0) { const k = rhi > 0 ? Math.max(1, Math.round(n * -rlo / (rhi - rlo))) : n; Y.a -= k * Y.st; p = k; n += k; }
        else if (p === n && rhi > 0) { const k = rlo < 0 ? Math.max(1, Math.round(n * rhi / (rhi - rlo))) : n; Y.b += k * Y.st; n += k; }
        // a few more steps on top can let growth take a rounder, tighter scale; keep whichever fills both sides best
        let best = null; for (let e = 0; e <= 3; e++) { const z = fitR(rlo, rhi, n + e, p), fill = (rhi - rlo) / ((n + e) * z.st) * (hi - lo || 1) / ((n + e) * Y.st);
          if (!best || fill > best.fill * 1.05) best = { e, z, fill }; }
        Y.b += best.e * Y.st; n += best.e; Z = best.z;
        Y.t = []; for (let k = 0; k <= n; k++) { const v = Y.a + k * Y.st; Y.t.push(Math.abs(v) < Y.st / 1e6 ? 0 : v); }
      } else { if (R.dash != null && R.dash >= rlo - (rhi - rlo) * .15 && R.dash <= rhi + (rhi - rlo) * .15) { rlo = Math.min(rlo, R.dash); rhi = Math.max(rhi, R.dash); }
        Z = fitR(rlo, rhi, n, null); }
      Z.b = Z.a + n * Z.st; }
    const lab = Y.t.map(v => v === 0 && o.kind === 'bar' ? '0' : o.tick(v, Y.st));
    const rlab = Z ? Y.t.map((_, k) => { const v = Z.a + k * Z.st; return R.tick(Math.abs(v) < Z.st / 1e6 ? 0 : v, Z.st); }) : [];
    // the same margins on every stacked chart, so their dates line up
    const two = o.ticks.some(t => t.row), top = 10, left = Math.max(66, Math.max(...lab.map(t => t.length)) * 7 + 14), bottom = two ? 46 : 28;
    const right = Math.max(o.padR || 6, Z ? Math.max(...rlab.map(t => t.length)) * 7 + 16 : 0);
    const pw = W - left - right, ph = H - top - bottom, band = pw / N;
    const xi = o.kind === 'bar' ? i => left + band * (i + .5) : i => left + (N > 1 ? i / (N - 1) : .5) * pw;
    const y = v => top + (Y.b - v) / (Y.b - Y.a || 1) * ph, y2 = v => top + (Z.b - v) / (Z.b - Z.a || 1) * ph, base = top + ph;
    let g = Y.t.map((v, k) => `<line class="${v === 0 ? 'zero' : 'grid'}" x1="${left}" x2="${W - right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${left - 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(lab[k])}</text>` +
      (Z ? `<text class="r" x="${W - right + 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="start">${esc(rlab[k])}</text>` : '')).join('');
    const edge = i => o.kind === 'bar' ? left + band * i : xi(i) - (N > 1 ? pw / (N - 1) / 2 : 0);
    if (o.bounds) g += o.bounds.map(i => `<line class="qb" x1="${edge(i).toFixed(1)}" x2="${edge(i).toFixed(1)}" y1="${top}" y2="${base + (two ? 22 : 6)}"/>`).join('');
    g += `<line class="base" x1="${left}" x2="${W - right}" y1="${base}" y2="${base}"/>`;
    g += o.ticks.map(t => `<text class="${t.row ? 'q' : ''}" x="${(t.x != null ? t.x(edge, xi) : xi(t.i)).toFixed(1)}" y="${base + (t.row ? 38 : 19)}" text-anchor="middle">${esc(t.t)}</text>`).join('');
    if (o.dash != null && o.dash > Y.a && o.dash < Y.b) g += `<line class="ref" x1="${left}" x2="${W - right}" y1="${y(o.dash)}" y2="${y(o.dash)}"/>`;
    if (Z && o.kind !== 'bar' && R.dash != null && R.dash > Z.a && R.dash < Z.b) g += `<line class="ref" x1="${left}" x2="${W - right}" y1="${y2(R.dash)}" y2="${y2(R.dash)}"/>`;
    const stp = Math.max(1, Math.floor(N / (pw * 1.5)));
    const trace = (l, yf) => { let d = '', pen = false; l.v.forEach((v, i) => { if (i % stp && i !== N - 1) return; if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + xi(i).toFixed(1) + ' ' + yf(v).toFixed(1); pen = true; }); return d; };
    let marks = '';
    if (o.kind === 'bar') { const k = live.length, gw = Math.min(band * .74, k * 26), bw = gw / k;
      marks = live.map((l, a) => l.v.map((v, i) => { if (v == null) return ''; const x0 = xi(i) - gw / 2 + a * bw + (bw > 4 ? .75 : 0), w = Math.max(1, bw - (bw > 4 ? 1.5 : 0)), y0 = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
        return `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(2, w / 3).toFixed(1)}" fill="${col(l.id)}"${rl.length ? ' fill-opacity=".5"' : ''}/>`; }).join('')).join('');
    } else marks = live.slice().reverse().map(l => `<path d="${trace(l, y)}" fill="none" stroke="${col(l.id)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    // growth over bars: a solid line with a background-colored edge so it reads across its own bars; over lines, dashed
    const pts = o.kind === 'bar' && N <= 40;
    marks += rl.slice().reverse().map(l => { const d = trace(l, y2), c0 = col(l.id);
      return o.kind === 'bar' ? `<path class="halo" d="${d}"/><path d="${d}" fill="none" stroke="${c0}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>` +
        (pts ? l.v.map((v, i) => v == null ? '' : `<circle class="pt" cx="${xi(i).toFixed(1)}" cy="${y2(v).toFixed(1)}" r="3" fill="${c0}"/>`).join('') : '')
        : `<path d="${d}" fill="none" stroke="${c0}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`; }).join('');
    const dl = [...(o.kind === 'bar' ? [] : live.map(l => [l, y])), ...rl.map(l => [l, y2])];
    const hl = o.kind === 'bar' ? `<rect class="hl" x="0" y="${top}" width="${band.toFixed(1)}" height="${ph}" rx="4" opacity="0"/>` : '';
    const hair = dl.length ? `<g class="hair" opacity="0">${o.kind === 'bar' ? '' : `<line y1="${top}" y2="${base}"/>`}${dl.map(([l]) => `<circle r="4.5" fill="${col(l.id)}"/>`).join('')}</g>` : '';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}${hl}${marks}${hair}</svg>`;
    const hlE = el.querySelector('.hl'), hairE = el.querySelector('.hair'), rule = hairE && hairE.querySelector('line'), dots = hairE ? [...hairE.querySelectorAll('circle')] : [];
    el._g = { N, left, pw, band, bar: o.kind === 'bar', show: i => { keyAt(i);
      if (hlE) { if (i == null) hlE.setAttribute('opacity', 0); else { hlE.setAttribute('x', (left + band * i).toFixed(1)); hlE.setAttribute('opacity', 1); } }
      if (!hairE) return;
      if (i == null) { hairE.setAttribute('opacity', 0); return; }
      const X = xi(i).toFixed(1); hairE.setAttribute('opacity', 1); if (rule) { rule.setAttribute('x1', X); rule.setAttribute('x2', X); }
      dots.forEach((d, a) => { const [l, yf] = dl[a], v = l.v[i]; d.style.display = v == null ? 'none' : ''; if (v != null) { d.setAttribute('cx', X); d.setAttribute('cy', yf(v).toFixed(1)); } }); } };
    keyAt(null);
  }
  // One pointer moves the reading on every chart in a section, since they share the same dates.
  function hoverable(sec) {
    const gs = () => [...sec.querySelectorAll('.cx-chart')].map(c => c._g).filter(Boolean);
    sec.addEventListener('pointermove', e => { const ch = e.target.closest('.cx-chart'), G = ch && ch._g;
      if (!G) { gs().forEach(g => g.show(null)); return; }
      const px = e.clientX - ch.getBoundingClientRect().left, i = Math.max(0, Math.min(G.N - 1, G.bar ? Math.floor((px - G.left) / G.band) : Math.round((px - G.left) / G.pw * (G.N - 1))));
      gs().forEach(g => { if (g.N === G.N) g.show(i); }); });
    sec.addEventListener('pointerleave', () => gs().forEach(g => g.show(null)));
  }
  // one block per chart: a heading, the key, the chart. A spec is [key, name, tip, sub], or [key, '', '', sub, parts]
  // for a chart that holds two metrics, where each part {k, name, tip, mark: 'bar' | 'line'} gets its own remove button.
  const low = s => s.replace(/^[A-Z](?![A-Z])/, c => c.toLowerCase());
  const rmBtn = (k, name) => `<button type="button" class="cx-rm" data-rm="${k}" aria-label="Take ${esc(name)} off the chart" title="Take ${esc(name)} off the chart">×</button>`;
  function blocks(el, specs, many = specs.length > 1) {
    const sig = specs.map(s => s[0]).join(',') + (many ? '' : '|1');
    if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.dataset.n = specs.length;
      el.innerHTML = specs.map(([k, name, tip, sub, parts]) => `<div class="cx-one" data-k="${k}"><div class="cx-mh">` + (parts
        ? `<h3>${parts.map((p, i) => `${i ? '<span class="and">and</span>' : ''}<span class="part"${p.tip ? ` title="${esc(p.tip)}"` : ''}><i class="mk ${p.mark}" aria-hidden="true"></i>${esc(i ? low(p.name) : p.name)}</span>${rmBtn(p.k, p.name)}`).join('')}${sub ? ` <small>${esc(sub)}</small>` : ''}</h3>`
        : `<h3${tip ? ` title="${esc(tip)}"` : ''}>${esc(name)}${sub ? ` <small>${esc(sub)}</small>` : ''}</h3>` + (many ? rmBtn(k, name) : '')) +
        '</div><div class="cx-key"></div><div class="chart cx-chart"></div></div>').join(''); }
    return [...el.querySelectorAll('.cx-one')].map(b => ({ chart: b.querySelector('.cx-chart'), key: b.querySelector('.cx-key') }));
  }
  const flat = (el, msg) => { el.dataset.sig = ''; el.innerHTML = `<p class="wait">${msg}</p>`; };

  // dates along the bottom of a daily chart: months on the first row, calendar quarters under them
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yy = y => '’' + String(y).slice(2);
  function dayTicks(dates, el) {
    const N = dates.length, W = (el.clientWidth || 600) - 60, ym = d => +d.slice(0, 4) * 12 + +d.slice(5, 7) - 1, at = [];
    for (let i = 1; i < N; i++) if (ym(dates[i]) !== ym(dates[i - 1])) at.push(i);
    const months = at.length + 1, every = [1, 2, 3, 6, 12].find(m => months / m * 40 <= W) || 12, ticks = [], bounds = [];
    const qs = []; let s = 0; for (let i = 1; i <= N; i++) if (i === N || Math.floor(ym(dates[i]) / 3) !== Math.floor(ym(dates[i - 1]) / 3)) { qs.push([s, i - 1]); if (i < N) bounds.push(i); s = i; }
    const qpx = W / Math.max(1, N - 1) * (N / Math.max(1, qs.length));
    if (every <= 3) {
      at.forEach(i => { const m = ym(dates[i]) % 12; if (m % every === 0) ticks.push({ i, t: MON[m] }); });
      qs.forEach(([a, b]) => { if ((b - a + 1) / N * W < 42) return; const m = ym(dates[a]); ticks.push({ row: 1, t: `Q${Math.floor(m % 12 / 3) + 1} ${yy(Math.floor(m / 12))}`, x: (edge, xi) => (xi(a) + xi(b)) / 2 }); });
    } else {
      const yrs = at.filter(i => ym(dates[i]) % 12 === 0), skip = [1, 2, 5, 10].find(k => yrs.length / k * 44 <= W) || 10;
      yrs.forEach(i => { const y0 = +dates[i].slice(0, 4); if (y0 % skip === 0) ticks.push({ i, t: String(y0) }); });
      ticks.forEach(t => { t.row = 1; });
      if (qpx < 10) bounds.length = 0;
    }
    return { ticks, bounds };
  }
  // the time choices in a Timeframe menu
  const SPANS = { '1M': '1 month', '3M': '3 months', '6M': '6 months', YTD: 'This year so far', '1Y': '1 year', '2Y': '2 years', '3Y': '3 years', '5Y': '5 years', '10Y': '10 years', Max: 'All on file', Custom: 'Custom range' };

  // ---------- fundamentals ----------
  // FM and val() fill the tables; FX and the period rows below fill the charts.
  const FM = { rev: ['Revenue', money], yoy: ['Revenue growth', v => pct(v, 0), 'Revenue against the same quarter a year earlier'], gm: ['Gross margin', share, 'Gross profit as a share of revenue'], om: ['Operating margin', share, 'Operating income as a share of revenue'],
    ni: ['Net income', money], eps: ['Earnings per share', usd, 'Diluted earnings per share as reported'], adj: ['Adjusted EPS', usd, 'Earnings per share as the company adjusts it in its own results release'], fcf: ['Free cash flow', money, 'Cash from operations minus capital spending'] };
  const fcfRow = f => (f.kpi_groups || []).flatMap(g => g.rows || []).find(r => /^free cash flow$/i.test(r.name));
  const adjRow = f => (f.adjustments || []).find(a => a.unit === 'eps' && a.q);
  const val = (f, k, i) => { const L = f.lines, r = L.rev[i]; if (i < 0) return null;
    if (k === 'rev') return r; if (k === 'yoy') return r != null && L.rev[i - 4] > 0 ? (r / L.rev[i - 4] - 1) * 100 : null;
    if (k === 'gm') return L.gp && L.gp.some(v => v) && L.gp[i] != null && r ? L.gp[i] / r * 100 : null;
    if (k === 'om') return L.op && L.op[i] != null && r ? L.op[i] / r * 100 : null;
    if (k === 'ni') return L.ni ? L.ni[i] : null; if (k === 'eps') return L.eps ? L.eps[i] : null;
    if (k === 'fcf') { const c = fcfRow(f); return c && c.values ? c.values[i] : null; }
    const a = adjRow(f), q = a && a.q[i]; return q && q.total != null ? q.total : null; };
  const nn = v => v == null || !isFinite(v) ? null : v;
  // fiscal years differ, so each quarter is filed under the calendar quarter end it sits closest to
  const bucket = end => { const d = new Date(Date.parse(end) - 45 * 864e5); return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3); };
  const qname = b => `Q${b % 4 + 1} ${yy(Math.floor(b / 4))}`;
  const FSPAN = { '1Y': 4, '2Y': 8, '3Y': 12, '5Y': 20, '10Y': 40 }, YSPAN = { '3Y': 3, '5Y': 5, '10Y': 10 };
  const QPRE = ['1Y', '2Y', '3Y', '5Y', '10Y', 'Max', 'Custom'], APRE = ['3Y', '5Y', '10Y', 'Max', 'Custom'];
  // what each chart metric is: kind 'size' (dollars, drawn as bars), 'share' (a margin) or 'chg' (growth on a year earlier)
  const FX = {
    rev: { name: 'Revenue', fmt: money, kind: 'size', f: 'rev' },
    gm: { name: 'Gross margin', fmt: share, kind: 'share', tip: 'Gross profit as a share of revenue' },
    om: { name: 'Operating margin', fmt: share, kind: 'share', tip: 'Operating income as a share of revenue' },
    ni: { name: 'Net income', fmt: money, kind: 'size', f: 'ni' },
    eps: { name: 'Earnings per share', fmt: usd, kind: 'size', f: 'eps', tip: 'Diluted earnings per share as reported' },
    adj: { name: 'Adjusted EPS', fmt: usd, kind: 'size', f: 'adj', tip: 'Earnings per share as the company adjusts it in its own results release' },
    fcf: { name: 'Free cash flow', fmt: money, kind: 'size', f: 'fcf', tip: 'Cash from operations minus capital spending' },
    rev_g: { name: 'Revenue growth', kind: 'chg', f: 'rev' },
    op_g: { name: 'Operating income growth', kind: 'chg', f: 'op' },
    ni_g: { name: 'Net income growth', kind: 'chg', f: 'ni' },
    eps_g: { name: 'EPS growth', kind: 'chg', f: 'eps' },
    adj_g: { name: 'Adjusted EPS growth', kind: 'chg', f: 'adj' },
    fcf_g: { name: 'Free cash flow growth', kind: 'chg', f: 'fcf' } };
  const FACT = ['rev', 'gm', 'om', 'ni', 'eps', 'adj', 'fcf'], FCHG = ['rev_g', 'op_g', 'ni_g', 'eps_g', 'adj_g', 'fcf_g'], FALL = [...FACT, ...FCHG];
  Object.values(FX).forEach(x => { if (x.kind === 'chg') x.fmt = v => pct(v, 0); });

  // one row of figures per quarter, keyed by calendar quarter
  function qrows(d) {
    if (d._q) return d._q;
    const f = d.fin, L = f.lines, c = fcfRow(f), a = adjRow(f), gp = L.gp && L.gp.some(v => v), at = k => i => L[k] ? nn(L[k][i]) : null;
    const R = f.quarters.map((q, i) => ({ q, rev: nn(L.rev[i]), gp: gp ? nn(L.gp[i]) : null, op: at('op')(i), ni: at('ni')(i), eps: at('eps')(i), sh: at('sh')(i),
      fcf: c && c.values ? nn(c.values[i]) : null, adj: a && a.q[i] && a.q[i].total != null ? nn(a.q[i].total) : null }));
    d._r = R; return d._q = new Map(R.map(r => [bucket(r.q.end), r]));
  }
  // one row per fiscal year, only for years with all four quarters on file
  function arows(d) {
    if (d._a) return d._a; qrows(d);
    const by = new Map(), m = new Map(), c = fcfRow(d.fin);
    d._r.forEach(r => { const { fy, fq } = r.q; if (fy && fq >= 1 && fq <= 4) { if (!by.has(fy)) by.set(fy, {}); by.get(fy)[fq] = r; } });
    by.forEach((g, fy) => { if (![1, 2, 3, 4].every(k => g[k])) return; const G = [1, 2, 3, 4].map(k => g[k]);
      const sum = k => G.every(r => r[k] != null) ? G.reduce((s, r) => s + r[k], 0) : null, ni = sum('ni');
      const sh = G.every(r => r.sh > 0) ? G.reduce((s, r) => s + r.sh, 0) / 4 : null, eps = sum('eps');
      m.set(+fy, { rev: sum('rev'), gp: sum('gp'), op: sum('op'), ni, eps: eps != null ? eps : ni != null && sh ? ni / sh : null,
        fcf: c && c.annual && c.annual[fy] != null ? nn(c.annual[fy]) : sum('fcf'), adj: sum('adj') }); });
    return d._a = m;
  }
  let per = read('equinox.comps.period.v1') === 'a' ? 'a' : 'q';
  const rowsOf = d => per === 'a' ? arows(d) : qrows(d), plab = b => per === 'a' ? 'FY' + b : qname(b);
  const fv = (R, b, k) => { const r = R.get(b), x = FX[k]; if (!r) return null;
    if (k === 'gm') return r.gp != null && r.rev ? r.gp / r.rev * 100 : null;
    if (k === 'om') return r.op != null && r.rev ? r.op / r.rev * 100 : null;
    if (x.kind !== 'chg') return r[x.f];
    const p = R.get(b - (per === 'a' ? 1 : 4)), v = r[x.f], was = p && p[x.f];
    return v != null && was > 0 ? (v / was - 1) * 100 : null; };

  let fSel = (() => { const a = readJ('equinox.comps.metrics.v1'); if (Array.isArray(a)) { const s = FALL.filter(k => a.includes(k)); if (s.length) return s; }
    const o = read('equinox.comps.metric.v1'); return [o === 'yoy' ? 'rev_g' : FX[o] ? o : 'rev']; })();
  let qSpan = QPRE.includes(read('equinox.comps.quarters.v1')) ? read('equinox.comps.quarters.v1') : '3Y';
  let aSpan = APRE.includes(read('equinox.comps.years.v1')) ? read('equinox.comps.years.v1') : '5Y';
  const pair2 = c => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite) ? c : null;
  let fCustom = pair2(readJ('equinox.comps.fcustom.v1')), aCustom = pair2(readJ('equinox.comps.acustom.v1'));
  let indexed = read('equinox.comps.index.v1') === '1', fW = null;

  // the periods on the chart, and every period on file for the custom pickers
  function fWin() {
    const A = have().filter(d => d.fin); if (!A.length) return null;
    const R = A.map(rowsOf), keys = R.flatMap(m => [...m.keys()]); if (!keys.length) return { A, R, B: [] };
    const first = Math.min(...keys), last = Math.max(...keys), span = per === 'a' ? aSpan : qSpan, cu = per === 'a' ? aCustom : fCustom;
    let a0, b0;
    if (span === 'Custom') { const c = cu || [last - (per === 'a' ? 4 : 11), last]; b0 = Math.min(last, Math.max(...c)); a0 = Math.min(b0, Math.max(first, Math.min(...c))); }
    else if (span === 'Max') { a0 = first; b0 = last; }
    else { b0 = last; a0 = Math.max(first, last - (per === 'a' ? YSPAN[span] : FSPAN[span]) + 1); }
    const B = []; for (let b = a0; b <= b0; b++) B.push(b);
    return { A, R, first, last, a0, b0, B };
  }
  const fHas = k => fW && fW.R && fW.R.some(R => [...R.keys()].some(b => fv(R, b, k) != null));
  const fAdd = dd($('fAdd'), 'Add metrics', {
    value: () => fSel.length === 1 ? FX[fSel[0]].name : fSel.length + ' metrics',
    cols: () => [['Actual figures', FACT], ['% change', FCHG]].map(([head, ks]) => ({ head, items: ks.map(k => { const on = fSel.includes(k), off = !on && !fHas(k);
      return { k, label: FX[k].name, on, off, note: off ? 'none on file' : '', tip: FX[k].kind === 'chg' ? (per === 'a' ? 'Against the fiscal year before' : 'Against the same quarter a year earlier') : FX[k].tip }; }) })),
    pick: (c, k) => { if (fSel.includes(k)) { if (fSel.length < 2) return; fSel = fSel.filter(x => x !== k); } else fSel = FALL.filter(x => x === k || fSel.includes(x));
      store('equinox.comps.metrics.v1', JSON.stringify(fSel)); drawFund(); } });
  const fTime = dd($('fTime'), 'Timeframe', {
    value: () => per === 'a' ? (aSpan === 'Custom' ? 'Custom' : aSpan) : (qSpan === 'Custom' ? 'Custom' : qSpan),
    cols: () => { const s = per === 'a' ? aSpan : qSpan, out = [{ head: per === 'a' ? 'Fiscal years' : 'Quarters', radio: true, items: (per === 'a' ? APRE : QPRE).map(k => ({ k, label: SPANS[k], on: k === s })) }];
      if (s === 'Custom' && fW && fW.B && fW.B.length) { const opt = v => { let h = ''; for (let b = fW.last; b >= fW.first; b--) h += `<option value="${b}"${b === v ? ' selected' : ''}>${esc(plab(b))}</option>`; return h; };
        out.push({ head: 'Custom range', items: [], after: `<div class="cx-dd-form"><label>From<select name="from">${opt(fW.a0)}</select></label><label>To<select name="to">${opt(fW.b0)}</select></label></div>` }); }
      return out; },
    pick: (c, k) => { if (per === 'a') { aSpan = k; store('equinox.comps.years.v1', k); } else { qSpan = k; store('equinox.comps.quarters.v1', k); } drawFund(); return k === 'Custom' ? '' : 'close'; },
    change: t => { const f = t.closest('.cx-dd-form'); if (!f) return; const c = [+f.querySelector('[name=from]').value, +f.querySelector('[name=to]').value];
      if (per === 'a') { aCustom = c; store('equinox.comps.acustom.v1', JSON.stringify(c)); } else { fCustom = c; store('equinox.comps.fcustom.v1', JSON.stringify(c)); } drawFund(); } });
  const fTicks = (B, el) => { const W = (el.clientWidth || 600) - 60, band = W / Math.max(1, B.length), every = Math.max(1, Math.ceil((per === 'a' ? 62 : 54) / band));
    if (per === 'a' || every <= 3) return B.map((b, i) => (B.length - 1 - i) % every ? null : { i, t: plab(b) }).filter(Boolean);
    const Y = B.map((b, i) => b % 4 ? null : { i, t: String(b / 4) }).filter(Boolean), k = Math.max(1, Math.ceil(Y.length * 44 / W));
    return Y.filter((_, j) => (Y.length - 1 - j) % k === 0); };

  function drawFund() {
    fW = fWin();
    const all = have(), el = $('fCharts'), sized = fSel.some(k => FX[k].kind === 'size'), on = indexed && sized;
    flip($('fPer'), per, per === 'a' ? 'Showing annual figures. Switch to quarterly' : 'Showing quarterly figures. Switch to annual');
    $('fIndex').hidden = !sized; $('fIndex').setAttribute('aria-pressed', on);
    fAdd.paint(); fTime.paint();
    if (!fW) { flat(el, 'None of these has financials on file.'); $('fFoot').textContent = ''; return; }
    let B = fW.B;
    const S = fSel.map(k => ({ k, L: all.map(d => { const a = fW.A.indexOf(d);
      return { id: d.id, sym: d.sym, none: a < 0 ? 'no financials' : '', v: a < 0 ? B.map(() => null) : B.map(b => nn(fv(fW.R[a], b, k))) }; }) }));
    // start at the first period anything has a figure for
    const from = B.findIndex((_, i) => S.some(s => s.L.some(l => l.v[i] != null)));
    if (from < 0) B = []; else if (from > 0) { B = B.slice(from); S.forEach(s => s.L.forEach(l => { l.v = l.v.slice(from); })); }
    // A figure picked with a growth rate shares one chart: the figure on the left scale, growth as a line on the right.
    // Growth goes with its own figure when both are picked (revenue with revenue growth), otherwise with the next figure still free.
    const acts = fSel.filter(k => FX[k].kind !== 'chg'), mate = new Map(), used = new Set();
    const pairUp = test => fSel.filter(k => FX[k].kind === 'chg' && !used.has(k)).forEach(c => { const a = acts.find(k => !mate.has(k) && test(k, c)); if (a) { mate.set(a, c); used.add(c); } });
    pairUp((a, c) => FX[a].f && FX[a].f === FX[c].f); pairUp(() => true);
    const G = fSel.filter(k => !used.has(k)).map(k => mate.has(k) ? [k, mate.get(k)] : [k]), padR = G.some(g => g.length > 1) ? 62 : 6;
    const markOf = k => FX[k].kind === 'size' && !on ? 'bar' : 'line';
    const charts = blocks(el, G.map(([a, c]) => !c ? [a, FX[a].name, FX[a].tip, FX[a].kind === 'chg' ? 'against a year earlier' : '']
      : [`${a}+${c}:${markOf(a)}`, '', '', 'growth on the right-hand scale', [{ k: a, name: FX[a].name, tip: FX[a].tip, mark: markOf(a) },
        { k: c, name: FX[c].name, tip: per === 'a' ? 'Against the fiscal year before' : 'Against the same quarter a year earlier', mark: markOf(a) === 'bar' ? 'line' : 'dash' }]]), fSel.length > 1), x = B.map(plab);
    const ser = k => S.find(s => s.k === k), dec = st => [0, 1, 2].find(d => Math.abs(st * 10 ** d - Math.round(st * 10 ** d)) < 1e-6) ?? 2;
    G.forEach(([k0, k1], j) => { const s = ser(k0), X = FX[s.k], idx = on && X.kind === 'size', r = k1 && ser(k1), RX = r && FX[k1];
      if (idx) s.L.forEach(l => { const b0 = l.v.find(v => v != null); l.v = b0 > 0 ? l.v.map(v => v == null ? null : v / b0 * 100) : l.v.map(() => null); });
      const tick = idx ? v => v.toFixed(0) : X.kind === 'chg' ? (v, st) => pct(v, st < 1 ? 1 : 0) : X.kind === 'share' ? (v, st) => v.toFixed(st < 1 ? 1 : 0) + '%' : X.fmt === usd ? usd : v => money(v).replace('.0B', 'B');
      plot(charts[j], s.L, x, { kind: X.kind === 'size' && !idx ? 'bar' : 'line', fmt: idx ? v => v.toFixed(0) : X.fmt, tick, tone: X.kind === 'chg', dash: idx ? 100 : X.kind === 'chg' ? 0 : null,
        ticks: fTicks(B, charts[j].chart), rm: j === 0, padR, r: r ? { L: r.L, fmt: RX.fmt, tick: (v, st) => pct(v, dec(st)), dash: 0 } : null,
        label: `${X.name}${idx ? ' (first period shown set to 100)' : ''}${r ? `, with ${low(RX.name)} as a line on the right-hand scale,` : ''} by ${per === 'a' ? 'fiscal year' : 'quarter'} for ${all.map(d => d.sym).join(', ')}` }); });
    const notes = [per === 'a' ? 'Annual figures use each company’s own fiscal year and count only years with all four quarters on file.' : 'Quarters are lined up by the calendar quarter they ended closest to, since fiscal years differ.'];
    if (fSel.some(k => FX[k].kind === 'chg')) notes.push(`Growth compares each ${per === 'a' ? 'year with the year before' : 'quarter with the same quarter a year earlier'} and is left blank when the earlier figure was zero or negative.`);
    if (padR > 6) notes.push('A figure and a growth rate picked together share a chart: the figure reads off the left-hand scale and growth off the right.');
    if (on) notes.push('Dollar figures start at 100 for each company.');
    $('fFoot').textContent = notes.join(' ');
  }
  const ROWS = [['rev', 'Revenue'], ['yoy', 'Year over year', 1], ['gm', 'Gross margin', 1], ['om', 'Operating margin', 1], ['ni', 'Net income'], ['eps', 'Earnings per share'], ['fcf', 'Free cash flow'], ['adj', 'Adjusted EPS']];
  // an empty cell says why: the company's statements have no such line, it publishes no such figure, or the quarter is not on file
  const NOLINE = { gm: ['gp', 'gross profit'], om: ['op', 'operating income'] };
  const why = (f, k, i) => { const ln = NOLINE[k];
    if (ln && ((f.skip_lines || []).includes(ln[0]) || !(f.lines[ln[0]] || []).slice(Math.max(0, i - 7), i + 1).some(v => v != null)))
      return ['Not reported', `The company's income statement has no ${ln[1]} line`];
    if (k === 'adj' && !adjRow(f)) return ['Not given', 'The company does not publish an adjusted EPS figure'];
    if (k === 'fcf' && !fcfRow(f)) return ['Not on file', 'No cash flow figures on file for this company'];
    return ['Not on file', 'No figure for this quarter in the filings read here']; };
  const fcell = (f, k, i) => { const v = nn(val(f, k, i)); if (k === 'yoy') return `<td class="num ${tone(v)}">${pct(v, 0)}</td>`;
    if (v != null) return `<td class="num">${FM[k][1](v)}</td>`;
    const [t, tip] = why(f, k, i); return `<td class="num cx-why" title="${esc(tip)}">${t}</td>`; };
  const rowsFor = A => ROWS.filter(([k]) => A.some(d => d.fin && d.fin.lines.rev.some((_, i) => nn(val(d.fin, k, i)) != null)));
  function tablesFund() {
    const A = have(), F = A.filter(d => d.fin);
    const head = d => `<th>${sw(d.id)}<a href="${href(d.id)}">${esc(d.sym)}</a></th>`;
    $('fSide').innerHTML = !F.length ? '' : `<thead><tr><th>Latest quarter</th>${A.map(head).join('')}</tr></thead><tbody>` +
      `<tr class="soft"><th scope="row">Quarter ended</th>${A.map(d => d.fin ? `<td class="num">${esc(d.fin.quarters[d.fin.quarters.length - 1].label)}</td>` : '<td class="cx-none">No financials on file</td>').join('')}</tr>` +
      rowsFor(F).map(([k, name, soft]) => `<tr class="${soft ? 'soft' : ''}"><th scope="row"${FM[k][2] ? ` title="${esc(FM[k][2])}"` : ''}>${name}</th>${A.map(d => d.fin ? fcell(d.fin, k, d.fin.quarters.length - 1) : '<td></td>').join('')}</tr>`).join('') + '</tbody>';
    $('fSideWrap').hidden = !F.length;
    $('fEach').innerHTML = A.map(d => { const h = `<h3 class="cx-h">${sw(d.id)}<a href="${href(d.id)}">${esc(d.sym)}</a><span>${esc(d.name)}</span>${d.fin && d.fin.updated ? `<small>Updated ${day(d.fin.updated)}</small>` : ''}</h3>`;
      if (!d.fin) return h + '<p class="cx-nofin">No financials on file</p>';
      const q = d.fin.quarters, n = q.length - 1, cols = [...Array(Math.min(8, n + 1))].map((_, j) => n - Math.min(8, n + 1) + 1 + j);
      return h + `<div class="cx-scroll"><table class="cx-wide"><thead><tr><th>Quarter ended</th>${cols.map(i => `<th>${esc(q[i].label)}</th>`).join('')}</tr></thead><tbody>` +
        rowsFor([d]).map(([k, name, soft]) => `<tr class="${soft ? 'soft' : ''}"><th scope="row"${FM[k][2] ? ` title="${esc(FM[k][2])}"` : ''}>${name}</th>${cols.map(i => fcell(d.fin, k, i)).join('')}</tr>`).join('') + '</tbody></table></div>'; }).join('');
    const up = F.map(d => d.fin.updated).filter(Boolean).sort().pop(); $('fStamp').textContent = up ? 'Updated ' + day(up) : '';
  }

  // ---------- technicals ----------
  const chgTick = (v, st) => pct(v, st < 1 ? 1 : 0), gapTip = n => `Latest close against its average price over ${n} days, with recent days counting more`;
  const TX = {
    close: { name: 'Price', fmt: usd, tick: v => '$' + (Math.abs(v) >= 100 ? num(v, 0) : String(+v.toFixed(2))), tip: 'Closing price, adjusted for splits and dividends' },
    rsi: { name: 'RSI (14 days)', fmt: v => v.toFixed(1), tick: v => v.toFixed(0), dash: 50, tip: 'A 0 to 100 speed gauge. Under 30 means the stock has fallen fast, over 70 that it has risen fast.' },
    price: { name: 'Price change', fmt: v => pct(v, 1), tick: chgTick, tone: 1, dash: 0, tip: 'Change in price since the first day shown' },
    g10: { name: 'Versus 10-day average', fmt: v => pct(v, 1), tick: chgTick, tone: 1, dash: 0, tip: gapTip(10) },
    g21: { name: 'Versus 21-day average', fmt: v => pct(v, 1), tick: chgTick, tone: 1, dash: 0, tip: gapTip(21) },
    g50: { name: 'Versus 50-day average', fmt: v => pct(v, 1), tick: chgTick, tone: 1, dash: 0, tip: gapTip(50) },
    g200: { name: 'Versus 200-day average', fmt: v => pct(v, 1), tick: chgTick, tone: 1, dash: 0, tip: gapTip(200) },
    dd: { name: 'Below its high', fmt: v => pct(v, 1), tick: chgTick, dash: null, tip: 'How far the price sits under its highest close on record' } };
  const TACT = ['close', 'rsi'], TCHG = ['price', 'g10', 'g21', 'g50', 'g200', 'dd'], TALL = [...TACT, ...TCHG];
  const TPRE = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'Max', 'Custom'];
  const SPAN = { '1M': 22, '3M': 64, '6M': 127, '1Y': 252, '3Y': 756, '5Y': 1260 };
  const align = (dates, vals, axis) => { let j = 0; return axis.map(d => { while (j < dates.length && dates[j] <= d) j++; return j ? vals[j - 1] : null; }); };
  const src = (d, k) => k === 'price' || k === 'close' ? d.p.close : k === 'rsi' ? d.m.rsi : k === 'dd' ? d.m.dd : d.m.gap[+k.slice(1)];
  let tSel = (() => { const a = readJ('equinox.comps.techs.v1'); if (Array.isArray(a)) { const s = TALL.filter(k => a.includes(k)); if (s.length) return s; }
    const o = read('equinox.comps.tech.v1'); return [TX[o] ? o : 'price']; })();
  let tSpan = TPRE.includes(read('equinox.comps.range.v1')) ? read('equinox.comps.range.v1') : '1Y', tW = null;
  let tCustom = (c => Array.isArray(c) && c.length === 2 && c.every(v => /^\d{4}-\d\d-\d\d$/.test(v)) ? c : null)(readJ('equinox.comps.tcustom.v1'));
  // the trading days on the chart, starting on the first day every ticker has a price
  function tWin() {
    const A = have(); if (!A.length) return null;
    const base = (BENCH.spy || A[0]).p.dates, end = base.length; let s0 = 0, e0 = end;
    const oldest = A.map(d => d.p.dates[0]).sort()[0], since = Math.max(0, base.findIndex(x => x >= oldest));
    if (tSpan === 'YTD') { const y = base[end - 1].slice(0, 4), i = base.findIndex(x => x.startsWith(y)); s0 = Math.max(0, i - 1); }
    else if (tSpan === 'Max') s0 = since;
    else if (tSpan === 'Custom') { const c = tCustom || [base[Math.max(0, end - 252)], base[end - 1]], a = c[0] <= c[1] ? c : [c[1], c[0]];
      s0 = Math.max(since, base.findIndex(x => x >= a[0])); const e = base.findIndex(x => x > a[1]); e0 = e < 0 ? end : Math.max(s0 + 2, e); }
    else s0 = Math.max(since, end - SPAN[tSpan]);
    let x = base.slice(s0, e0); const newest = A.map(d => d.p.dates[0]).sort().pop(), k0 = x.findIndex(v => v >= newest); if (k0 > 0) x = x.slice(k0);
    return { A, x, min: base[since], max: base[end - 1] };
  }
  const tAdd = dd($('tAdd'), 'Add metrics', {
    value: () => tSel.length === 1 ? TX[tSel[0]].name : tSel.length + ' metrics',
    cols: () => [['Actual figures', TACT], ['% change', TCHG]].map(([head, ks]) => ({ head, items: ks.map(k => ({ k, label: TX[k].name, tip: TX[k].tip, on: tSel.includes(k) })) })),
    pick: (c, k) => { if (tSel.includes(k)) { if (tSel.length < 2) return; tSel = tSel.filter(x => x !== k); } else tSel = TALL.filter(x => x === k || tSel.includes(x));
      store('equinox.comps.techs.v1', JSON.stringify(tSel)); drawTech(); } });
  const tTime = dd($('tTime'), 'Timeframe', {
    value: () => tSpan,
    cols: () => { const out = [{ head: 'Trading days', radio: true, items: TPRE.map(k => ({ k, label: SPANS[k], on: k === tSpan })) }];
      if (tSpan === 'Custom' && tW && tW.x.length) out.push({ head: 'Custom range', items: [], after: `<div class="cx-dd-form"><label>From<input type="date" name="from" min="${tW.min}" max="${tW.max}" value="${tW.x[0]}"></label><label>To<input type="date" name="to" min="${tW.min}" max="${tW.max}" value="${tW.x[tW.x.length - 1]}"></label></div>` });
      return out; },
    pick: (c, k) => { tSpan = k; store('equinox.comps.range.v1', k); drawTech(); return k === 'Custom' ? '' : 'close'; },
    change: t => { const f = t.closest('.cx-dd-form'); if (!f) return; const a = f.querySelector('[name=from]').value, b = f.querySelector('[name=to]').value; if (!a || !b) return;
      tCustom = [a, b]; store('equinox.comps.tcustom.v1', JSON.stringify(tCustom)); drawTech(); } });
  function drawTech() {
    tW = tWin(); tAdd.paint(); tTime.paint(); if (!tW) return;
    const { A, x } = tW, charts = blocks($('tCharts'), tSel.map(k => [k, TX[k].name, TX[k].tip])), lab = x.map(d => day(d));
    tSel.forEach((k, j) => { const X = TX[k], L = A.map(d => ({ id: d.id, sym: d.sym, v: align(d.p.dates, src(d, k), x).map(nn) }));
      if (k === 'price') L.forEach(l => { const b0 = l.v.find(v => v != null); l.v = b0 > 0 ? l.v.map(v => v == null ? null : (v / b0 - 1) * 100) : l.v.map(() => null); });
      const T2 = dayTicks(x, charts[j].chart);
      plot(charts[j], L, lab, { kind: 'line', fmt: X.fmt, tick: X.tick, tone: X.tone, dash: X.dash, ticks: T2.ticks, bounds: T2.bounds, rm: j === 0,
        label: `${X.name} for ${A.map(d => d.sym).join(', ')}, ${tSpan === 'Custom' && x.length ? day(x[0]) + ' to ' + day(x[x.length - 1]) : SPANS[tSpan]}` }); });
  }
  // variance and covariance of daily price changes on the days both traded, over the last W sessions
  function pair(a, b, W) {
    if (!a || !b) return null; const A = a.p, Bp = b.p, N = A.close.length, tail = Bp.dates.length - Math.min(Bp.dates.length, W + 40), ix = new Map();
    for (let j = Math.max(1, tail); j < Bp.dates.length; j++) ix.set(Bp.dates[j], j);
    let k = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = Math.max(1, N - W); i < N; i++) { const j = ix.get(A.dates[i]); if (!j || Bp.dates[j - 1] !== A.dates[i - 1]) continue;
      const y = A.close[i] / A.close[i - 1] - 1, x = Bp.close[j] / Bp.close[j - 1] - 1; if (!isFinite(x) || !isFinite(y)) continue;
      k++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
    if (k < Math.max(20, W * .6)) return null;
    const vx = sxx - sx * sx / k, vy = syy - sy * sy / k, cov = sxy - sx * sy / k; if (vx <= 1e-12 || vy <= 1e-12) return null;
    return { beta: cov / vx, corr: Math.max(-1, Math.min(1, cov / Math.sqrt(vx * vy))), n: k };
  }
  const beta = (d, b, W) => { if (!b) return null; if (d.id === b.id) return 1; const s = pair(d, b, W); return s ? s.beta : null; };
  function tableTech() {
    const A = have(); if (!A.length) return;
    const R = A.map(d => { const c = d.p.close, N = c.length, t = d.t, V = t && t.values || {}, rsi = V.rsi14 != null ? V.rsi14 : d.m.rsi[N - 1];
      const all = d.m.rsi.filter(v => v != null), hi = rsi >= 50, sh = rsi == null || N < 30 ? null : all.filter(v => hi ? v >= rsi : v <= rsi).length / all.length * 100;
      const gap = n => t && t.ema && t.ema[n] != null ? t.ema[n] : d.m.gap[n][N - 1], m = d.m.high;
      return { d, rsi, hi, sh, V, gap, top: m === N - 1, off: (c[N - 1] / c[m] - 1) * 100, when: d.p.dates[m], beta: beta(d, BENCH.spy, 252) }; });
    const g = n => [`Versus ${n}-day average`, gapTip(n), r => { const v = nn(r.gap(n)); return [pct(v), tone(v)]; }];
    const rows = [
      ['RSI (14 days)', 'A 0 to 100 speed gauge. Under 30 means the stock has fallen fast.', r => [r.rsi == null ? '' : r.rsi.toFixed(1)]],
      ['Typical daily swing', 'Average true range over 14 days, as a share of price', r => [r.V.atrPercent == null ? '' : r.V.atrPercent.toFixed(1) + '%']],
      g(10), g(21), g(50), g(200),
      ['Days with RSI this low or high', 'Share of all trading days on record when the 14-day RSI was at least this far from the middle, on the same side', r => [r.sh == null ? '' : (r.sh < 1 ? r.sh.toFixed(1) : r.sh.toFixed(0)) + `%<span class="read">this ${r.hi ? 'high' : 'low'}</span>`]],
      ['Volume versus normal', 'Latest volume divided by its usual level', r => [r.V.rvol == null ? '' : r.V.rvol.toFixed(2) + '×']],
      ['Stretch from trend', 'How far price sits from its 20, 50 and 200-day averages and its usual trading band, ranked against its own last 500 days. 100 is the most stretched it gets.', r => { const o = r.d.ox; return [o && o.score != null ? `${Math.round(o.score)} of 100<span class="read">${o.downside ? 'below' : 'above'}</span>` : '', o && o.score >= 90 ? (o.downside ? 'down' : 'up') : '']; }],
      ['From all-time high', 'Latest close against the highest close on record. Prices are adjusted for splits and dividends.', r => [r.top ? 'At the high' : pct(r.off, 1), r.top ? '' : 'down']],
      ['All-time high set', 'The day of the highest close on record', r => [day(r.when)]],
      ['Beta against the S&amp;P 500', 'How much it tends to move for each 1% move in the S&P 500, from one year of daily price changes. Above 1 means bigger swings than the index.', r => [r.beta == null ? '' : r.beta.toFixed(2)]]];
    $('tSide').innerHTML = `<thead><tr><th>Latest readings</th>${A.map(d => `<th>${sw(d.id)}<a href="${href(d.id)}">${esc(d.sym)}</a></th>`).join('')}</tr></thead><tbody>` +
      rows.map(([name, tip, f]) => `<tr><th scope="row" title="${esc(tip)}">${name}</th>${R.map(r => { const [v, c] = f(r); return `<td class="num ${c || ''}">${v}</td>`; }).join('')}</tr>`).join('') + '</tbody>';
    const up = A.map(d => d.p.dates[d.p.dates.length - 1]).sort().pop(); $('tStamp').textContent = 'Updated ' + day(up);
  }

  // ---------- how they move together ----------
  let cWin = () => '1Y';
  function together() {
    const A = have(); if (!A.length) return;
    const W = cWin() === '3M' ? 63 : 252, words = W === 63 ? 'past 3 months' : 'past year';
    const shade = v => `background:color-mix(in srgb, ${v >= 0 ? 'var(--accent)' : '#c2851a'} ${Math.round(Math.abs(v) * 36)}%, transparent)`;
    const P = A.map(a => A.map(b => a === b ? null : pair(a, b, W)));
    $('corr').innerHTML = `<thead><tr><th></th>${A.map(d => `<th>${esc(d.sym)}</th>`).join('')}</tr></thead><tbody>` + A.map((a, i) => `<tr><th scope="row">${sw(a.id)}${esc(a.sym)}</th>${A.map((b, j) => { if (i === j) return '<td class="num self">1.00</td>';
      const s = i < j ? P[i][j] : P[j][i]; return s ? `<td class="num" style="${shade(s.corr)}" title="${esc(a.sym)} and ${esc(b.sym)}, ${s.n} shared trading days">${s.corr.toFixed(2)}</td>` : '<td class="num self" title="Too few shared trading days"></td>'; }).join('')}</tr>`).join('') + '</tbody>';
    const through = A.map(d => d.p.dates[d.p.dates.length - 1]).sort().pop();
    $('corrNote').textContent = A.length < 2 ? 'Add a second ticker to see how they move together.' : `Daily price changes over the ${words}, ${W} trading days through ${day(through)}. 1.00 means two tickers rose and fell together every day, 0 means no link, and a negative number means they tended to move opposite ways.`;
    const cols = [[BENCH.spy, 'S&amp;P 500'], [BENCH.qqq, 'Nasdaq-100'], ...A.map(d => [d, esc(d.sym)])].filter(c => c[0]);
    $('betaTable').innerHTML = `<thead><tr><th>Beta of each ticker against</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>` + A.map(a => `<tr><th scope="row">${sw(a.id)}${esc(a.sym)}</th>${cols.map(([b]) => { if (b.id === a.id) return '<td class="num soft">1.00</td>'; const v = beta(a, b, W); return `<td class="num">${v == null ? '' : v.toFixed(2)}</td>`; }).join('')}</tr>`).join('') + '</tbody>';
    $('betaNote').textContent = `Beta is how much the ticker in the row tends to move for each 1% move in the column, over the same ${words}. Above 1 means it swings more, below 1 less.`;
  }

  function render() { paintSide(); paintView(); drawFund(); tablesFund(); drawTech(); tableTech(); together(); mark(); }

  // ---------- fundamentals or technicals, or both side by side ----------
  // The flip is the words themselves: the one showing is in full ink, the other fades back. Narrow screens always
  // flip; the side-by-side choice is kept for the next wide screen. Side by side, each half scrolls on its own.
  let view = read('equinox.comps.view.v1') === 't' ? 't' : 'f', split = read('equinox.comps.layout.v1') === 'split', lastPane = 'f';
  const wide = matchMedia('(min-width: 1001px)'), both = () => split && wide.matches;
  const heads = [...document.querySelectorAll('.cx-head')]; let fading = false;
  function flip(btn, cur, words) { btn.querySelectorAll('[data-v]').forEach(s => s.classList.toggle('on', s.dataset.v === cur)); if (words) btn.setAttribute('aria-label', words); }
  function fit() { const p = $('panes'); if (!both() || !have().length) { p.style.removeProperty('--cx-h'); return; }
    p.style.setProperty('--cx-h', Math.max(420, Math.floor(innerHeight - (p.getBoundingClientRect().top + scrollY))) + 'px'); }
  function paintView() {
    const A = have().length, s = both(), panes = $('panes');
    panes.dataset.layout = s ? 'split' : 'toggle'; panes.dataset.view = view; document.body.classList.toggle('cx-split', s && A > 0);
    // Each section's heading is the flip. Side by side it is a plain heading naming its own half.
    const was = heads.map(b => b.dataset.cur || view);
    heads.forEach(b => { b.disabled = s; b.classList.toggle('solo', s);
      if (s) { b.dataset.cur = b.dataset.own; flip(b, b.dataset.own, ''); b.removeAttribute('aria-label'); } });
    $('layout').setAttribute('aria-pressed', s);
    $('fundamentals').hidden = !A || (!s && view !== 'f'); $('technicals').hidden = $('together').hidden = !A || (!s && view !== 't');
    $('empty').hidden = !!A || !ready;
    if (!s) {
      const set = () => heads.forEach(b => { b.dataset.cur = view; flip(b, view, view === 'f' ? 'Fundamentals, showing. Switch to technicals' : 'Technicals, showing. Switch to fundamentals'); });
      // after a click the new heading first shows the old choice, then the words cross-fade in place
      if (fading) { fading = false; heads.forEach((b, i) => flip(b, was[i], '')); heads.forEach(b => b.querySelectorAll('span').forEach(x => getComputedStyle(x).opacity)); }
      set();
    }
    fit();
  }
  const redrawAll = () => { shut(opened); paintView(); if (!have().length) return; drawFund(); drawTech(); mark(); };
  heads.forEach(b => b.addEventListener('click', () => {
    if (both()) return;
    view = view === 'f' ? 't' : 'f'; store('equinox.comps.view.v1', view); fading = true; redrawAll();
    heads.find(h => h.dataset.own === view).focus({ preventScroll: true });
  }));
  $('fPer').addEventListener('click', () => { per = per === 'a' ? 'q' : 'a'; store('equinox.comps.period.v1', per); drawFund(); });
  $('fIndex').onclick = () => { indexed = !indexed; store('equinox.comps.index.v1', indexed ? '1' : '0'); drawFund(); };
  $('layout').onclick = () => { split = !both(); store('equinox.comps.layout.v1', split ? 'split' : 'toggle'); scrollTo(0, 0); redrawAll(); };
  wide.addEventListener('change', redrawAll);
  onRedraw(() => { if (have().length) render(); else paintView(); });
  cWin = pick($('cWinPick'), [['3M', '3 months'], ['1Y', '1 year']], 'equinox.comps.window.v1', '1Y', together);
  $('cWinPick').style.setProperty('--tint', 'var(--raised)'); $('cWinPick').style.setProperty('--tone', 'var(--ink)');
  hoverable($('fCharts')); hoverable($('tCharts'));

  // removing a ticker from the key, or a metric from its chart heading
  const drop = (id, sec) => { const i = list.indexOf(id); missing = []; list = list.filter(x => x !== id); run++; sync(); render();
    const xs = $(sec).querySelectorAll('.cx-x'); if (xs.length) xs[Math.min(i, xs.length - 1)].focus({ preventScroll: true }); else $('find').querySelector('input').focus({ preventScroll: true }); };
  ['fCharts', 'tCharts'].forEach(sec => $(sec).addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { drop(x.dataset.x, sec); return; }
    const r = e.target.closest('[data-rm]'); if (!r) return; const k = r.dataset.rm;
    if (sec === 'fCharts') { if (fSel.length > 1) { fSel = fSel.filter(v => v !== k); store('equinox.comps.metrics.v1', JSON.stringify(fSel)); drawFund(); } }
    else if (tSel.length > 1) { tSel = tSel.filter(v => v !== k); store('equinox.comps.techs.v1', JSON.stringify(tSel)); drawTech(); } }));
  finder($('find'), id => { if (!T || list.includes(id) || list.length >= MAX) return; setList([...list, id], false); },
    { items: () => !T ? [] : T.series.filter(ok).map(x => { const s = symOf(x); return { id: x.id, name: s, note: nameOf(x, s), key: (x.label + ' ' + (x.aliases || []).join(' ')).toLowerCase() }; }) });

  // The left list switches sides when only one shows. Side by side, it follows whichever half was scrolled last.
  const side = document.querySelector('nav.side'), links = side ? [...side.querySelectorAll('a[href^="#"]')] : [];
  const atEnd = el => el ? el.scrollTop + el.clientHeight >= el.scrollHeight - 4 : innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  function mark() {
    const s = both(), t = $('together'); let on = 1;
    if (s ? lastPane === 'f' : view === 'f') on = 0;
    else if (t && !t.hidden) { const pane = s ? $('paneT') : null, ref = s ? pane.getBoundingClientRect().top + 80 : parseFloat(css('--ml-header')) + 80;
      if (t.getBoundingClientRect().top < ref || atEnd(pane)) on = 2; }
    links.forEach((a, i) => a.classList.toggle('on', i === on));
  }
  addEventListener('scroll', mark, { passive: true });
  ['paneF', 'paneT'].forEach(id => $(id).addEventListener('scroll', () => { if (!both()) return; lastPane = id === 'paneF' ? 'f' : 't'; mark(); }, { passive: true }));
  if (side) side.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault();
    const id = a.getAttribute('href').slice(1), v = id === 'fundamentals' ? 'f' : 't', t = $(id);
    if (both()) { const pane = $(v === 'f' ? 'paneF' : 'paneT'); lastPane = v;
      pane.scrollTo({ top: id === 'together' && t ? pane.scrollTop + t.getBoundingClientRect().top - pane.getBoundingClientRect().top : 0, behavior: 'smooth' }); mark(); return; }
    if (v !== view && have().length) { view = v; store('equinox.comps.view.v1', view); redrawAll(); }
    if (t && !t.hidden) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const asked = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
    return !h || SECTIONS.includes(h) || h === 'top' ? null : h.split(',').map(s => s.trim()).filter(Boolean); };
  addEventListener('hashchange', () => { const a = asked(); if (a && T && a.join(',').toUpperCase() !== list.map(id => D[id] ? D[id].sym : id).join(',').toUpperCase()) setList(a); });

  (async () => {
    [T, TI, OX] = await Promise.all([trend().catch(() => null), json('cube/technical-index.json').catch(() => null),
      json('cube/overextension.json').then(d => d.rows).catch(() => null), json('financials/index.json').then(a => { FIN = new Set(a.map(x => x.ticker)); }).catch(() => {})]);
    if (!T) { $('empty').textContent = 'This did not load. Refresh to try again.'; $('empty').hidden = false; return; }
    await Promise.all(['spy', 'qqq'].map(id => { const S = T.series.find(x => x.id === id); return S ? prices(S.file).then(p => { BENCH[id] = { id, p }; }).catch(() => {}) : null; }));
    let want = asked();
    if (!want) { try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(a)) want = a.filter(x => typeof x === 'string'); } catch (_) {} }
    setList(want || START);
  })();
})();
