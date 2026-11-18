/* Company landing: a stock screener. Technical filters cover every stock in cube/screener.json.
   Fundamental filters use screen-fundamentals.json (built by ops/build_screen_fundamentals.py), which covers about 500 companies. */
window.EQScreen = (() => {
  const { $, pct, tone, usd, day, esc, cell, co, json, fail, sortable } = EQ;
  const KEY = 'equinox.screen.v1';
  const FUND = [['rev', 'Revenue growth, year over year', '%'], ['eps', 'Earnings per share growth, year over year', '%'], ['gm', 'Gross margin', '%'],
    ['om', 'Operating margin', '%'], ['em', 'EBITDA margin', '%', 'Operating income plus depreciation and amortization, as a share of revenue'], ['nm', 'Net margin', '%']];
  const TECH = [['rvol', 'Volume against normal', '×', 'Latest volume divided by its usual level'], ['adv', 'Dollars traded a day', '$M', 'Average daily dollars traded, in millions'],
    ['m1', 'Return, past month', '%'], ['y1', 'Return, past year', '%']];
  const MA = ['10', '21', '50', '100', '200'];
  let S = { v: {}, pos: false, ma: [], trend: '', sector: '', rsiLo: '', rsiHi: '' }, started = false, all = false;
  try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x && typeof x === 'object') S = { ...S, ...x, v: { ...(x.v || {}) }, ma: Array.isArray(x.ma) ? x.ma.filter(k => MA.includes(k)) : [] }; } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  const n = v => v === '' || v == null || isNaN(+v) ? null : +v;
  const box = (k, unit, val) => `<input type="number" inputmode="decimal" step="any" data-v="${k}" value="${esc(val == null ? '' : String(val))}" placeholder="any" aria-label="${k}"><i>${unit}</i>`;
  const line = ([k, name, unit, tip]) => `<label${tip ? ` title="${esc(tip)}"` : ''}><span>${name}</span><em>above</em>${box(k, unit, S.v[k])}</label>`;

  return () => {
    if (started) return; started = true;
    $('scFund').innerHTML = `<label><span>Sector</span><select id="scSector"><option value="">Any</option></select></label>` + FUND.map(line).join('') + `<label class="tick"><span>Positive earnings</span><input type="checkbox" id="scPos"${S.pos ? ' checked' : ''}></label>`;
    $('scTech').innerHTML = `<div class="frow"><span>Price above its average</span><div class="chips" id="scMa">${MA.map(k => `<button type="button" data-ma="${k}" aria-pressed="${S.ma.includes(k)}" title="Price above the ${k}-day average">${k}-day</button>`).join('')}</div></div>
      <div class="frow" title="Up: price above the 50-day average, and the 50-day above the 200-day. Down: the reverse."><span>Trend</span><div class="chips" id="scTrend">${[['', 'Any'], ['up', 'Up'], ['down', 'Down']].map(([k, t]) => `<button type="button" data-t="${k}" aria-pressed="${S.trend === k}">${t}</button>`).join('')}</div></div>` +
      TECH.map(line).join('') +
      `<label title="A 0 to 100 speed gauge. Under 30 means the stock has fallen fast."><span>RSI, 14 days</span><em>from</em><input type="number" step="any" id="scRsiLo" value="${esc(String(S.rsiLo))}" placeholder="0" aria-label="RSI from"><em>to</em><input type="number" step="any" id="scRsiHi" value="${esc(String(S.rsiHi))}" placeholder="100" aria-label="RSI to"></label>`;
    const table = $('scTable');
    table.tHead.innerHTML = `<tr><th data-k="id" class="name"><button type="button">Company</button></th><th data-k="px"><button type="button">Price</button></th><th data-k="d1"><button type="button">Day</button></th><th data-k="m1"><button type="button">1 month</button></th><th data-k="y1"><button type="button">1 year</button></th><th data-k="rev" title="Latest quarter against the same quarter a year earlier"><button type="button">Revenue</button></th><th data-k="eps" title="Earnings per share, latest quarter against the same quarter a year earlier"><button type="button">EPS</button></th><th data-k="om" title="Operating income as a share of revenue, latest quarter"><button type="button">Op. margin</button></th><th data-k="e50" title="Price against its 50-day average"><button type="button">50-day</button></th><th data-k="e200" title="Price against its 200-day average"><button type="button">200-day</button></th><th data-k="rvol" title="Latest volume divided by its usual level"><button type="button">Volume</button></th><th data-k="adv" title="Average dollars traded a day"><button type="button">Traded</button></th></tr>`;
    Promise.all([json('cube/screener.json'), json('screen-fundamentals.json').catch(() => ({ rows: {} }))]).then(([D, FD]) => {
      const rows = D.rows.map(r => { const e = r.ema || {}, f = FD.rows[r.id] || null;
        return { id: r.id, name: r.name || r.label, sector: r.sector || '', px: r.px, d1: r.r && r.r['1D'], m1: r.r && r.r['1M'], y1: r.r && r.r['1Y'], e, e50: e['50'], e200: e['200'], rvol: r.rvol, rsi: r.rsi, adv: r.advUSD, f,
          rev: f && f.rev, eps: f && f.eps, om: f && f.om }; });
      const secs = [...new Set(rows.map(r => r.sector).filter(Boolean))].sort();
      $('scSector').innerHTML += secs.map(s => `<option${s === S.sector ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const money = v => v == null ? '' : v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'B' : '$' + v.toFixed(v < 10 ? 1 : 0) + 'M';
      const plain = v => v == null ? '<td></td>' : `<td class="num">${v.toFixed(1)}%</td>`;
      const T = sortable(table, [], r => `<tr data-go="${esc(r.id)}"><td class="name" title="${esc(r.sector)}">${co(r.id, r.name)}</td><td class="num">${usd(r.px)}</td>${cell(r.d1, 2)}${cell(r.m1)}${cell(r.y1)}${cell(r.rev, 0)}${cell(r.eps, 0)}${plain(r.om)}${cell(r.e50)}${cell(r.e200)}<td class="num soft">${r.rvol == null ? '' : r.rvol.toFixed(2) + '×'}</td><td class="num soft">${money(r.adv)}</td></tr>`,
        { k: 'adv', dir: 1, key: 'equinox.screen.sort.v1', limit: () => all ? Infinity : 100,
          cols: { id: r => r.id, px: r => r.px, d1: r => r.d1, m1: r => r.m1, y1: r => r.y1, rev: r => r.rev, eps: r => r.eps, om: r => r.om, e50: r => r.e50, e200: r => r.e200, rvol: r => r.rvol, adv: r => r.adv } });
      const run = () => {
        const fund = FUND.map(([k]) => [k, n(S.v[k])]).filter(x => x[1] != null), tech = TECH.map(([k]) => [k, n(S.v[k])]).filter(x => x[1] != null), lo = n(S.rsiLo), hi = n(S.rsiHi), needF = fund.length || S.pos;
        const hit = rows.filter(r => {
          if (needF && !r.f) return false;
          for (const [k, min] of fund) if (r.f[k] == null || r.f[k] <= min) return false;
          if (S.pos && !(r.f.ni > 0)) return false;
          for (const k of S.ma) if (!(r.e[k] > 0)) return false;
          if (S.trend === 'up' && !(r.e50 > 0 && r.e200 > r.e50)) return false;
          if (S.trend === 'down' && !(r.e50 < 0 && r.e200 < r.e50)) return false;
          for (const [k, min] of tech) if (r[k] == null || r[k] <= min) return false;
          if (lo != null && !(r.rsi >= lo)) return false; if (hi != null && !(r.rsi <= hi)) return false;
          return !S.sector || r.sector === S.sector; });
        const on = fund.length + tech.length + S.ma.length + !!S.pos + !!S.trend + !!S.sector + (lo != null) + (hi != null);
        T.set(hit);
        $('scCount').textContent = `${hit.length.toLocaleString('en-US')} of ${(needF ? Object.keys(FD.rows).length : rows.length).toLocaleString('en-US')} companies`;
        $('scCount').title = needF ? 'Revenue, earnings and margin filters cover about 500 large companies' : '';
        $('scClear').disabled = !on;
        $('scMore').innerHTML = hit.length > 100 ? `<button type="button">${all ? 'Show the first 100' : `Show all ${hit.length.toLocaleString('en-US')}`}</button>` : '';
        if (!hit.length) table.tBodies[0].innerHTML = `<tr><td colspan="12" class="left soft" style="padding:28px 0">No company passes every filter. Loosen one to see results.</td></tr>`;
      };
      const form = $('scForm'); let timer;
      form.addEventListener('submit', e => e.preventDefault());
      form.addEventListener('input', e => { const t = e.target;
        if (t.dataset.v) S.v[t.dataset.v] = t.value; else if (t.id === 'scPos') S.pos = t.checked; else if (t.id === 'scSector') S.sector = t.value;
        else if (t.id === 'scRsiLo') S.rsiLo = t.value; else if (t.id === 'scRsiHi') S.rsiHi = t.value;
        save(); clearTimeout(timer); timer = setTimeout(run, 120); });
      form.addEventListener('click', e => { const b = e.target.closest('button[data-ma],button[data-t]'); if (!b) return;
        if (b.dataset.ma) { S.ma = S.ma.includes(b.dataset.ma) ? S.ma.filter(k => k !== b.dataset.ma) : [...S.ma, b.dataset.ma]; b.setAttribute('aria-pressed', S.ma.includes(b.dataset.ma)); }
        else { S.trend = b.dataset.t; $('scTrend').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }
        save(); run(); });
      $('scClear').onclick = () => { S = { v: {}, pos: false, ma: [], trend: '', sector: '', rsiLo: '', rsiHi: '' }; save();
        form.querySelectorAll('input[type=number]').forEach(i => i.value = ''); $('scPos').checked = false; $('scSector').value = '';
        form.querySelectorAll('[data-ma]').forEach(b => b.setAttribute('aria-pressed', false)); $('scTrend').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === '')); run(); };
      $('scMore').onclick = e => { if (e.target.closest('button')) { all = !all; run(); } };
      table.addEventListener('click', e => { const tr = e.target.closest('tr[data-go]'); if (tr && !e.target.closest('a')) location.hash = encodeURIComponent(tr.dataset.go); });
      $('scStamp').textContent = 'Updated ' + day(D.updated);
      run();
    }).catch(() => fail(table));
  };
})();
