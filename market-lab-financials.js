/* Financials: statement grid with editable estimate drivers.
   Data: web/financials/<T>.json (built by ops/financials from SEC filings), listed in
   web/financials/index.json. Falls back to a made-up sample company if those are missing. */
(function () {
  'use strict';

  const FCST = 8;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LINES = ['rev', 'cogs', 'gp', 'rd', 'sga', 'oox', 'op', 'oth', 'pre', 'tax', 'ni', 'sh', 'eps'];
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const VIEW = 'equinox.fin.view';
  const view = Object.assign({ticker: null, period: 'q', units: 'M', dec: 1, pct: true, newest: false, tab: 'is', checked: {}}, store.get(VIEW, {}));
  if (Array.isArray(view.checked)) view.checked = {};
  delete view.revsrc;

  // ---------- sample company (fallback only) ----------
  function sample() {
    const N = 40, segs = ['Cloud', 'Devices', 'Licensing'];
    const wob = (i, k, a) => a * Math.sin(i * 1.7 + k * 2.3) * Math.cos(i * .6 + k);
    const quarters = [], L = Object.fromEntries(LINES.map(k => [k, []])), rows = segs.map(name => ({name, values: []}));
    for (let i = 0; i < N; i++) {
      const y = 2016 + Math.floor((i + 3) / 4), q = i % 4, m = [11, 2, 5, 8][q];
      quarters.push({id: `FY${y}Q${q + 1}`, fy: y, fq: q + 1, end: `${q === 0 ? y - 1 : y}-${String(m + 1).padStart(2, '0')}-28`, label: `${MON[m]} '${String(q === 0 ? y - 1 : y).slice(2)}`});
      rows[0].values[i] = 300 * Math.pow(1.05, i) * (1 + wob(i, 1, .02));
      rows[1].values[i] = 480 * [1.28, .9, .95, 1][q] * Math.pow(1.03, i / 4) * (1 + wob(i, 2, .03));
      rows[2].values[i] = 260 * Math.pow(1.011, i) * (1 + wob(i, 3, .015));
      const rev = rows.reduce((t, r) => t + r.values[i], 0);
      L.rev[i] = rev; L.gp[i] = rev * (.6 + .002 * i + wob(i, 4, .006)); L.cogs[i] = rev - L.gp[i];
      L.rd[i] = rev * (.15 - .0006 * i); L.sga[i] = rev * (.2 - .001 * i + wob(i, 6, .005)); L.oox[i] = 0;
      L.op[i] = L.gp[i] - L.rd[i] - L.sga[i]; L.oth[i] = 6 + wob(i, 7, 4); L.pre[i] = L.op[i] + L.oth[i];
      L.tax[i] = L.pre[i] * (.17 + wob(i, 8, .012)); L.ni[i] = L.pre[i] - L.tax[i];
      L.sh[i] = 430 * Math.pow(.996, i); L.eps[i] = L.ni[i] / L.sh[i];
    }
    return {ticker: 'NWND', name: 'Northwind Instruments', quarters, lines: L, segment_groups: [{id: 'seg', label: 'Segments', rows}]};
  }

  // ---------- company state ----------
  let D, Q, HIST, GROUPS, KG, FSEG, segMode, hasOox, ov, mode, KEY, M, MET, SKIP = new Set();
  const MET0 = {
    gp:  {pct: ['gm', 'Gross margin'], yoy: ['gp_g', 'Gross profit % chg YoY']},
    rd:  {pct: ['rdp', 'R&D % of revenue'], yoy: ['rd_g', 'R&D % chg YoY']},
    sga: {pct: ['sgap', 'SG&A % of revenue'], yoy: ['sga_g', 'SG&A % chg YoY']},
    oox: {pct: ['ooxp', 'Other operating costs % of revenue'], yoy: ['oox_g', 'Other operating costs % chg YoY']},
    oth: {pct: ['othp', 'Other income % of revenue'], yoy: ['oth_g', 'Other income % chg YoY']},
  };
  // lines this company does not report (ops/financials/reporting_templates.json): with no gross profit the
  // forecast drives operating profit directly; with no operating line it drives pre-tax income
  const MET_OP = {pct: ['opm', 'Operating margin'], yoy: ['op_g', 'Operating profit % chg YoY']};
  const MET_PRE = {pct: ['prem', 'Pretax margin'], yoy: ['pre_g', 'Pretax income % chg YoY']};
  function setMet() {
    SKIP = new Set(D.skip_lines || []);
    MET = {...MET0};
    if (SKIP.has('gp')) { delete MET.gp; delete MET.oox; MET.op = MET_OP; }
    ['rd', 'sga'].forEach(k => { if (SKIP.has(k)) delete MET[k]; });
    if (SKIP.has('op')) { delete MET.op; delete MET.oth; MET.pre = MET_PRE; }
  }
  const modeOf = m => mode[m] === 'yoy' ? 'yoy' : 'pct';
  const save = () => { store.set(KEY, {ov, mode}); store.set(VIEW, view); };
  const ok = v => v != null && isFinite(v);

  function setup(data) {
    D = data; HIST = D.quarters.length;
    Q = D.quarters.map((q, i) => Object.assign({}, q, {i, est: false}));
    let {fy, fq} = D.quarters[HIST - 1];
    let [ey, em] = D.quarters[HIST - 1].end.split('-').map(Number);
    for (let k = 0; k < FCST; k++) {
      fq++; if (fq > 4) { fq = 1; fy++; }
      em += 3; if (em > 12) { em -= 12; ey++; }
      Q.push({id: `FY${fy}Q${fq}`, fy, fq, end: null, label: `${MON[em - 1]} '${String(ey).slice(2)}`, i: HIST + k, est: true});
    }
    GROUPS = (D.segment_groups || []).map((g, gi) => ({gi, label: g.label, rows: g.rows.map(r => ({key: `${gi}|${r.name}`, name: r.name, values: r.values.slice(), gap: new Set()}))}));
    // KPI tab rows: reported figures only, estimate columns stay blank
    KG = (D.kpi_groups || []).map((g, gi) => ({gi: `k${gi}`, label: g.label, rows: g.rows.map(r => ({...r, key: `${gi}|${r.name}`}))}));
    // The newest segment set drives the forecast. When a company skipped restating some quarters
    // (NVDA FY26 Q3-Q4), fill them from the mix of the reported quarters on each side so year-ago
    // growth works. Those cells are marked as estimates in the grid.
    const g0 = GROUPS[0];
    if (g0) {
      const rev = D.lines.rev, rep = [];
      for (let i = 0; i < HIST; i++) if (g0.rows.every(r => ok(r.values[i]))) rep.push(i);
      for (let a = 0; a < rep.length - 1; a++) {
        const p = rep[a], n = rep[a + 1];
        for (let i = p + 1; i < n; i++) {
          const w = (i - p) / (n - p);
          g0.rows.forEach(r => {
            const sp = r.values[p] / rev[p], sn = r.values[n] / rev[n];
            r.values[i] = (sp + w * (sn - sp)) * rev[i]; r.gap.add(i);
          });
        }
      }
    }
    FSEG = g0 ? g0.rows.filter(r => ok(r.values[HIST - 1])) : [];
    segMode = FSEG.length > 0 && [1, 2, 3, 4].every(b => {
      const i = HIST - b, s = FSEG.reduce((t, r) => t + (ok(r.values[i]) ? r.values[i] : NaN), 0);
      return isFinite(s) && Math.abs(s / D.lines.rev[i] - 1) < .01;
    });
    if (!segMode) FSEG = [];
    setMet();
    hasOox = !SKIP.has('oox') && (D.lines.oox || []).some(v => ok(v) && Math.abs(v) > .5);
    KEY = `equinox.fin.v1.${D.ticker}`;
    const saved = store.get(KEY, {});
    ov = saved.ov || {}; mode = saved.mode || {};
    const mb = document.querySelector('.fin-tabs [data-tab="muse"]');
    if (mb) mb.hidden = D.ticker !== 'META';
    if (view.tab === 'muse' && (!mb || mb.hidden)) view.tab = 'is';
    document.querySelectorAll('.fin-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === view.tab)));
    $('co-name').textContent = D.name;
    $('co-tk').textContent = D.ticker;
    document.title = `${D.ticker} financials — Equinox`;
  }

  // ---------- drivers ----------
  // this quarter's edit, else the nearest edit to its left, else the default
  function look(k, i) {
    for (let j = i; j >= HIST; j--) { const v = ov[`${k}|${Q[j].id}`]; if (v != null) return {v, j}; }
    return null;
  }
  const drv = (k, i, def) => { const h = look(k, i); return h ? h.v : def; };
  const state = (k, i) => { const h = look(k, i); return !h ? '' : h.j === i ? 'edited' : 'carried'; };
  const revState = i => {
    if (!segMode) return state('g', i);
    const ss = FSEG.map(r => state(`seg:${r.name}`, i));
    return ss.includes('edited') ? 'edited' : ss.includes('carried') ? 'carried' : '';
  };

  // ---------- model ----------
  const sum4 = (a, s) => a[s] + a[s + 1] + a[s + 2] + a[s + 3];
  const fin = (v, d = 0) => ok(v) ? v : d;
  const yoyDef = a => fin(sum4(a, HIST - 4) / sum4(a, HIST - 8) - 1);   // trailing 4 quarters vs the 4 before
  // Default revenue path: the average yearly growth of the last 3 full fiscal years, compounded per
  // year ahead and split over the quarters by each quarter's average share of the year (same 3 years).
  // Returns i => growth vs the same quarter a year earlier, or null when there are not 2 full years.
  function g3Path(a) {
    const yrs = {};
    for (let i = 0; i < HIST; i++) (yrs[Q[i].fy] = yrs[Q[i].fy] || []).push(i);
    const tot = y => yrs[y].reduce((t, i) => t + a[i], 0);
    const full = y => yrs[y] && yrs[y].length === 4 && yrs[y].every(i => ok(a[i])) && tot(y) > 0;
    const last = Object.keys(yrs).map(Number).filter(full).pop();
    if (last == null) return null;
    const gs = [];
    for (let y = last; y > last - 3 && full(y) && full(y - 1); y--) gs.push(tot(y) / tot(y - 1) - 1);
    if (!gs.length) return null;
    const g = gs.reduce((s, x) => s + x, 0) / gs.length;
    const sy = [last, last - 1, last - 2].filter(full);
    const share = [0, 1, 2, 3].map(q => sy.reduce((s, y) => s + a[yrs[y][q]] / tot(y), 0) / sy.length);
    const tgt = j => j < HIST ? a[j] : tot(last) * Math.pow(1 + g, Q[j].fy - last) * share[Q[j].fq - 1];
    return i => { const b = tgt(i - 4); return ok(b) && b > 0 ? tgt(i) / b - 1 : g; };
  }
  const pathOr = (a, flat) => g3Path(a) || (() => flat);

  function build() {
    const T = HIST + FCST;
    const L = {seg: {}};
    LINES.forEach(k => { L[k] = (D.lines[k] || []).slice(); L[k].length = T; });
    if (!hasOox) for (let i = 0; i < HIST; i++) L.oox[i] = fin(L.oox[i]);
    GROUPS.forEach(g => g.rows.forEach(r => { L.seg[r.key] = r.values.slice(); L.seg[r.key].length = T; }));
    const flatG = yoyDef(L.rev), defG = pathOr(L.rev, flatG);
    // fallback when a segment has under 2 full years: last 4 reported quarters vs a year earlier, using only pairs that were both reported
    const segDef = r => {
      let a = 0, b = 0;
      for (let i = HIST - 4; i < HIST; i++) if (ok(r.values[i]) && ok(r.values[i - 4]) && !r.gap.has(i) && !r.gap.has(i - 4)) { a += r.values[i]; b += r.values[i - 4]; }
      return b > 0 ? a / b - 1 : flatG;
    };
    const defSeg = Object.fromEntries(FSEG.map(r => [r.key, pathOr(r.values, segDef(r))]));
    const defY = Object.fromEntries(Object.keys(MET).map(m => [m, yoyDef(L[m])]));
    const taxDef = fin(sum4(L.tax, HIST - 4) / sum4(L.pre, HIST - 4), .15);
    const shG = fin(Math.pow(L.sh[HIST - 1] / L.sh[HIST - 5], .25), 1);
    for (let i = HIST; i < T; i++) {
      const ya = i - 4;
      if (segMode) {
        FSEG.forEach(r => { L.seg[r.key][i] = L.seg[r.key][ya] * (1 + drv(`seg:${r.name}`, i, defSeg[r.key](i))); });
        L.rev[i] = FSEG.reduce((t, r) => t + L.seg[r.key][i], 0);
      } else {
        L.rev[i] = L.rev[ya] * (1 + drv('g', i, defG(i)));
      }
      Object.keys(MET).forEach(m => {
        const k = MET[m][modeOf(m)][0];
        L[m][i] = modeOf(m) === 'pct' ? L.rev[i] * drv(k, i, fin(fin(L[m][ya]) / L.rev[ya])) : fin(L[m][ya]) * (1 + drv(k, i, defY[m]));
      });
      if (MET.gp) { L.cogs[i] = L.rev[i] - L.gp[i]; L.op[i] = L.gp[i] - fin(L.rd[i]) - fin(L.sga[i]) - fin(L.oox[i]); }
      if (!MET.pre) L.pre[i] = L.op[i] + L.oth[i];
      L.tax[i] = L.pre[i] * drv('taxr', i, taxDef);
      L.ni[i] = L.pre[i] - L.tax[i];
      L.sh[i] = drv('sh', i, L.sh[i - 1] * shG);
      L.eps[i] = L.ni[i] / L.sh[i];
    }
    for (let i = 0; i < HIST; i++) if (!ok(L.eps[i]) && ok(L.ni[i]) && ok(L.sh[i])) L.eps[i] = L.ni[i] / L.sh[i];
    M = L;
  }

  // ---------- columns (quarters or fiscal years) ----------
  function columns() {
    if (view.period === 'q') return Q.map(q => ({key: q.id, label: `Q${q.fq} FY${String(q.fy).slice(2)}`, date: q.label, est: q.est, idx: [q.i], qi: q.i}));
    const out = [], years = [...new Set(Q.map(q => q.fy))];
    years.forEach(y => {
      const idx = Q.filter(q => q.fy === y).map(q => q.i);
      if (idx.length === 4) out.push({key: `FY${y}`, fy: y, label: `FY${String(y).slice(2)}`, date: Q[idx[3]].label, est: idx.some(i => Q[i].est), idx});
    });
    return out;
  }
  // the columns on screen: the chosen From/To range, with or without estimates
  function shownCols() {
    const fyOf = id => +String(id).slice(2, 6), lo = view.from, hi = view.to;
    return columns().filter(c => {
      if (c.est && view.est === false) return false;
      if (view.period === 'q') return (!lo || c.key >= lo) && (!hi || c.key <= hi);
      return (!lo || c.fy >= fyOf(lo)) && (!hi || c.fy <= fyOf(hi));
    });
  }
  function rangeUI() {
    const all = columns().filter(c => !c.est || view.est !== false), on = shownCols();
    const opt = (end, c) => {
      const v = view.period === 'q' ? c.key : `FY${c.fy}Q${end ? 4 : 1}`;
      return `<option value="${v}">${c.label}${c.est ? 'E' : ''}</option>`;
    };
    $('from').innerHTML = all.map(c => opt(false, c)).join('');
    $('to').innerHTML = all.map(c => opt(true, c)).join('');
    if (on.length) { $('from').selectedIndex = all.indexOf(all.find(c => c.key === on[0].key)); $('to').selectedIndex = all.indexOf(all.find(c => c.key === on[on.length - 1].key)); }
  }
  const S = (arr, idx) => { let t = 0; for (const i of idx) { if (!ok(arr[i])) return null; t += arr[i]; } return t; };
  const A = (arr, idx) => { const s = S(arr, idx); return s == null ? null : s / idx.length; };
  function val(line, col) {
    if (line === 'sh') return A(M.sh, col.idx);
    if (line === 'eps') { if (col.idx.length === 1) return M.eps[col.idx[0]]; const n = S(M.ni, col.idx), s = A(M.sh, col.idx); return n == null || s == null ? null : n / s; }
    if (line.startsWith('seg|')) return S(M.seg[line.slice(4)], col.idx);
    if (line.startsWith('kpi|')) return kval(KPI[line.slice(4)], col);
    return S(M[line], col.idx);
  }
  function yearAgo(col) {
    if (view.period === 'q') return col.qi >= 4 ? {idx: [col.qi - 4]} : null;
    const idx = Q.filter(q => q.fy === col.fy - 1).map(q => q.i);
    return idx.length === 4 ? {idx, fy: col.fy - 1} : null;
  }
  // a KPI cell: the quarter as reported; a fiscal year as the build worked it out (sum, year-end figure or ratio)
  let KPI = {};
  function kval(r, col) {
    if (!r) return null;
    if (r.unit === 'text') return col.idx.length === 1 ? r.values[col.idx[0]] ?? null : null;
    if (col.idx.length === 1) { const v = r.values[col.idx[0]]; return ok(v) ? v : null; }
    const v = (r.annual || {})[String(col.fy)];
    return ok(v) ? v : null;
  }
  const growth = (line, col) => { const p = yearAgo(col); if (!p) return null; const a = val(line, col), b = val(line, p); return a == null || b == null || b <= 0 ? null : a / b - 1; };
  const ratio = (a, b) => col => { const x = val(a, col), y = val(b, col); return x == null || !y ? null : x / y; };

  // ---------- rows ----------
  // kind: v = $ value, p = percent, s = per share, n = share count. drv = editable driver key (estimate quarters only).
  function metRow(m, cls) {
    if (!MET[m]) return null;  // a line this company does not report
    const md = modeOf(m), [k, label] = MET[m][md];
    return {id: `${m}_d`, label, kind: 'p', sub: 1, cls, drv: k, mode: m, f: md === 'pct' ? ratio(m, 'rev') : c => growth(m, c)};
  }
  const revG = () => ({id: 'rev_g', label: 'Revenue % chg YoY', kind: 'p', sub: 1, f: c => growth('rev', c), drv: 'g'});
  const IS_ROWS = () => relabel(([
    {id: 'rev', label: 'Total revenue', kind: 'v', cls: 'total', f: c => val('rev', c)},
    revG(),
    {id: 'cogs', label: 'Cost of sales', kind: 'v', cls: 'rule', f: c => val('cogs', c)},
    {id: 'gp', label: 'Gross profit', kind: 'v', cls: 'total', f: c => val('gp', c)},
    metRow('gp'),
    {id: 'rd', label: 'Research & development', kind: 'v', f: c => val('rd', c)},
    metRow('rd'),
    {id: 'sga', label: 'Selling, general & administrative', kind: 'v', f: c => val('sga', c)},
    metRow('sga', hasOox ? '' : 'rule'),
    ...(hasOox ? [{id: 'oox', label: 'Other operating costs', kind: 'v', f: c => val('oox', c)}, metRow('oox', 'rule')] : []),
    {id: 'op', label: 'Operating profit', kind: 'v', cls: 'total', f: c => val('op', c)},
    ...drvSwap('op', [{id: 'opm', label: 'Operating margin', kind: 'p', sub: 1, f: ratio('op', 'rev')},
      {id: 'op_g', label: 'Operating profit % chg YoY', kind: 'p', sub: 1, cls: 'rule', f: c => growth('op', c)}]),
    {id: 'oth', label: 'Interest & other income', kind: 'v', f: c => val('oth', c)},
    metRow('oth', 'rule'),
    {id: 'pre', label: 'Pretax income', kind: 'v', cls: 'total', f: c => val('pre', c)},
    ...(MET.pre ? [metRow('pre')] : []),
    {id: 'tax', label: 'Income tax', kind: 'v', f: c => val('tax', c)},
    {id: 'taxr', label: 'Tax rate', kind: 'p', sub: 1, cls: 'rule', f: ratio('tax', 'pre'), drv: 'taxr'},
    {id: 'ni', label: 'Net income', kind: 'v', cls: 'total', f: c => val('ni', c)},
    {id: 'nim', label: 'Net margin', kind: 'p', sub: 1, cls: 'rule', f: ratio('ni', 'rev')},
    {id: 'sh', label: 'Diluted shares (M)', kind: 'n', f: c => val('sh', c), drv: 'sh'},
    {id: 'eps', label: 'Diluted EPS', kind: 's', cls: 'total', f: c => val('eps', c)},
    {id: 'eps_g', label: 'EPS % chg YoY', kind: 'p', sub: 1, f: c => growth('eps', c)},
  ].filter(r => r && !SKIP.has(LINE_OF[r.id] || r.id.replace(/_d$/, '')))));
  const LINE_OF = {opm: 'op', op_g: 'op'};
  // when operating profit is the driven line, its driver row takes the place of the matching plain row
  const drvSwap = (m, rows) => MET[m] ? rows.map(r => r.id === MET[m][modeOf(m)][0] ? metRow(m, r.cls) : r) : rows;
  // company wording for a line (ORCL cost lines, ETN other costs) comes from the data file
  function relabel(rows) { const L = D.labels || {}; return rows.map(r => L[r.id] ? {...r, label: L[r.id]} : r); }
  const SEG_ROWS = () => {
    const rows = [];
    GROUPS.forEach(g => {
      rows.push({grp: g.label, gi: g.gi});
      g.rows.forEach((r, k) => {
        const editable = g.gi === 0 && FSEG.includes(r);
        const last = k === g.rows.length - 1;
        rows.push({id: `seg|${r.key}`, label: r.name, name: r.name, kind: 'v', seg: g.gi, gap: r.gap, f: c => val(`seg|${r.key}`, c)});
        rows.push({id: `segg|${r.key}`, label: `${r.name} % chg YoY`, kind: 'p', sub: 1, seg: g.gi, f: c => growth(`seg|${r.key}`, c), drv: editable ? `seg:${r.name}` : null});
        rows.push({id: `segm|${r.key}`, label: `${r.name} % of revenue`, kind: 'p', sub: 1, seg: g.gi, gap: r.gap, cls: last ? '' : 'rule', f: c => { const v = val(`seg|${r.key}`, c), t = val('rev', c); return v == null || !t ? null : v / t; }});
      });
    });
    rows.push({grp: 'Total'});
    rows.push({id: 'rev', label: 'Total revenue', kind: 'v', cls: 'total', f: c => val('rev', c)});
    rows.push(revG());
    return rows;
  };
  // unit "usd" = $ millions (follows the $M / $B switch), "pct" = percent, anything else is a plain number
  const KPI_ROWS = () => {
    const rows = [];
    KPI = {};
    // total and segment revenue first, so they can be charted with any KPI
    const G0 = GROUPS[0];
    rows.push({grp: 'Revenue', gi: 'krev'});
    rows.push({id: 'rev', label: 'Total revenue', kind: 'v', main: 1, cls: 'total', hg: 'krev', f: c => val('rev', c)});
    rows.push({...revG(), hg: 'krev', cls: G0 ? 'rule' : ''});
    if (G0) G0.rows.forEach((r, k) => {
      const last = k === G0.rows.length - 1;
      rows.push({id: `seg|${r.key}`, label: r.name, name: r.name, kind: 'v', main: 1, seg: G0.gi, hg: 'krev', gap: r.gap, f: c => val(`seg|${r.key}`, c)});
      rows.push({id: `segg|${r.key}`, label: `${r.name} % chg YoY`, kind: 'p', sub: 1, seg: G0.gi, hg: 'krev', cls: last ? '' : 'rule', f: c => growth(`seg|${r.key}`, c), drv: FSEG.includes(r) ? `seg:${r.name}` : null});
    });
    KG.forEach(g => {
      rows.push({grp: g.label, gi: g.gi});
      g.rows.forEach((r, k) => {
        KPI[r.key] = r;
        const id = `kpi|${r.key}`, kind = r.unit === 'usd' ? 'v' : r.unit === 'pct' ? 'p' : r.unit === 'text' ? 't' : 'k';
        const subs = [];
        if (kind !== 'p' && kind !== 't') subs.push({id: `kpig|${r.key}`, label: `${r.name} % chg YoY`, kind: 'p', sub: 1, seg: g.gi, f: c => growth(id, c)});
        if (r.ofrev) subs.push({id: `kpim|${r.key}`, label: `${r.name} % of revenue`, kind: 'p', sub: 1, seg: g.gi, f: c => { const v = val(id, c), t = val('rev', c); return v == null || !t ? null : v / t; }});
        const last = k === g.rows.length - 1;
        rows.push({id, label: r.name, kind, main: 1, seg: g.gi, cls: !subs.length && !last ? 'rule' : '', f: c => val(id, c)});
        subs.forEach((x, j) => rows.push({...x, cls: j === subs.length - 1 && !last ? 'rule' : ''}));
      });
    });
    return rows;
  };
  const allRows = () => view.tab === 'is' ? IS_ROWS() : view.tab === 'kpi' ? KPI_ROWS() : SEG_ROWS();
  const hidden = () => (view.hide = view.hide || {})[D.ticker] || [];
  const rows = () => allRows().filter(r => r.grp || ((view.pct || r.kind !== 'p' || r.main) && !((r.hg ?? r.seg) != null && hidden().includes(r.hg ?? r.seg))));
  // segments tab default: the newest set, plus older versions of the same set reaching back
  // through history (same name before the bracket), so the chart runs old → new across the change
  function chain() {
    if (!GROUPS.length) return ['rev'];
    const stem = g => g.label.split('(')[0].trim().toLowerCase();
    const cov = g => [...Array(HIST).keys()].filter(i => g.rows.some(r => ok(r.values[i]) && !r.gap.has(i)));
    const pick = [GROUPS[0]], got = new Set(cov(GROUPS[0]));
    for (;;) {
      let best = null, gain = 0;
      GROUPS.forEach(g => {
        if (pick.includes(g) || stem(g) !== stem(GROUPS[0])) return;
        const n = cov(g).filter(i => !got.has(i)).length;
        if (n > gain) { gain = n; best = g; }
      });
      if (!best) break;
      pick.push(best); cov(best).forEach(i => got.add(i));
    }
    return pick.flatMap(g => g.rows.map(r => `seg|${r.key}`));
  }
  const checked = () => {
    if (!view.checked[view.tab]) view.checked[view.tab] = view.tab === 'is' ? ['rev'] : view.tab === 'kpi' ? KPI_ROWS().filter(r => r.main && r.kind !== 't').slice(0, 1).map(r => r.id) : chain();
    return view.checked[view.tab];
  };
  const isGap = (r, c) => r.gap && !c.est && c.idx.some(i => r.gap.has(i));

  // ---------- formatting ----------
  function fmt(v, kind) {
    if (kind === 't') return v || '—';
    if (!ok(v)) return '—';
    if (kind === 'p') return `${(v * 100).toFixed(1)}%`;
    if (kind === 's') return v.toFixed(2);
    if (kind === 'n') return v.toLocaleString('en-US', {minimumFractionDigits: view.dec, maximumFractionDigits: view.dec});
    // k = KPI count or unit figure: whole numbers stay whole, others keep up to 2 decimals
    if (kind === 'k') return v.toLocaleString('en-US', {maximumFractionDigits: Number.isInteger(v) ? 0 : Math.abs(v) >= 100 ? 1 : 2});
    const x = view.units === 'B' ? v / 1000 : v;
    return x.toLocaleString('en-US', {minimumFractionDigits: view.dec, maximumFractionDigits: view.dec});
  }
  const toInput = (v, kind) => !ok(v) ? '' : kind === 'p' ? (v * 100).toFixed(1) + '%' : v.toFixed(1);
  function parse(text, kind) {
    const t = String(text).replace(/[%,\s$]/g, '');
    if (t === '') return null;
    const n = Number(t);
    if (!isFinite(n)) return undefined;
    return kind === 'p' ? n / 100 : n;
  }

  // ---------- table ----------
  const grid = $('grid'), wrap = $('wrap');
  let cols = [], rws = [];

  function render(scroll) {
    const muse = view.tab === 'muse' && !!window.EquinoxMuse;
    $('muse').hidden = !muse; wrap.hidden = muse; document.querySelector('.fin-bar').hidden = muse;
    if (muse) {
      $('chart').hidden = true;
      const r25 = Q.filter(q => q.fy === 2025 && !q.est).map(q => D.lines.rev[q.i]);
      window.EquinoxMuse.mount($('muse'), {rev2025: r25.length === 4 && r25.every(ok) ? r25.reduce((t, v) => t + v, 0) : null});
      return;
    }
    build();
    cols = shownCols();
    if (!cols.length) { view.from = view.to = null; cols = shownCols(); }
    rangeUI();
    if (view.newest) cols = cols.slice().reverse();
    rws = rows();
    const ck = checked();
    const firstEst = cols.findIndex((c, k) => c.est && (view.newest ? k === cols.length - 1 || !cols[k + 1].est : k === 0 || !cols[k - 1].est));
    const head = `<thead><tr><th class="lab" scope="col">${{is: 'Income statement', seg: 'Segments', kpi: 'KPIs'}[view.tab]}</th>${cols.map((c, k) =>
      `<th scope="col" class="${c.est ? 'est' : ''}${k === firstEst ? ' first-est' : ''}">${c.label}${c.est ? 'E' : ''}<small>${c.date}</small></th>`).join('')}</tr></thead>`;
    const body = rws.map((r, ri) => {
      if (r.grp) return `<tr class="grp"><td class="lab">${r.gi == null ? r.grp : `<button type="button" class="gt" data-grp="${r.gi}" aria-expanded="${!hidden().includes(r.gi)}">${r.grp}</button>`}</td>${cols.map((c, k) => `<td class="${c.est ? 'est' : ''}${k === firstEst ? ' first-est' : ''}"></td>`).join('')}</tr>`;
      return `<tr class="${r.cls || ''}${r.sub ? ' sub' : ''}">` +
        `<td class="lab"><div class="lr"><label><input type="checkbox" data-chk="${r.id}"${ck.includes(r.id) ? ' checked' : ''}${r.kind === 't' ? ' disabled' : ''}> ${r.label}</label>` +
        (r.mode ? `<span class="mode" role="group" aria-label="Forecast by">${[['pct', '% rev'], ['yoy', 'YoY']].map(([v, t]) =>
          `<button type="button" data-mode="${r.mode}" data-v="${v}" aria-pressed="${modeOf(r.mode) === v}">${t}</button>`).join('')}</span>` : '') + `</div></td>` +
        cols.map((c, k) => {
          const editable = r.drv && c.est && view.period === 'q';
          const cl = [c.est ? 'est' : '', k === firstEst ? 'first-est' : '', editable ? 'inp' : ''].join(' ').trim();
          return `<td class="${cl}" data-r="${ri}" data-c="${k}">${editable ? `<input inputmode="decimal" aria-label="${r.label}, ${c.label}" title="Clear to undo">` : ''}</td>`;
        }).join('') + '</tr>';
    }).join('');
    grid.innerHTML = head + `<tbody>${body}</tbody>`;
    fill();
    if (scroll) {
      const th = grid.querySelector('th.first-est');
      wrap.scrollLeft = view.newest ? 0 : !th ? wrap.scrollWidth : Math.max(0, th.offsetLeft - wrap.clientWidth * .5);
    }
  }

  // write numbers into existing cells (keeps inputs in place so Tab works while typing)
  function fill(flash) {
    build();
    grid.querySelectorAll('td[data-r]').forEach(td => {
      const r = rws[td.dataset.r], c = cols[td.dataset.c];
      const v = r.f(c);
      const inp = td.querySelector('input');
      if (inp) {
        const st = r.drv === 'g' ? revState(c.qi) : state(r.drv, c.qi);
        td.classList.toggle('edited', st === 'edited');
        td.classList.toggle('carried', st === 'carried');
        if (document.activeElement !== inp) inp.value = toInput(v, r.kind);
      } else {
        const txt = fmt(v, r.kind);
        if (flash && td.textContent !== txt && c.est) { td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash'); }
        td.textContent = txt;
        td.classList.toggle('txt', r.kind === 't');
        td.classList.toggle('neg', ok(v) && v < 0);
        const gp = !!isGap(r, c);
        td.classList.toggle('gap', gp);
        if (gp) td.title = 'Not reported on this basis. Estimated from the segment mix before and after.'; else td.removeAttribute('title');
      }
    });
    chart();
  }

  grid.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.chk) {
      const id = t.dataset.chk, max = view.tab === 'seg' ? 16 : 12;
      const ck = checked();
      view.checked[view.tab] = t.checked ? fitAxes([...ck.filter(x => x !== id), id], allRows()).slice(-max) : ck.filter(x => x !== id);
      grid.querySelectorAll('input[data-chk]').forEach(b => b.checked = view.checked[view.tab].includes(b.dataset.chk));
      save(); chart(); return;
    }
    const td = t.closest('td[data-r]'); if (!td) return;
    const r = rws[td.dataset.r], c = cols[td.dataset.c];
    const v = parse(t.value, r.kind);
    if (v === undefined) { fill(); return; }
    const put = k => { if (v == null) delete ov[`${k}|${c.key}`]; else ov[`${k}|${c.key}`] = v; };
    if (r.drv === 'g' && segMode) FSEG.forEach(s => put(`seg:${s.name}`));   // total growth sets every segment to that rate
    else put(r.drv);
    save();
    fill(true);
    t.value = toInput(r.f(c), r.kind);
  });
  $('chart').addEventListener('click', e => {
    const b = e.target.closest('button[data-cm]'); if (!b) return;
    view.cmode = b.dataset.cm; save(); chart();
  });
  grid.addEventListener('click', e => {
    const gt = e.target.closest('button[data-grp]');
    if (gt) {
      const gi = /^k/.test(gt.dataset.grp) ? gt.dataset.grp : Number(gt.dataset.grp), h = hidden();
      view.hide[D.ticker] = h.includes(gi) ? h.filter(x => x !== gi) : [...h, gi];
      save(); render(); return;
    }
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    mode[b.dataset.mode] = b.dataset.v; save(); render();
  });
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
    e.preventDefault();
    const tr = e.target.closest('tr'), all = [...tr.querySelectorAll('td.inp input')];
    const next = all[all.indexOf(e.target) + (view.newest ? -1 : 1)];
    e.target.dispatchEvent(new Event('change', {bubbles: true}));
    if (next) { next.focus(); next.select(); } else e.target.blur();
  });
  grid.addEventListener('focusin', e => { if (e.target.closest('td.inp')) e.target.select(); });

  // ---------- chart of checked rows ----------
  // the chart has two scales: bars on the left, lines on the right. Rows on a third scale are dropped,
  // oldest pick first, so the newest pick always shows.
  const unitOf = r => r.kind === 'p' ? 'pct' : r.kind === 'k' ? 'k:' + ((KPI[r.id.slice(4)] || {}).unit || '') : r.kind;
  function fitAxes(ids, all) {
    const units = [], keep = [];
    ids.slice().reverse().forEach(x => {
      const r = all.find(z => z.id === x); if (!r) return;
      const u = unitOf(r);
      if (!units.includes(u)) { if (units.length === 2) return; units.push(u); }
      keep.unshift(x);
    });
    return keep;
  }
  const PALETTE = ['var(--ml-accent)', '#c2843a', '#5f9471', '#9070b8', '#b5605a', '#4f98a6', '#8c8a3e', '#7a6f62', '#c46fa0', '#5c6fb5'];
  const chartBox = $('chart');
  function chart() {
    const all = allRows();
    const sel = checked().map(id => all.find(r => r.id === id)).filter(Boolean);
    if (!sel.length) { chartBox.hidden = true; chartBox.innerHTML = ''; return; }
    chartBox.hidden = false;
    const cs = shownCols();                            // always oldest to newest
    const money = sel.filter(r => r.kind !== 'p'), pct = sel.filter(r => r.kind === 'p');
    // Segment sets from one family (same name before the bracket) chain together: each past column shows
    // the newest set reported there, forecasts show the newest set. Unrelated sets sit side by side.
    const stem = gi => GROUPS[gi].label.split('(')[0].trim().toLowerCase();
    const isSeg = r => typeof r.seg === 'number';
    const chain = money.length > 1 && money.every(isSeg) && new Set(money.map(r => stem(r.seg))).size === 1;
    const stack = chain || (money.length > 1 && money.every(r => isSeg(r) && r.seg === money[0].seg));
    // chart modes on the Segments tab: values, share of revenue, or three pies
    const segOnly = view.tab === 'seg' && money.length > 0 && money.every(isSeg);
    const cm = segOnly ? view.cmode || 'v' : 'v';
    const modeBar = segOnly ? `<div class="seg cm" role="group" aria-label="Chart">${[['v', 'Values'], ['mix', '% of revenue'], ['pie', 'Pies']].map(([k, t]) =>
      `<button type="button" data-cm="${k}" aria-pressed="${cm === k}">${t}</button>`).join('')}</div>` : '';
    const share = (r, c) => { const v = r.f(c), t = val('rev', c); return ok(v) && t ? v / t : null; };
    const colGrp = cs.map(c => {
      if (!chain) return null;
      const live = money.filter(r => ok(r.f(c)) && (c.est || !isGap(r, c))).map(r => r.seg);
      return c.est ? (live.includes(0) ? 0 : Math.min(...live)) : live.length ? Math.min(...live) : null;
    });
    const shown = (r, k) => !chain || r.kind === 'p' || r.seg === colGrp[k];
    const W = 1240, padL = 60, padR = 12;
    const step = (W - padL - padR) / cs.length;
    const xs = k => padL + step * k + step / 2;
    const nm = r => r.name || r.label, names = [...new Set(sel.map(nm))];
    const color = r => PALETTE[names.indexOf(nm(r)) % PALETTE.length];
    if (cm === 'pie') { chartBox.innerHTML = `<div class="ctop"><span></span>${modeBar}</div>` + pies(money, nm, color); return; }
    const sel2 = fitAxes(sel.map(r => r.id), all).map(id => sel.find(r => r.id === id));
    // bar rows: the first non-% scale (or segment shares in "% of revenue" mode); everything else is a line
    const uOf = r => cm === 'mix' && r.kind !== 'p' ? 'mix' : unitOf(r);
    const firstBar = sel2.find(r => r.kind !== 'p'), barU = firstBar ? uOf(firstBar) : null;
    const bars = barU ? sel2.filter(r => uOf(r) === barU) : [];
    const lines = sel2.filter(r => !bars.includes(r));
    const lineU = lines.length ? uOf(lines[0]) : null;
    const twoAx = bars.length && lines.length;
    const padR2 = twoAx ? 66 : padR, W2 = W;
    const step2 = (W2 - padL - padR2) / cs.length, xs2 = k => padL + step2 * k + step2 / 2;
    const tickTxt = (t, u) => u === 'pct' || u === 'mix' ? (t * 100).toFixed(0) + '%' : u === 's' ? t.toFixed(2) : u === 'v' ? fmtAxis(t) : t.toLocaleString('en-US', {maximumFractionDigits: 2});
    let svg = '', y0 = 0;
    const h = 240, top = 6;
    const range = (vals, stackIt) => {
      let lo = 0, hi = 0;
      if (stackIt) cs.forEach((_, k) => { let p = 0, n = 0; vals.forEach(a => { const v = a[k]; if (ok(v)) v >= 0 ? p += v : n += v; }); hi = Math.max(hi, p); lo = Math.min(lo, n); });
      else { const f = vals.flat().filter(ok); if (f.length) { lo = Math.min(0, ...f); hi = Math.max(0, ...f); } else hi = 1; }
      if (lo === hi) hi = lo + 1;
      const tk = niceTicks(lo, hi, 4); return [tk[0], tk[tk.length - 1], tk];
    };
    const yOf = (lo, hi) => v => top + h - (v - lo) / (hi - lo) * h;
    let leftDone = false;
    if (bars.length) {
      const V = bars.map(r => cs.map((c, k) => !shown(r, k) ? null : cm === 'mix' ? share(r, c) : r.f(c)));
      const stk = stack && bars.length > 1;
      let [lo, hi, tk] = range(V, stk);
      if (cm === 'mix' && stk && hi <= 1.02) { hi = 1; tk = niceTicks(lo, 1, 4); }
      const Y = yOf(lo, hi);
      tk.forEach(t => {
        svg += `<line x1="${padL}" x2="${W2 - padR2}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--ml-border)" ${t === 0 ? '' : 'stroke-dasharray="2 4"'}/>`;
        svg += `<text x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${tickTxt(t, barU)}</text>`;
      });
      leftDone = true;
      const bw = stk ? Math.min(28, step2 * .72) : Math.min(26, step2 * .72 / bars.length);
      cs.forEach((c, k) => {
        let p = 0, n = 0;
        bars.forEach((r, m) => {
          const v = V[m][k]; if (!ok(v)) return;
          let a, b, x;
          if (stk) { x = xs2(k) - bw / 2; if (v >= 0) { a = p; b = p + v; p = b; } else { a = n; b = n + v; n = b; } }
          else { x = xs2(k) - bw * bars.length / 2 + bw * m; a = 0; b = v; }
          const ya = Y(a), yb = Y(b);
          svg += `<rect x="${(x + .5).toFixed(1)}" y="${Math.min(ya, yb).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${Math.max(.5, Math.abs(ya - yb)).toFixed(1)}" fill="${color(r)}" opacity="${c.est ? .45 : 1}"/>`;
        });
      });
    }
    if (lines.length) {
      const V = lines.map(r => cs.map((c, k) => !shown(r, k) ? null : r.f(c)));
      const [lo, hi, tk] = range(V, false);
      const Y = yOf(lo, hi);
      tk.forEach(t => {
        if (!leftDone) svg += `<line x1="${padL}" x2="${W2 - padR2}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--ml-border)" ${t === 0 ? '' : 'stroke-dasharray="2 4"'}/>`;
        else if (t === 0) svg += `<line x1="${padL}" x2="${W2 - padR2}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--ml-border)" stroke-dasharray="6 3"/>`;
        svg += leftDone ? `<text x="${W2 - padR2 + 8}" y="${Y(t) + 4}" text-anchor="start">${tickTxt(t, lineU)}</text>`
                        : `<text x="${padL - 8}" y="${Y(t) + 4}" text-anchor="end">${tickTxt(t, lineU)}</text>`;
      });
      const path = arr => { let d = '', pen = false; arr.forEach(p => { if (!p) { pen = false; return; } d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true; }); return d; };
      lines.forEach((r, m) => {
        const pts = V[m].map((v, k) => !ok(v) ? null : [xs2(k), Y(v), cs[k].est]);
        const estPts = pts.map((p, k) => p && (p[2] || (pts[k + 1] && pts[k + 1][2])) ? p : null);
        svg += `<path d="${path(pts.map(p => p && !p[2] ? p : null))}" fill="none" stroke="${color(r)}" stroke-width="2"/>`;
        svg += `<path d="${path(estPts)}" fill="none" stroke="${color(r)}" stroke-width="2" stroke-dasharray="4 4"/>`;
        pts.forEach(p => { if (p && pts.filter(Boolean).length < 3) svg += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color(r)}"/>`; });
      });
    }
    y0 = top + h + 10;
    const lblY = y0 + 8, every = Math.ceil(cs.length / 12);
    cs.forEach((c, k) => {
      if ((cs.length - 1 - k) % every) return;
      svg += `<text x="${xs2(k)}" y="${lblY}" text-anchor="middle">${c.label}${c.est ? 'E' : ''}</text>`;
    });
    const firstEst = cs.findIndex(c => c.est);
    if (firstEst > 0) {
      const x = padL + step2 * firstEst;
      svg += `<line x1="${x}" x2="${x}" y1="0" y2="${y0}" stroke="var(--ml-muted)" stroke-width="1"/>`;
    }
    svg += `<rect class="hit" x="${padL}" y="0" width="${W - padL - padR2}" height="${y0}" fill="transparent"/>`;
    const keyRows = [...new Set(sel2.map(nm))].map(n => sel2.find(r => nm(r) === n));
    chartBox.innerHTML = `<div class="ctop"><div class="key">${keyRows.map(r => `<span><i${lines.includes(r) ? ' class="ln"' : ''} style="background:${color(r)}"></i>${chain ? nm(r) : r.label}</span>`).join('')}</div>${modeBar}</div>` +
      `<svg viewBox="0 0 ${W} ${lblY + 6}" role="img" aria-label="Chart of checked rows">${svg}</svg><div class="tip"></div>`;
    const svgEl = chartBox.querySelector('svg'), tip = chartBox.querySelector('.tip');
    svgEl.addEventListener('mousemove', e => {
      const b = svgEl.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * W;
      const k = Math.max(0, Math.min(cs.length - 1, Math.floor((x - padL) / step2)));
      const c = cs[k];
      tip.innerHTML = `<b>${c.label}${c.est ? 'E' : ''}</b> <small>${c.date}</small>` + sel2.filter(r => shown(r, k) && ok(r.f(c))).map(r => `<div>${chain ? nm(r) : r.label}<span>${fmt(r.f(c), r.kind)}${segOnly && r.kind !== 'p' && ok(share(r, c)) ? ` · ${(share(r, c) * 100).toFixed(1)}%` : ''}</span></div>`).join('');
      tip.classList.add('on');
      const px = (xs2(k) / W) * b.width, box = chartBox.getBoundingClientRect();
      const left = px + 18 + tip.offsetWidth > box.width ? px - tip.offsetWidth - 10 : px + 18;
      tip.style.left = `${left + (b.left - box.left)}px`; tip.style.top = '34px';
    });
    svgEl.addEventListener('mouseleave', () => tip.classList.remove('on'));
  }
  // three pies: latest quarter, latest full fiscal year, fiscal year to date (reported quarters only)
  function pies(money, nm, color) {
    const last = Q[HIST - 1], inYr = y => Q.filter(q => q.fy === y && q.i < HIST).map(q => q.i);
    const fullY = inYr(last.fy).length === 4 ? last.fy : last.fy - 1, ytd = inYr(last.fy);
    const yy = y => `FY${String(y).slice(2)}`;
    const per = [
      ['Latest quarter', `${yy(last.fy)} Q${last.fq} (${last.label})`, [HIST - 1]],
      ['Latest year', yy(fullY), inYr(fullY)],
      ['Year to date', `${yy(last.fy)}, ${ytd.length} quarter${ytd.length > 1 ? 's' : ''}`, ytd],
    ];
    const gs = [...new Set(money.map(r => r.seg))].sort((a, b) => a - b);
    const cell = ([title, sub, idx]) => {
      const col = {idx};
      const g = gs.find(g => money.filter(r => r.seg === g).every(r => val(r.id, col) != null && !idx.some(i => r.gap.has(i))));
      if (g == null || idx.length === 0) return `<figure><figcaption><b>${title}</b><span>${sub}</span></figcaption><p class="none">Not reported</p></figure>`;
      const sl = money.filter(r => r.seg === g).map(r => ({r, v: val(r.id, col)})).filter(x => x.v > 0);
      const tot = sl.reduce((t, x) => t + x.v, 0);
      let a = -Math.PI / 2, paths = '';
      sl.forEach(({r, v}) => {
        const b = a + v / tot * 2 * Math.PI, R = 92, cx = 100, cy = 100;
        paths += sl.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color(r)}"/>` :
          `<path d="M${cx},${cy}L${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}A${R},${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${(cx + R * Math.cos(b)).toFixed(2)},${(cy + R * Math.sin(b)).toFixed(2)}Z" fill="${color(r)}" stroke="var(--ml-surface)" stroke-width="1.5"><title>${nm(r)}: ${(v / tot * 100).toFixed(1)}%</title></path>`;
        a = b;
      });
      return `<figure><figcaption><b>${title}</b><span>${sub}</span></figcaption><svg viewBox="0 0 200 200" role="img" aria-label="${title} segment mix">${paths}</svg>` +
        `<ul>${sl.map(({r, v}) => `<li><i style="background:${color(r)}"></i>${nm(r)}<span>${(v / tot * 100).toFixed(1)}%</span><em>${fmt(v, 'v')}</em></li>`).join('')}</ul></figure>`;
    };
    return `<div class="pies">${per.map(cell).join('')}</div>`;
  }
  function fmtAxis(t) { const x = view.units === 'B' ? t / 1000 : t; return x.toLocaleString('en-US', {maximumFractionDigits: view.units === 'B' ? 1 : 0}); }
  function niceTicks(lo, hi, n) {
    if (lo === hi) { hi = lo + 1; }
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n) || 10 * mag;
    const out = []; for (let t = Math.floor(lo / st) * st; t <= hi + st * .001; t += st) out.push(+t.toFixed(10));
    if (out[out.length - 1] < hi) out.push(out[out.length - 1] + st);
    return out;
  }

  // ---------- toolbar ----------
  function segGroup(id, prop, cast = x => x, scroll) {
    const g = $(id);
    const sync = () => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(cast(b.dataset.v) === view[prop])));
    g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view[prop] = cast(b.dataset.v); save(); sync(); render(scroll); });
    sync();
  }
  segGroup('period', 'period', x => x, true); segGroup('units', 'units'); segGroup('dec', 'dec', Number);
  $('pct').checked = view.pct; $('pct').onchange = e => { view.pct = e.target.checked; save(); render(); };
  $('rev').checked = view.newest; $('rev').onchange = e => { view.newest = e.target.checked; save(); render(true); };
  document.querySelectorAll('.fin-tabs button').forEach(b => {
    b.setAttribute('aria-selected', String(b.dataset.tab === view.tab));
    b.onclick = () => { view.tab = b.dataset.tab; document.querySelectorAll('.fin-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b))); save(); render(true); };
  });
  $('reset').onclick = () => { ov = {}; save(); render(); };
  $('est').checked = view.est !== false; $('est').onchange = e => { view.est = e.target.checked; save(); render(true); };
  const setRange = () => {
    let f = $('from').value, t = $('to').value;
    if (f > t) [f, t] = [t, f];
    // store the ends as open when they sit at the edge, so new quarters show up on their own
    view.from = f === $('from').options[0].value ? null : f;
    view.to = t === $('to').options[$('to').options.length - 1].value ? null : t;
    save(); render(true);
  };
  $('from').onchange = setRange; $('to').onchange = setRange;
  $('dl').onclick = () => {
    const lines = [['', ...cols.map(c => c.label + (c.est ? 'E' : ''))].join(',')];
    rws.filter(r => !r.grp).forEach(r => lines.push([`"${r.label}"`, ...cols.map(c => { const v = r.f(c); if (r.kind === 't') return v ? `"${v}"` : ''; return !ok(v) ? '' : (r.kind === 'v' && view.units === 'B' ? v / 1000 : v).toFixed(r.kind === 'p' ? 4 : 2); })].join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'}));
    a.download = `${D.ticker}-${{is: 'income-statement', seg: 'segments', kpi: 'kpis'}[view.tab]}-${view.period === 'q' ? 'quarterly' : 'annual'}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------- company picker ----------
  const pick = $('co'), plist = $('co-list');
  let LIST = [], hi = 0;
  const getJSON = u => fetch(u, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  function open(t) {
    return getJSON(`financials/${t}.json`).then(d => { view.ticker = t; view.checked = {}; save(); setup(d); render(true); });
  }
  const matches = () => {
    const q = pick.value.trim().toUpperCase();
    if (!q) return LIST.slice(0, 10);
    const a = LIST.filter(c => c.ticker.startsWith(q)), b = LIST.filter(c => !c.ticker.startsWith(q) && c.name.toUpperCase().includes(q));
    return a.concat(b).slice(0, 10);
  };
  const showList = () => {
    const m = matches(); hi = Math.min(hi, Math.max(0, m.length - 1));
    plist.innerHTML = m.length ? m.map((c, k) => `<li role="option" data-t="${c.ticker}" aria-selected="${k === hi}"><b>${c.ticker}</b><span>${c.name}</span></li>`).join('') : '<li class="none">No match</li>';
    plist.hidden = false;
  };
  const choose = t => { plist.hidden = true; pick.value = t; pick.blur(); if (t !== D.ticker) open(t); };
  pick.addEventListener('focus', () => { pick.select(); hi = 0; showList(); });
  pick.addEventListener('input', () => { hi = 0; showList(); });
  pick.addEventListener('keydown', e => {
    const m = matches();
    if (e.key === 'ArrowDown') { hi = Math.min(hi + 1, m.length - 1); showList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(hi - 1, 0); showList(); e.preventDefault(); }
    else if (e.key === 'Enter') { const x = LIST.find(c => c.ticker === pick.value.trim().toUpperCase()) || m[hi]; if (x) choose(x.ticker); }
    else if (e.key === 'Escape') { plist.hidden = true; pick.value = D.ticker; pick.blur(); }
  });
  pick.addEventListener('blur', () => setTimeout(() => { plist.hidden = true; if (D) pick.value = D.ticker; }, 150));
  plist.addEventListener('mousedown', e => { const li = e.target.closest('li[data-t]'); if (li) { e.preventDefault(); choose(li.dataset.t); } });
  getJSON('financials/index.json').then(list => {
    LIST = list;
    const t = list.some(c => c.ticker === view.ticker) ? view.ticker : list[0].ticker;
    pick.value = t;
    return open(t);
  }).catch(() => {
    pick.hidden = true;
    setup(sample()); render(true);
  });
})();
