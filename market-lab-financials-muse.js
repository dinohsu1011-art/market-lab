/* Muse revenue model, shown as a tab on META's Financials page.
   Bear / Base / Bull inputs are editable; every result is worked out from them.
   Defaults follow a Jefferies 2030 scenario model (figures only). Edits live in
   localStorage under equinox.fin.muse.v1. */
(function () {
  'use strict';

  const KEY = 'equinox.fin.muse.v1';
  const SC = ['Bear', 'Base', 'Bull'];
  const ok = v => v != null && isFinite(v);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };

  // [key, label, kind, defaults for Bear / Base / Bull]. kind: n number, p percent, d dollars, d3 dollars to 3 places, x times
  const REV_IN = [
    ['users', 'Monthly users (M)', 'n', [250, 500, 750]],
    ['paying', 'Paying subscribers, % of users', 'p', [.02, .04, .06]],
    ['maxu', 'of which on the Maximum plan, % of users', 'p', [.001, .005, .01]],
    ['price', 'Regular plan price a month', 'd', [20, 20, 20]],
    ['maxprice', 'Maximum plan price a month', 'd', [100, 100, 100]],
    ['buyers', 'Users buying through Muse in a month', 'p', [.1, .2, .3]],
    ['order', 'Average order', 'd', [80, 120, 150]],
    ['take', 'Fee on purchases (take rate)', 'p', [.01, .02, .03]],
  ];
  const REV_OUT = [
    ['purch', 'Purchases through Muse a year', 'B'],
    ['sub', 'Subscriptions per user a month', 'd'],
    ['comm', 'Commission per user a month', 'd'],
    ['rpu', 'Revenue per user a month', 'd', 1],
    ['revY', 'Revenue a year', 'B', 1],
    ['share', 'Share of Meta 2025 revenue', 'p'],
  ];
  const COST_IN = [
    ['tokens', 'Tokens used per user a month (M)', 'n', [71.6, 111, 161]],
    ['today', 'Compute cost today, per million tokens', 'd3', [.5, .5, .5]],
    ['lower', 'Compute cost vs today, times lower', 'x', [10, 25, 50]],
    ['cloud', 'Cloud computer cost per user a month', 'd', [.78, .78, .78]],
    ['ovh', 'Other overhead, % of compute and cloud', 'p', [.11, .11, .11]],
  ];
  const COST_OUT = [
    ['cpm', 'Meta cost per million tokens', 'd3'],
    ['inf', 'Inference cost per user a month', 'd'],
    ['ovhD', 'Other overhead cost per user a month', 'd'],
    ['cost', 'Total cost per user a month', 'd', 1],
    ['infs', 'Inference share of cost', 'p'],
    ['profit', 'Profit per user a month', 'd', 1],
    ['profY', 'Profit a year', 'B'],
  ];
  // sensitivity grid: base case, compute cost (rows) by share of the token allowance used (columns)
  const SENS_ROWS = [10, 25, 50, 100], SENS_COLS = [.1, .2, .3];
  const DEF = Object.fromEntries([...REV_IN, ...COST_IN].map(r => [r[0], r[3]]));
  DEF.used = [.2];   // the base case token count stands for this share of the allowance
  const KIND = Object.fromEntries([...REV_IN, ...REV_OUT, ...COST_IN, ...COST_OUT].map(r => [r[0], r[2]]));
  KIND.used = 'p';

  let ov = store.get(KEY, {}).ov || {}, REV25 = null;
  const get = (k, s) => { const v = ov[`${k}|${s}`]; return ok(v) ? v : DEF[k][s]; };

  function calc(s) {
    const v = k => get(k, s);
    const sub = (v('paying') - v('maxu')) * v('price') + v('maxu') * v('maxprice');
    const comm = v('buyers') * v('order') * v('take');
    const rpu = sub + comm;
    const cpm = v('today') / v('lower');
    const inf = v('tokens') * cpm;
    const ovhD = (inf + v('cloud')) * v('ovh');
    const cost = inf + v('cloud') + ovhD;
    const yr = x => v('users') * x * 12;   // users (M) x $ a month x 12 = $M a year
    return {sub, comm, rpu, cpm, inf, ovhD, cost, purch: yr(v('buyers') * v('order')) / 1e3, revY: yr(rpu) / 1e3,
      share: REV25 ? yr(rpu) / REV25 : null, infs: inf / cost, profit: rpu - cost, profY: yr(rpu - cost) / 1e3};
  }
  function sens(m, u) {
    const v = k => get(k, 1), r = calc(1);
    const inf = v('tokens') * u / get('used', 0) * v('today') / m;
    const cost = (inf + v('cloud')) * (1 + v('ovh'));
    return {rpu: r.rpu, cost, profit: r.rpu - cost};
  }

  // ---------- formatting ----------
  const minus = v => v < 0 ? '−' : '';
  function fmt(v, k) {
    if (!ok(v)) return '—';
    const a = Math.abs(v);
    if (k === 'p') return `${minus(v)}${(a * 100).toFixed(1)}%`;
    if (k === 'd') return `${minus(v)}$${a.toFixed(2)}`;
    if (k === 'd3') return `${minus(v)}$${a.toFixed(3)}`;
    if (k === 'B') return `${minus(v)}$${a.toFixed(1)}B`;
    if (k === 'x') return `${+a.toFixed(1)}x`;
    return v.toLocaleString('en-US', {maximumFractionDigits: 1});
  }
  const toInput = (v, k) => k === 'p' ? `${+(v * 100).toFixed(2)}%` : k === 'x' ? `${+v.toFixed(2)}x` : k === 'd' ? v.toFixed(2) : k === 'd3' ? v.toFixed(3) : String(+v.toFixed(2));
  function parse(text, k) {
    const t = String(text).replace(/[%,\s$x×]/gi, '');
    if (t === '') return null;
    const n = Number(t);
    if (!isFinite(n)) return undefined;
    return k === 'p' ? n / 100 : n;
  }

  // ---------- markup ----------
  const grp = (t, n) => `<tr class="grp"><td class="lab">${t}</td>${'<td></td>'.repeat(n)}</tr>`;
  const inCell = (k, s, label) => `<td class="inp" data-k="${k}" data-s="${s}"><input inputmode="decimal" aria-label="${label}" title="Clear to undo"></td>`;
  function table(title, ins, outs, hover) {
    const head = `<thead><tr><th class="lab" scope="col"${hover ? ` title="${hover}"` : ''}>${title}</th>${SC.map(s => `<th scope="col">${s}</th>`).join('')}</tr></thead>`;
    const inRow = ([k, label]) => `<tr><td class="lab">${label}</td>${SC.map((s, i) => inCell(k, i, `${label}, ${s}`)).join('')}</tr>`;
    const outRow = ([k, label, , tot]) => `<tr class="out${tot ? ' total' : ''}"><td class="lab">${label}</td>${SC.map((s, i) => `<td data-o="${k}" data-s="${i}"></td>`).join('')}</tr>`;
    return `<div class="fin-wrap"><table class="fin mt">${head}<tbody>${grp('Inputs', 3)}${ins.map(inRow).join('')}${grp('Results', 3)}${outs.map(outRow).join('')}</tbody></table></div>`;
  }
  function sensTable() {
    const head = `<thead><tr><th class="lab" scope="col">Profit per user a month, base case</th>${SENS_COLS.map(u => `<th scope="col">${u * 100}% used</th>`).join('')}</tr></thead>`;
    const used = `<tr><td class="lab">Base case tokens, share of allowance used</td>${inCell('used', 0, 'Base case tokens, share of allowance used')}<td></td><td></td></tr>`;
    const rows = SENS_ROWS.map((m, ri) => `<tr class="out"><td class="lab">Compute cost ${m}x lower</td>${SENS_COLS.map((u, ci) => `<td data-sens="${ri}|${ci}"></td>`).join('')}</tr>`).join('');
    return `<div class="fin-wrap"><table class="fin mt">${head}<tbody>${grp('Inputs', 3)}${used}${grp('Results', 3)}${rows}</tbody></table></div>`;
  }

  function chart() {
    const R = [0, 1, 2].map(calc), W = 1200, H = 230, top = 22, bot = 34, left = 8;
    const max = Math.max(...R.flatMap(r => [r.rpu, r.cost]).filter(ok), 1) * 1.12;
    const y = v => top + (H - top - bot) * (1 - Math.max(0, v) / max);
    const gw = (W - left * 2) / 3, bw = Math.min(54, gw * .26);
    const bar = (x, v, cls, name, s) => `<g class="${cls}"><rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, y(0) - y(v))}" rx="2"><title>${s}: ${name} ${fmt(v, 'd')} a user a month</title></rect><text x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle">${fmt(v, 'd')}</text></g>`;
    const g = R.map((r, i) => {
      const cx = left + gw * i + gw / 2;
      return bar(cx - bw - 3, r.rpu, 'rv', 'revenue', SC[i]) + bar(cx + 3, r.cost, 'cs', 'cost', SC[i]) +
        `<text class="sc" x="${cx}" y="${H - 12}" text-anchor="middle">${SC[i]}</text>`;
    }).join('');
    return `<div class="key"><span><i class="rv"></i>Revenue per user a month</span><span><i class="cs"></i>Cost per user a month</span></div>` +
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue and cost per user a month by scenario"><line class="base" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"></line>${g}</svg>`;
  }

  // ---------- fill ----------
  function fill(el) {
    el.querySelectorAll('td.inp').forEach(td => {
      const k = td.dataset.k, s = +td.dataset.s, inp = td.querySelector('input');
      td.classList.toggle('edited', ok(ov[`${k}|${s}`]));
      if (document.activeElement !== inp) inp.value = toInput(get(k, s), KIND[k]);
    });
    const R = [0, 1, 2].map(calc);
    el.querySelectorAll('td[data-o]').forEach(td => {
      const v = R[+td.dataset.s][td.dataset.o];
      td.textContent = fmt(v, KIND[td.dataset.o]);
      td.classList.toggle('neg', ok(v) && v < 0);
    });
    el.querySelectorAll('td[data-sens]').forEach(td => {
      const [ri, ci] = td.dataset.sens.split('|').map(Number), r = sens(SENS_ROWS[ri], SENS_COLS[ci]);
      td.textContent = fmt(r.profit, 'd');
      td.classList.toggle('neg', r.profit < 0);
      td.classList.toggle('pos', r.profit > 0);
      td.title = `Revenue ${fmt(r.rpu, 'd')} less cost ${fmt(r.cost, 'd')}`;
    });
    el.querySelector('.muse-chart').innerHTML = chart();
  }

  function mount(el, ctx) {
    REV25 = ctx && ok(ctx.rev2025) ? ctx.rev2025 : null;
    if (!el.dataset.wired) {
      el.dataset.wired = '1';
      el.innerHTML = `<div class="muse-bar"><button type="button" data-reset>Reset model</button></div><section class="fin-chart muse-chart muse-top"></section><div class="muse-grid">` +
        table('Muse revenue in 2030', REV_IN, REV_OUT, 'Default figures follow a Jefferies 2030 scenario model') +
        table('Cost to serve per user a month, 2030', COST_IN, COST_OUT) +
        sensTable() + `</div>`;
      const save = () => store.set(KEY, {ov});
      el.addEventListener('change', e => {
        const td = e.target.closest('td.inp'); if (!td) return;
        const k = td.dataset.k, v = parse(e.target.value, KIND[k]);
        if (v !== undefined) { if (v == null) delete ov[`${k}|${td.dataset.s}`]; else ov[`${k}|${td.dataset.s}`] = v; save(); }
        fill(el);
        e.target.value = toInput(get(k, +td.dataset.s), KIND[k]);
      });
      el.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
        e.preventDefault();
        const all = [...el.querySelectorAll('td.inp input')], next = all[all.indexOf(e.target) + 1];
        e.target.dispatchEvent(new Event('change', {bubbles: true}));
        if (next) { next.focus(); next.select(); } else e.target.blur();
      });
      el.addEventListener('focusin', e => { if (e.target.closest('td.inp')) e.target.select(); });
      el.querySelector('[data-reset]').onclick = () => { ov = {}; save(); fill(el); };
    }
    fill(el);
  }

  window.EquinoxMuse = {mount};
})();
