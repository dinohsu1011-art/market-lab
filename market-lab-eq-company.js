/* Company: with no ticker in the address, a search bar and the stock screener. With one (#NVDA), that company:
   its story down the left half, the price chart and technicals in two panels on the right. */
(() => {
  const { $, css, pct, tone, usd, big, day, esc, json, trend, prices, ret, fail, pick, finder, series, spy, chart, setTone, onRedraw } = EQ;
  const LAST = 'equinox.company.last.v1';
  const R = [['1D', 'latest day'], ['1W', 'past week'], ['1M', 'past month'], ['3M', 'past 3 months'], ['6M', 'past 6 months'], ['YTD', 'this year'], ['1Y', 'past year'], ['3Y', 'past 3 years'], ['10Y', 'past 10 years']];
  const label = k => R.find(x => x[0] === k)[1];
  let P = null, s = null, F = null, CALLS = [], SAID = null, sym = '', run = 0;

  // price chart
  const cut = (S, n) => ({ d: S.d.slice(-n), c: S.c.slice(-n) });
  const slice = r => { const D = P.daily;
    if (r === '1D') return cut(D, 2); if (r === '1W') return cut(D, 6);
    if (r === '1M') return cut(D, 22); if (r === '3M') return cut(D, 64); if (r === '6M') return cut(D, 127);
    if (r === 'YTD') { const y = D.d[D.d.length - 1].slice(0, 4), i = D.d.findIndex(x => x.startsWith(y)); return cut(D, D.d.length - Math.max(0, i - 1)); }
    return r === '1Y' ? cut(D, 252) : r === '3Y' ? P.weekly : P.monthly; };
  const head = i => { const v = i == null ? s.c[s.c.length - 1] : s.c[i], d = v - s.c[0];
    $('price').textContent = usd(v);
    $('chg').innerHTML = `<b class="${tone(d)}" style="font-weight:600">${d < 0 ? '−' : '+'}$${Math.abs(d).toFixed(2)} (${pct(d / s.c[0] * 100, 2)})</b> <span>${i == null ? label(range()) : day(s.d[i])}</span>`; };
  // other lines on the same chart: stocks, ETFs, themes and the owner's baskets. With any added, every line is its percent change from the first shared day.
  const CMP = 'equinox.company.compare.v1', TINT = ['--accent', '#c2851a', '#8a63d2', '#1f9d94'], CP = {};
  let cmp = [], L = null, saved = null, cmpFor = '';
  // the saved list belongs to one stock, {ticker, items}, and only outlives a refresh of that stock's page.
  // The older plain list had no owner, so it is read and not carried over.
  try { const a = JSON.parse(localStorage.getItem(CMP) || 'null'), nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload' && a && typeof a.ticker === 'string' && Array.isArray(a.items)) saved = { ticker: a.ticker, items: a.items.filter(x => typeof x === 'string').slice(0, 4) }; } catch (_) {}
  const keep = () => { try { localStorage.setItem(CMP, JSON.stringify({ ticker: sym, items: cmp })); } catch (_) {} };
  const owner = id => { if (id === cmpFor) return; cmp = id && saved && saved.ticker === id ? saved.items.filter(x => x !== id) : []; saved = null; cmpFor = id; keep(); };
  // everything the box can add. Stocks, funds and themes are price files in the trend index; extra-themes.json carries
  // its own year of closes; a basket from my-baskets.json is the equal-weight average of its stocks' daily changes.
  const RAW = ['gold', 'silver', 'copper', 'wti']; let LIST = [], INFO = {}, cat = null;
  const catalog = () => cat || (cat = Promise.all([trend(), json('extra-themes.json').catch(() => null), json('my-baskets.json').catch(() => null)]).then(([T, E, B]) => {
    const out = [], stocks = [], add = (a, o) => { INFO[o.id] = o; a.push(o); };
    T.series.forEach(x => { const c = x.label.indexOf(' · '), tail = c < 0 ? '' : x.label.slice(c + 3), lead = c < 0 ? x.label : x.label.slice(0, c);
      if (x.kind === 'equity' || x.kind === 'asset') add(stocks, { id: x.id, b: x.id, show: x.id, name: tail, note: tail, kind: 'Stock', key: (x.label + ' ' + (x.aliases || []).join(' ')).toLowerCase() });
      else if (x.kind === 'etf' && tail && tail.toUpperCase() === String(x.stem).toUpperCase()) add(out, { id: x.id, b: tail, show: tail, name: lead, note: lead, kind: 'ETF', key: x.label.toLowerCase() });
      else if (x.kind === 'etf') add(out, { id: x.id, show: x.label, name: x.label, kind: RAW.includes(x.id) ? 'Commodity' : x.id === 'hatedm7' ? 'Theme' : 'Index', key: (x.label + ' ' + x.id).toLowerCase() });
      else if (x.kind === 'basket') add(out, { id: x.id, show: x.label, name: x.label, kind: 'Theme', key: (x.label + ' ' + x.id).toLowerCase() }); });
    ((E && E.themes) || []).forEach(t => { if (!INFO[t.id]) add(out, { id: '~x:' + t.id, show: t.label, name: t.label, kind: 'Theme', key: t.label.toLowerCase(), src: { dates: E.dates, close: t.close } }); });
    ((B && B.baskets) || []).forEach(b => add(out, { id: '~b:' + b.id, show: b.name, name: b.name, kind: 'Basket', key: b.name.toLowerCase(), members: b.members || [] }));
    stocks.sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id)); LIST = out.concat(stocks); }).catch(() => {}));
  const basket = members => trend().then(T => { const ids = {}; T.series.forEach(x => { if (x.kind === 'equity' || x.kind === 'asset') ids[x.id.toUpperCase()] = x.id; });
    return Promise.all(members.map(m => ids[String(m).toUpperCase()]).filter(Boolean).map(id => series(id).catch(() => null))); }).then(all => { const sum = {}, cnt = {};
    all.filter(Boolean).forEach(p => { for (let i = Math.max(1, p.close.length - 2600); i < p.close.length; i++) { const a = p.close[i - 1], b = p.close[i], d = p.dates[i]; if (!(a > 0 && b > 0)) continue;
      sum[d] = (sum[d] || 0) + b / a - 1; cnt[d] = (cnt[d] || 0) + 1; } });
    const d = Object.keys(sum).sort(); if (!d.length) throw new Error('no prices'); let v = 100; return { dates: d, close: d.map(x => v *= 1 + sum[x] / cnt[x]) }; });
  const own = id => catalog().then(() => { const o = INFO[id]; return o && o.src ? o.src : o && o.members ? basket(o.members) : series(id); });
  const shown = id => (INFO[id] || {}).show || id;
  const fetchCmp = id => id in CP ? Promise.resolve() : own(id).then(p => { CP[id] = { d: p.dates, c: p.close }; }).catch(() => { CP[id] = null; });
  const align = (p, dates) => { let j = 0; return dates.map(d => { while (j < p.d.length && p.d[j] <= d) j++; return j ? p.c[j - 1] : null; }); };
  const key = i => { const el = $('cmpKey'); $('cmpFind').hidden = cmp.length >= 4;
    el.innerHTML = !L ? '' : L.map((l, j) => { const v = l.v[i == null ? l.v.length - 1 : i];
      return `<span><i style="background:${l.col}"></i>${esc(shown(l.id))} <b class="num ${tone(v)}">${pct(v, 1)}</b>${j ? `<button type="button" class="x" data-x="${esc(l.id)}" aria-label="Remove ${esc(shown(l.id))}" title="Remove ${esc(shown(l.id))}">×</button>` : ''}</span>`; }).join(''); };
  // moving averages of the daily close, worked out on the full price history and read off at each day on the chart
  const SMA = 'equinox.company.sma.v1', MA = [[20, '#c2851a'], [50, '#8a63d2'], [100, '#1f9d94'], [200, '--muted']];
  let ma = [], FULL = null, AVG = {};
  try { ma = (JSON.parse(localStorage.getItem(SMA) || '[]') || []).filter(n => MA.some(m => m[0] === n)); } catch (_) {}
  const avg = n => { if (AVG[n]) return AVG[n]; const c = FULL.close, out = []; let t = 0;
    for (let i = 0; i < c.length; i++) { t += c[i]; if (i >= n) t -= c[i - n]; out.push(i >= n - 1 ? t / n : null); } return AVG[n] = { d: FULL.dates, c: out }; };
  const maCol = c => c.startsWith('--') ? css(c) : c;
  const maLines = () => { if (!FULL || !ma.length || s.d.length < 20) return [];
    const D = P.daily, at = align({ d: FULL.dates, c: FULL.close }, [D.d[D.d.length - 1]])[0], k = at > 0 ? D.c[D.c.length - 1] / at : 1;
    return MA.filter(m => ma.includes(m[0])).map(([n, c]) => ({ v: align(avg(n), s.d).map(x => x == null ? null : x * k), col: maCol(c), w: 1.25 })).filter(l => l.v.some(x => x != null)); };
  $('smaPick').insertAdjacentHTML('beforeend', MA.map(([n, c]) => `<button type="button" data-n="${n}" title="${n}-day moving average"><i style="--c:${c.startsWith('--') ? `var(${c})` : c}"></i>${n}</button>`).join(''));
  const maPaint = () => [...$('smaPick').querySelectorAll('button')].forEach(b => b.setAttribute('aria-pressed', ma.includes(+b.dataset.n)));
  $('smaPick').addEventListener('click', e => { const b = e.target.closest('button[data-n]'); if (!b) return; const n = +b.dataset.n;
    ma = ma.includes(n) ? ma.filter(x => x !== n) : ma.concat(n); try { localStorage.setItem(SMA, JSON.stringify(ma)); } catch (_) {} maPaint(); draw(); });
  maPaint();
  // earnings calls inside the window on screen, each a small E along the bottom that opens that call
  const evs = () => { const n = s.d.length - 1; if (n < 5) return [];
    return CALLS.filter(c => c.d && c.d >= s.d[0] && c.d <= s.d[n]).map(c => ({ c, i: s.d.findIndex(d => d >= c.d) })); };
  const mark = E => { if (!E.length) return; const el = $('chart'), n = s.d.length - 1, W = el.clientWidth;
    const tight = E.some((e, j) => j && (e.i - E[j - 1].i) / n * W < 20);
    el.insertAdjacentHTML('beforeend', `<div class="evs${tight ? ' tight' : ''}">` + E.map(({ c, i }) => { const q = c.id.split(' ').slice(-2), m = c.move || {};
      const t = `${q[1]} fiscal ${q[0]} earnings call, ${day(c.d)}${m.r1 == null ? '' : `. Stock ${pct(m.r1 * 100)} the next day`}`;
      return `<a class="ev" style="left:${(i / n * 100).toFixed(2)}%" href="market-lab-company-calls.html?q=${encodeURIComponent(q.join(' '))}#${encodeURIComponent(sym)}" title="${esc(t)}" aria-label="${esc(t)}">E</a>`; }).join('') + '</div>'); };
  const draw = () => { if (!P) return; s = slice(range()); if (!s.c.length) return;
    const O = cmp.filter(id => id !== sym && CP[id]).map(id => ({ id, v: align(CP[id], s.d) })).filter(o => o.v.some(x => x != null));
    $('smaPick').hidden = !!O.length;
    if (!O.length) { L = null; const col = setTone(s.c[s.c.length - 1] - s.c[0]), E = evs();
      chart($('chart'), { lines: [{ v: s.c, col }, ...maLines()], dash: s.c[0], foot: E.length ? 24 : 0, label: `${sym} price, ${label(range())}`, onHover: head }); mark(E); head(null); key(null); return; }
    const from = Math.max(0, ...O.map(o => o.v.findIndex(x => x != null))), rel = v => { const c = v.slice(from); return c.map(x => (x / c[0] - 1) * 100); };
    s = { d: s.d.slice(from), c: s.c.slice(from) }; setTone(s.c[s.c.length - 1] - s.c[0]);
    const tint = id => { const t = TINT[cmp.indexOf(id) % 4]; return t.startsWith('--') ? css(t) : t; };
    L = [{ id: sym, v: s.c.map(x => (x / s.c[0] - 1) * 100), col: css('--ink'), w: 2.5 }, ...O.map(o => ({ id: o.id, v: rel(o.v), col: tint(o.id), w: 1.75 }))];
    const E = evs();
    chart($('chart'), { lines: L, dash: 0, foot: E.length ? 24 : 0, label: `${sym} against ${O.map(o => shown(o.id)).join(', ')}, percent change, ${label(range())}`, onHover: i => { head(i); key(i); } }); mark(E); head(null); key(null); };
  // tap the chart to give it most of the screen; Close, Escape or a tap outside puts it back
  const grow = on => { const p = $('pricePanel'); if (p.classList.contains('big') === on) return; if (on) { $('detail').classList.remove('rise'); $('detail').style.animation = 'none'; } p.classList.toggle('big', on); $('chartShut').hidden = !on;
    $('chart').setAttribute('aria-expanded', on); draw(); if (on) $('chartShut').focus({ preventScroll: true }); };
  $('chart').addEventListener('click', e => { if (e.target.closest('.ev') || !P) return; e.stopPropagation(); grow(true); });
  $('chartShut').addEventListener('click', e => { e.stopPropagation(); grow(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') grow(false); });
  document.addEventListener('click', e => { if ($('pricePanel').classList.contains('big') && !e.target.closest('#pricePanel')) grow(false); });
  finder($('cmpFind'), id => { if (id === sym || cmp.includes(id) || cmp.length >= 4) return;
    const at = sym; fetchCmp(id).then(() => { if (!CP[id] || at !== sym || cmp.includes(id) || cmp.length >= 4) return; cmp.push(id); keep(); draw(); }); }, { items: () => LIST });
  catalog();
  $('cmpKey').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; cmp = cmp.filter(id => id !== b.dataset.x); keep(); draw(); });
  const range = pick($('ranges'), R.map(([k]) => [k]), 'equinox.company.range.v1', '1Y', draw);

  // earnings dots: reported value against the estimate when one exists, else the same quarter a year earlier
  const money = v => v == null ? '' : '$' + (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'B' : v.toFixed(0) + 'M');
  const drawDots = () => { const react = !F || metric() === 'react';
    $('dotsLegend').innerHTML = react ? '' : '<span><i></i>Reported</span><span><i class="dim"></i><span id="dotsRef"></span></span>';
    if (react) { if (CALLS.length) EQ.reaction($('dots'), CALLS, SAID); else $('dots').innerHTML = '<p class="wait">Equinox has no earnings calls for this company.</p>'; return; }
    const el = $('dots'), W = el.clientWidth, H = el.clientHeight, m = metric(), A = F.lines[m] || [], n = A.length - 1;
    const idx = [...Array(Math.min(8, n + 1))].map((_, k) => n - Math.min(8, n + 1) + 1 + k), N = idx.length;
    const est = (F.estimates || {})[m] || [], hasEst = idx.some(i => est[i] != null), ref = i => hasEst ? est[i] : A[i - 4];
    const vals = idx.flatMap(i => [A[i], ref(i)]).filter(v => v != null); if (!W || !vals.length) return;
    const lo = Math.min(...vals), hi = Math.max(...vals), top = 98, bot = H - 40, y = v => top + (hi - v) / (hi - lo || 1) * (bot - top), x = k => (k + .5) * W / N;
    const fmt = m === 'eps' ? usd : money, up = css('--up'), ink = css('--ink'), mut = css('--muted');
    const tips = [], bg = css('--bg');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m === 'eps' ? 'Earnings per share' : 'Revenue'} by quarter">` + idx.map((i, k) => {
      const a = A[i], b = ref(i), g = A[i - 4] > 0 && a != null ? (a / A[i - 4] - 1) * 100 : null; if (a == null) return '';
      const q = A[i - 1] > 0 ? (a / A[i - 1] - 1) * 100 : null;
      if (g != null || q != null) { const T = [g != null && `${pct(g, 0)} YoY`, q != null && `${pct(q, 0)} QoQ`].filter(Boolean), h = T.length * 20 + 12;
        const w = Math.max(...T.map(t => t.length)) * 8 + 26, cx = Math.max(w / 2, Math.min(W - w / 2, x(k))), ty = Math.max(2, y(a) - 36 - h);
        tips.push(`<g class="yoy" data-k="${k}"><rect x="${cx - w / 2}" y="${ty}" width="${w}" height="${h}" rx="8" fill="${ink}"/><path d="M${x(k) - 6} ${ty + h - 1}h12l-6 6z" fill="${ink}"/>${T.map((t, j) => `<text x="${cx}" y="${ty + 22 + j * 20}" text-anchor="middle" font-size="14" font-weight="600" fill="${bg}" style="font-variant-numeric:tabular-nums">${t}</text>`).join('')}</g>`); }
      return `<g class="col" data-k="${k}" tabindex="0"><rect x="${x(k) - W / N / 2}" y="0" width="${W / N}" height="${H}" fill="transparent"/>
        ${b == null ? '' : `<circle cx="${x(k)}" cy="${y(b)}" r="8" fill="${up}" opacity=".28"/>`}
        <circle cx="${x(k)}" cy="${y(a)}" r="8" fill="${up}"/>
        <text x="${x(k)}" y="${y(a) - 16}" text-anchor="middle" font-size="14" font-weight="600" fill="${ink}" style="font-variant-numeric:tabular-nums">${fmt(a)}</text>
        <text x="${x(k)}" y="${H - 10}" text-anchor="middle" font-size="14" fill="${mut}">${esc(F.quarters[i].label)}</text></g>`; }).join('') + tips.join('') + '</svg>';
    $('dotsRef').textContent = hasEst ? 'Analyst estimate' : 'Same quarter a year earlier'; };
  { const el = $('dots'); el._tips = 1; const tip = k => el.querySelectorAll('.yoy').forEach(g => g.classList.toggle('on', g.dataset.k === k)), at = e => { const c = e.target.closest && e.target.closest('.col'); tip(c ? c.dataset.k : null); };
    el.addEventListener('pointerover', at); el.addEventListener('focusin', at); el.addEventListener('pointerleave', () => tip(null)); el.addEventListener('focusout', () => tip(null)); }
  const metric = pick($('dotsPick'), [['rev', 'Revenue'], ['eps', 'EPS'], ['react', 'Reaction']], 'equinox.company.dots.v1', 'rev', drawDots);
  // valuation bands: the price beside what it would be at the company's typical multiple and a normal range around it.
  // The range is set in ratio terms (log scale), so one freak reading on near-zero earnings cannot stretch it.
  const VM = { pe: ['Trailing P/E', 'Share price divided by the last four reported quarters of earnings per share.'],
    fpe: ['Forward P/E', 'Share price divided by blended 12-month forward consensus earnings per share, shown only for companies with stored consensus estimates.'],
    ebitda: ['Market value to EBITDA', 'Market value divided by the last four quarters of EBITDA (operating income plus depreciation and amortization). Debt and cash are not included. When a company files no share count, shares are net income divided by earnings per share.'] };
  let VAL = null, VAL_OWN = false, VAL_ADJ = false, VAL_FPE_ASOF = '';
  const later = (iso, days) => new Date(Date.parse(iso) + days * 864e5).toISOString().slice(0, 10);
  // the chosen window: days for a year, weeks for three, months beyond that
  const valAxis = () => { const r = valRange(), S = r === '1Y' ? P.daily : r === '3Y' ? P.weekly : r === '5Y' ? cut(P.monthly, 61) : P.monthly;
    // a missing close at the end (ROKU's last week of days) would read as a zero multiple, so stop at the last real close
    const d = S.d.slice(), c = S.c.slice(), D = P.daily; let j = D.c.length - 1; while (j > 0 && !(D.c[j] > 0)) j--;
    while (c.length > 1 && !(c[c.length - 1] > 0)) { c.pop(); d.pop(); }
    const ld = D.d[j]; if (ld > d[d.length - 1]) { d.push(ld); c.push(D.c[j]); } else c[c.length - 1] = D.c[j];
    return { d, c }; };
  const buildVal = () => { VAL = null; VAL_OWN = false; VAL_ADJ = false; VAL_FPE_ASOF = ''; if (!P) return;
    const { d, c } = valAxis();
    const per = {}, B = window.QUANT_PE_BANDS, bk = B && ((B.meta.aliases || {})[sym] || sym), rows = B && !(B.meta.excluded || {})[sym] && B.series[bk] && B.series[bk].rows;
    if (F) { const L = F.lines, n = L.eps.length - 1, AE = (F.adjustments || []).find(a => a.unit === 'eps'),
        ae = AE && F.quarters.map((_, k) => AE.q[k] && AE.q[k].total != null ? AE.q[k].total : null),
        // reported EPS below zero over the last year (TTWO's write-downs): use the company's adjusted EPS, when it has one
        lossy = n >= 3 && !(L.eps.slice(n - 3).reduce((t, v) => t == null || v == null ? null : t + v, 0) > 0),
        E = lossy && ae && ae.slice(n - 3).every(v => v != null) ? ae : L.eps; if (E !== L.eps) VAL_ADJ = true;
      const q = F.quarters.map(x => x.filed || later(x.end, 45)), da = ((F.kpi_groups || []).flatMap(g => g.rows).find(r => /^depreciation/i.test(r.name)) || {}).values;
      const known = x => { let i = -1; while (i + 1 < q.length && q[i + 1] <= x) i++; return i; };
      const ttm = get => d.map(x => { const i = known(x); if (i < 3) return null; let t = 0; for (let k = i - 3; k <= i; k++) { const v = get(k); if (v == null) return null; t += v; } return [t, i]; });
      per.pe = ttm(k => E[k]).map(v => v && v[0]);
      // partnerships file unit counts and V, STZ or PLNT file counts by share class, so no share count reaches the statements:
      // there, shares are the last four quarters of net income divided by the last four quarters of EPS
      const shAt = i => { if (L.sh[i] > 0) return L.sh[i]; let a = 0, b = 0; for (let k = i - 3; k <= i; k++) { if (k < 0 || L.ni[k] == null || L.eps[k] == null) return null; a += L.ni[k]; b += L.eps[k]; } return a > 0 && b >= 0.2 ? a / b : null; };
      if (da) per.ebitda = ttm(k => L.op[k] == null || da[k] == null ? null : L.op[k] + da[k]).map(v => v && shAt(v[1]) ? v[0] / shAt(v[1]) : null);
      // write-downs can sink operating income (TTWO, whose D&A line leaves out intangible amortization): when operating
      // income plus D&A comes to under half the EBITDA the company itself reports, use the reported one
      const own = (F.adjustments || []).find(a => /^ebitda$/i.test((a.name || '').trim()));
      if (own) { const ov = F.quarters.map((_, k) => own.q[k] && own.q[k].total != null ? own.q[k].total : null),
          oe = ttm(k => ov[k]).map(v => v && shAt(v[1]) ? v[0] / shAt(v[1]) : null), lo = oe[oe.length - 1], le = per.ebitda && per.ebitda[per.ebitda.length - 1];
        if (lo > 0 && !(le > lo / 2)) { per.ebitda = oe; VAL_OWN = true; } } }
    // forward P/E uses stored annual consensus vintages only (no hindsight realized earnings or trailing-growth extrapolation)
    if (rows && rows.length > 2) {
      VAL_FPE_ASOF = (B.meta && B.meta.as_of) || '';
      per.fpe = d.map(x => { const i = rows.findIndex(r => r[1] > x); if (i < 1 || !rows[i + 1]) return null;
        const a = Date.parse(rows[i - 1][1]), b = Date.parse(rows[i][1]);
        if (!(b > a) || !(rows[i][2] > 0) || !(rows[i + 1][2] > 0)) return null;
        const f = Math.max(0, Math.min(1, (Date.parse(x) - a) / (b - a)));
        return rows[i][2] * (1 - f) + rows[i + 1][2] * f; }); }
    const out = {};
    Object.keys(per).forEach(k => { const m = per[k].map((e, i) => e > 0 && c[i] > 0 && c[i] / e < 200 ? c[i] / e : null), ok = m.filter(v => v != null);
      if (ok.length < 8 || m[m.length - 1] == null) return;
      const L = ok.map(Math.log), mu = L.reduce((a, b) => a + b, 0) / L.length, sd = Math.sqrt(L.reduce((a, b) => a + (b - mu) ** 2, 0) / L.length), at = z => Math.exp(mu + z * sd);
      out[k] = { e: per[k], m, lo: Math.min(...ok), hi: Math.max(...ok), mid: at(0), up1: at(1), up5: at(.5), dn5: at(-.5), dn1: at(-1), skip: m.length - m.findIndex(t => t != null) - ok.length }; });
    if (Object.keys(out).length) VAL = { d, c, out }; };
  const drawVal = () => { show('valuation', !!VAL); if (!VAL) return;
    const have = Object.keys(VAL.out); [...$('valPick').children].forEach(b => { b.hidden = !have.includes(b.dataset.k); });
    const k = have.includes(valMode()) ? valMode() : have[0], v = VAL.out[k], n = v.m.length - 1, x = t => t.toFixed(1) + '×';
    [...$('valPick').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
    const from = v.m.findIndex(t => t != null), cutv = a => a.slice(from), e = cutv(v.e), c = cutv(VAL.c), d = cutv(VAL.d), m = cutv(v.m);
    // drawn on a log scale, so a stock whose earnings grew tenfold still shows its whole history
    const lg = a => a.map(p => p > 0 ? Math.log(p) : null), band = t => lg(e.map((q, i) => m[i] == null ? null : q * t)), hiC = '#c2851a', loC = '#1f9d94';
    const head = i => { const j = i == null ? m.length - 1 : i; $('valNow').textContent = m[j] == null ? '' : x(m[j]);
      $('valWhen').innerHTML = `<span>${VM[k][0]}, ${i == null ? 'now' : day(d[j], { month: 'short', year: 'numeric' })}</span>`; };
    chart($('valChart'), { lines: [{ v: lg(c), col: css('--ink'), w: 2.25 }, { v: band(v.up1), col: hiC, w: 1.5 }, { v: band(v.up5), col: hiC, w: 1.25, op: .55 }, { v: band(v.mid), col: css('--muted'), w: 1.5, dash: '5 5' },
      { v: band(v.dn5), col: loC, w: 1.25, op: .55 }, { v: band(v.dn1), col: loC, w: 1.5 }],
      label: `${sym} price and what it would be at its typical ${VM[k][0]} and a normal range around it`, onHover: head }); head(null);
    const when = t => day(d[m.indexOf(t)], { month: 'short', year: 'numeric' }), now = m[m.length - 1], eN = e[e.length - 1];
    const vs = t => { const r = (t / now - 1) * 100; return Math.abs(r) < .5 ? 'about today’s price' : pct(r, 0) + ' from today'; };
    const row = (sw, name, t, note, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row"><i style="${sw}"></i>${name}</th><td class="num">${x(t)}</td><td class="num">${usd(eN * t)}</td><td class="num soft">${note}</td></tr>`;
    const solid = col => `background:${col}`, faded = col => `background:${col};opacity:.55`, since = day(d[0], { month: 'short', year: 'numeric' });
    $('valTable').innerHTML = `<thead><tr><th></th><th title="${esc(VM[k][1])}">${VM[k][0]}</th><th title="Today's earnings figure times that multiple">Share price at that multiple</th><th></th></tr></thead><tbody>` +
      row(solid(css('--ink')), 'Now', now, pct((now / v.mid - 1) * 100, 0) + ' against typical') +
      row(solid(hiC), 'High', v.up1, vs(v.up1)) + row(faded(hiC), 'Above typical', v.up5, vs(v.up5)) +
      row(`background:none;border-top:1.5px dashed ${css('--muted')};height:0`, 'Typical', v.mid, vs(v.mid)) +
      row(faded(loC), 'Below typical', v.dn5, vs(v.dn5)) + row(solid(loC), 'Low', v.dn1, vs(v.dn1)) +
      row('background:none', 'Highest seen', v.hi, when(v.hi), 'ref') + row('background:none', 'Lowest seen', v.lo, when(v.lo), 'ref') + '</tbody>';
    $('valNote').textContent = `Typical is the middle of ${sym}'s ${VM[k][0]} readings since ${since}. About two in three readings fall between Low and High, and about four in ten fall between the two inner lines. ` +
      `The spread is measured in percent moves, so one extreme reading cannot stretch it. Highest and lowest seen are for reference and are not drawn.` +
      (k === 'fpe' && VAL_FPE_ASOF ? ` Consensus estimates were updated ${day(VAL_FPE_ASOF)}.` : '') +
      (k === 'pe' && VAL_ADJ ? ` Earnings here are ${sym}'s adjusted earnings per share, because write-downs have kept reported earnings below zero. They come from the adjustments listed in its earnings releases.` : '') +
      (k === 'ebitda' && VAL_OWN ? ` EBITDA here is the figure ${sym} reports in its earnings releases, because write-downs and amortization push its operating income far below it.` : '') +
      (v.skip > 0 ? ` ${v.skip} of the ${v.skip + m.filter(t => t != null).length} readings are left out because earnings were negative or the multiple was above 200×.` : ''); };
  const valRange = pick($('valRange'), [['1Y'], ['3Y'], ['5Y'], ['10Y']], 'equinox.company.valrange.v1', '5Y', () => { buildVal(); drawVal(); });
  const valMode = pick($('valPick'), Object.keys(VM).map(k => [k, VM[k][0]]), 'equinox.company.multiple.v1', 'pe', drawVal);
  onRedraw(() => { draw(); drawDots(); buildVal(); drawVal(); });

  $('aboutMore').onclick = e => { const open = $('about').classList.toggle('clamp') === false;
    e.target.textContent = open ? 'Show less' : 'Show more'; e.target.setAttribute('aria-expanded', open); };
  const rows = (id, list) => { $(id).innerHTML = list.filter(Boolean).map(([k, v, t, c]) => `<div class="row"><dt${t ? ` title="${esc(t)}"` : ''}>${k}</dt><dd class="num ${c || ''}">${v}</dd></div>`).join(''); };
  const show = (id, on) => { $(id).hidden = !on; };
  // '' means the list. A section name in the address (#calls) means that section of the last company viewed.
  const anchor = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) {} return h; };
  const want = () => { let h = anchor();
    if (h && document.getElementById(h)) { try { h = localStorage.getItem(LAST) || ''; } catch (_) { h = ''; } }
    return h; };

  // the landing view: a search bar and the screener (market-lab-eq-screen.js)
  function list() {
    if ($('list').hidden) again($('list'));
    $('detail').hidden = true; $('list').hidden = false; document.title = 'Equity Screener · Equinox'; sideSync(); MarketLab.menu(''); sym = ''; owner('');
    EQScreen();
  }
  // this page's sections in the left menu: shown for a company, and they scroll without changing the address
  const side = document.querySelector('nav.side'), watch = spy();
  const again = el => { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); };
  const sideSync = () => { side.hidden = !sym || $('detail').hidden; [...side.children].forEach(a => { const t = $(a.getAttribute('href').slice(1)); a.hidden = !t || t.hidden; }); watch(); };
  side.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault();
    const t = $(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  finder($('find'), id => { location.hash = encodeURIComponent(id); });

  async function load() {
    const me = ++run, ask = want();
    if (!ask) return list();
    if ($('detail').hidden) again($('detail'));
    $('list').hidden = true; $('detail').hidden = false;
    const T = await trend().catch(() => null); if (me !== run) return;
    const up = ask.toUpperCase(), S = T && (T.series.find(x => x.id === ask) || T.series.find(x => x.id.toUpperCase() === up && (x.kind === 'equity' || x.kind === 'asset')) || T.series.find(x => x.id.toUpperCase() === up));
    P = F = FULL = null; AVG = {}; CALLS = []; SAID = null; grow(false); ['chart', 'dots'].forEach(k => $(k).innerHTML = '');
    $('pricePanel').classList.toggle('none', !S);
    if (!S) { sym = ''; owner(''); $('stamp').textContent = ''; $('name').textContent = ask; $('sub').textContent = ''; $('price').innerHTML = '&nbsp;'; $('chg').textContent = '';
      $('chart').innerHTML = `<p class="gone">Equinox has no prices for ${esc(ask)}. Search for another company in the bar above.</p>`;
      ['overview', 'technicals', 'fundamentals', 'earnings', 'valuation', 'calls'].forEach(k => show(k, false)); sideSync(); MarketLab.menu(''); return; }
    sym = S.id; owner(sym); try { localStorage.setItem(LAST, sym); } catch (_) {}
    MarketLab.menu(sym); $('callsAll').href = 'market-lab-company-calls.html#' + encodeURIComponent(sym);
    const short = S.label.startsWith(sym + ' · ') ? S.label.slice(sym.length + 3) : S.label;
    $('name').textContent = short; $('sub').textContent = sym; document.title = `${short} · Equinox`;
    ['overview', 'technicals', 'fundamentals', 'earnings', 'valuation', 'calls'].forEach(k => show(k, false));

    const [TI, prof, fin, calls, ups, ox, SPX] = await Promise.all([
      json('cube/technical-index.json').catch(() => null),
      json('cube/company-profiles.json').then(d => d.rows[sym]).catch(() => null),
      json(`financials/${encodeURIComponent(sym)}.json`).catch(() => null),
      json('cube/calls/index.json').then(m => (m.tickers || {})[sym.toUpperCase()], () => null)   // company call files are named by company
        .then(f => f && f !== sym.toLowerCase() ? json(`cube/calls/${encodeURIComponent(f)}.json`).catch(() => json(`cube/calls/${encodeURIComponent(sym.toLowerCase())}.json`)) : json(`cube/calls/${encodeURIComponent(sym.toLowerCase())}.json`)).catch(() => null),
      json('cube/company-updates.json').then(d => d.rows[sym]).catch(() => null),
      json('cube/overextension.json').then(d => d.rows[sym] || d.rows[sym.toLowerCase()]).catch(() => null),
      series('spy').catch(() => null)]);
    if (me !== run) return;
    const tr = TI && (TI.rows[sym] || TI.rows[(TI.aliases || {})[sym]]);
    const tech = tr ? await json('cube/' + tr.file).catch(() => null) : null; if (me !== run) return;

    // prices: the technical file carries a year of days, three years of weeks and ten of months
    if (tech) { const g = k => ({ d: tech[k].dates, c: tech[k].close }); P = { daily: g('daily'), weekly: g('weekly'), monthly: g('monthly') }; }
    else { const p = await prices(S.file).catch(() => null); if (me !== run) return;
      if (p) { const all = { d: p.dates, c: p.close }; P = { daily: cut(all, 252), weekly: cut(all, 756), monthly: cut(all, 2520) }; } }
    if (!P) { fail($('chart')); return; }
    const D = P.daily, last = D.c[D.c.length - 1], prev = D.c[D.c.length - 2];
    $('stamp').textContent = 'Updated ' + day(D.d[D.d.length - 1]);
    draw();
    prices(S.file).then(p => { if (me !== run) return; FULL = p; if (ma.length) draw(); }).catch(() => {});
    Promise.all(cmp.map(fetchCmp)).then(() => { if (me === run && cmp.some(id => id !== sym && CP[id])) draw(); });

    // overview
    if (prof) { $('name').textContent = prof.name || short; document.title = `${prof.name || short} · Equinox`;
      $('sub').textContent = [sym, prof.industry, prof.country].filter(Boolean).join(' · '); }
    const L = fin && fin.lines, n = L ? L.rev.length - 1 : -1, yr = D.c.slice(-252), dchg = (last / prev - 1) * 100;
    const eps4 = L && L.eps.slice(-4).every(v => v != null) ? L.eps.slice(-4).reduce((a, b) => a + b, 0) : null;
    // beta: how the stock's daily changes line up with the S&P 500's over the same year of days (covariance over variance)
    let beta = null;
    if (SPX) { const m = new Map(); for (let i = Math.max(0, SPX.dates.length - 400); i < SPX.dates.length; i++) m.set(SPX.dates[i], SPX.close[i]);
      const X = [], Y = []; for (let i = 1; i < D.d.length; i++) { const a = m.get(D.d[i - 1]), b = m.get(D.d[i]); if (a > 0 && b > 0 && D.c[i - 1] > 0 && D.c[i] > 0) { X.push(b / a - 1); Y.push(D.c[i] / D.c[i - 1] - 1); } }
      if (X.length >= 120) { const mean = v => v.reduce((p, q) => p + q, 0) / v.length, mx = mean(X), my = mean(Y); let cov = 0, vr = 0;
        X.forEach((x, i) => { cov += (x - mx) * (Y[i] - my); vr += (x - mx) * (x - mx); }); if (vr > 0) beta = cov / vr; } }
    $('about').textContent = prof && prof.summary || ''; $('about').classList.add('clamp');
    $('about').hidden = $('aboutMore').hidden = !(prof && prof.summary); $('aboutMore').textContent = 'Show more'; $('aboutMore').setAttribute('aria-expanded', false);
    rows('overviewRows', [
      L && L.sh[n] ? ['Market value', big(last * L.sh[n] * 1e6), 'Share price times diluted shares'] : null,
      ['Latest day', pct(dchg, 2), '', tone(dchg)],
      eps4 > 0 ? ['Price to earnings', (last / eps4).toFixed(1), 'Share price divided by the last four quarters of earnings per share'] : null,
      ['52-week high', usd(Math.max(...yr))],
      prof && prof.sector ? ['Sector', esc(prof.sector)] : null,
      ['52-week low', usd(Math.min(...yr))],
      fin && fin.fy_end_month ? ['Fiscal year ends', new Date(2026, fin.fy_end_month - 1, 1).toLocaleDateString('en-US', { month: 'long' })] : null,
      L && L.sh[n] ? ['Shares', (L.sh[n] / 1e3).toFixed(L.sh[n] >= 1e4 ? 1 : 2) + ' billion', 'Diluted shares, latest quarter'] : null,
      beta == null ? null : ['Beta vs S&amp;P 500 (1 year)', beta.toFixed(2), 'How far the stock tends to move when the S&P 500 moves 1%. Worked out from daily changes over the past year, with the SPY fund standing in for the index.']]);
    show('overview', true);

    // technicals
    const t = tech && tech.daily.latest;
    if (t) { const V = t.values, gap = k => [`Versus ${k}-day average`, pct(t.ema[k]), '', tone(t.ema[k])];
      const techRows = (rsiRow, highRow, whenRow) => rows('techRows', [
        ['RSI, 14 days', V.rsi14.toFixed(1), 'A 0 to 100 speed gauge. Under 30 means the stock has fallen fast.'], rsiRow,
        ['Typical daily swing', V.atrPercent.toFixed(1) + '%', 'Average true range over 14 days, as a share of price'],
        ['Volume versus normal', V.rvol.toFixed(2) + '×', 'Latest volume divided by its usual level'],
        gap(10), ox ? [`Stretch ${ox.downside ? 'below' : 'above'} trend`, `${Math.round(ox.score)} of 100`, 'How far price sits from its 20, 50 and 200-day averages and its usual trading band, ranked against its own last 500 days. 100 is the most stretched it gets.', ox.score >= 90 ? (ox.downside ? 'down' : 'up') : ''] : null,
        gap(21), highRow, gap(50), whenRow, gap(200)]);
      techRows();
      prices(S.file).then(p => { if (me !== run) return; const c = p.close, N = c.length; if (N < 30) return;
        // Wilder RSI for every day on record, then the share of days at least as extreme as today
        let up = 0, dn = 0; const all = [];
        for (let i = 1; i < N; i++) { const ch = c[i] - c[i - 1], u = Math.max(ch, 0), w = Math.max(-ch, 0);
          if (i <= 14) { up += u / 14; dn += w / 14; } else { up = (up * 13 + u) / 14; dn = (dn * 13 + w) / 14; }
          if (i >= 14) all.push(dn ? 100 - 100 / (1 + up / dn) : 100); }
        const r = V.rsi14, hi = r >= 50, share = all.filter(v => hi ? v >= r : v <= r).length / all.length * 100;
        let m = 0; for (let i = 1; i < N; i++) if (c[i] >= c[m]) m = i;
        const off = (c[N - 1] / c[m] - 1) * 100;
        techRows([`Days with RSI this ${hi ? 'high' : 'low'}`, (share < 1 ? share.toFixed(1) : share.toFixed(0)) + '%', `Share of trading days since ${day(p.dates[14], { month: 'short', year: 'numeric' })} when the 14-day RSI was at ${r.toFixed(1)} or ${hi ? 'above' : 'below'}`],
          ['From all-time high', m === N - 1 ? 'At the high' : pct(off, 1), 'Latest close against the highest close on record. Prices are adjusted for splits and dividends.', m === N - 1 ? '' : 'down'],
          ['All-time high set', day(p.dates[m]), 'The day of the highest close on record']); }).catch(() => {});
      $('techStamp').textContent = 'Updated ' + day(t.updated); show('technicals', true); }

    CALLS = calls && calls.calls || []; if (CALLS.length) draw();
    json(`call-guidance/${encodeURIComponent(sym)}.json`).then(d => { if (me === run) { SAID = d.calls; drawDots(); } }).catch(() => {});
    // fundamentals and the earnings dots
    if (L && n >= 4) { F = fin; const q = fin.quarters, cols = [n - 4, n - 3, n - 2, n - 1, n], share = (a, b) => a == null || !b ? '' : (a / b * 100).toFixed(1) + '%';
      const cash = (fin.kpi_groups || []).flatMap(g => g.rows).find(r => /^free cash flow$/i.test(r.name));
      const line = (name, f, soft, colored) => `<tr class="${soft ? 'soft' : ''}"><th scope="row">${name}</th>${cols.map(i => { const v = f(i); return `<td class="num ${colored ? tone(v) : ''}">${colored ? pct(v, 0) : v}</td>`; }).join('')}</tr>`;
      $('finTable').innerHTML = `<thead><tr><th>Quarter ended</th>${cols.map(i => `<th>${esc(q[i].label)}</th>`).join('')}</tr></thead><tbody>` +
        line('Revenue', i => money(L.rev[i])) +
        line('Year over year', i => L.rev[i - 4] > 0 ? (L.rev[i] / L.rev[i - 4] - 1) * 100 : null, true, true) +
        (L.gp && L.gp.some(v => v) ? line('Gross margin', i => share(L.gp[i], L.rev[i]), true) : '') +
        line('Operating margin', i => share(L.op[i], L.rev[i]), true) +
        line('Net income', i => money(L.ni[i])) + line('Earnings per share', i => usd(L.eps[i])) +
        (cash ? line('Free cash flow', i => money(cash.values[i])) : '') + '</tbody>';
      $('finStamp').textContent = 'Updated ' + day(fin.updated); show('fundamentals', true);
      // the Financials page opens on the ticker in its saved view, so point that at this company
      try { const v = JSON.parse(localStorage.getItem('equinox.fin.view') || '{}') || {}; if (v.ticker !== sym) localStorage.setItem('equinox.fin.view', JSON.stringify({ ...v, ticker: sym })); } catch (_) {}
      show('earnings', true); drawDots(); }

    buildVal(); drawVal();
    // the latest results in words
    const U = ups; $('recap').hidden = !U;
    if (U) { $('recap').innerHTML = `<div><p class="lede">${esc(U.summary)}</p><p>${U.url ? `<a class="link" href="${esc(U.url)}" target="_blank" rel="noopener">Read the ${esc(U.period)} release</a> ` : ''}<span style="color:var(--faint);font-size:14px;margin-left:10px">Published ${day(U.published)}</span></p></div>
      <div><h3>Revenue growth</h3><p>${esc(U.growth && U.growth.text || 'No year-over-year comparison is available.')}</p><h3>Guidance</h3><p>${esc(U.guidance && U.guidance.text || 'No guidance comparison is available.')}</p>${U.watch ? `<h3>What to watch</h3><p>${esc(U.watch)}</p>` : ''}</div>`;
      if (!F) { show('earnings', true); $('dots').hidden = $('dotsPick').hidden = $('dotsLegend').hidden = true; } }
    if (F) $('dots').hidden = $('dotsPick').hidden = $('dotsLegend').hidden = false;
    else if (CALLS.length) { show('earnings', true); $('dots').hidden = $('dotsLegend').hidden = false; $('dotsPick').hidden = true; drawDots(); }

    // earnings calls
    const C = calls && calls.calls || [];
    if (C.length) { const mv = v => v == null ? '<td></td>' : `<td class="num ${tone(v)}">${pct(v * 100)}</td>`;
      $('callTable').innerHTML = `<thead><tr><th>Call</th><th>Date</th><th title="Stock move on the first trading day after the call">Next day</th><th>5 days</th><th title="Next-day move minus the S&amp;P 500 move">Vs S&amp;P 500</th></tr></thead><tbody>` +
        C.slice(-8).reverse().map(c => { const m = c.move || {}, [fq, fy] = c.id.split(' ').reverse(), rel = m.r1 == null || m.r1_spy == null ? null : m.r1 - m.r1_spy;
          const nm = `${esc(fq)} fiscal ${esc(fy)}`;
          return `<tr><td style="font-weight:400">${/^https?:/.test(c.url || '') && !/huggingface\.co/.test(c.url) ? `<a class="link" href="${esc(c.url)}" target="_blank" rel="noopener" title="Open the transcript">${nm}</a>` : nm}</td><td class="num soft">${day(c.d)}</td>${mv(m.r1)}${mv(m.r5)}${mv(rel)}</tr>`; }).join('') + '</tbody>';
      $('callStamp').textContent = calls.updated ? 'Updated ' + day(calls.updated) : '';
      show('calls', true); }
    sideSync();
    const a = anchor(), to = a && $(a); if (to && !to.hidden) to.scrollIntoView();
  }
  // a section name keeps the company on screen; anything else is a new company or the list
  addEventListener('hashchange', () => { const a = anchor(); if (a && $(a) && !$('detail').hidden && sym) return; if (!(a && $(a))) scrollTo(0, 0); load(); });
  addEventListener('popstate', () => { if (!location.hash) load(); });
  load();
})();
