/* Markets: how many stocks are taking part, indexes, pairs, sector trends, rates and the economy. */
(() => {
  const { $, num, usd, day, esc, cell, co, json, fail } = EQ;

  // new 52-week highs and lows, busiest first
  json('cube/price-records.json').then(R => { let open = { high52: false, low52: false };
    const money = v => v == null ? '' : '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    const paint = () => [['high52', 'hi', '52-week highs'], ['low52', 'lo', '52-week lows']].forEach(([side, k, title]) => {
      const all = R.rows.filter(r => r.record.side === side).sort((x, y) => (y.turnoverUSD || 0) - (x.turnoverUSD || 0)), rows = open[side] ? all : all.slice(0, 10);
      $(k + 'Head').innerHTML = `${title} <span>${all.length}</span>`;
      $(k + 'Table').innerHTML = `<thead><tr><th>Company</th><th>Price</th><th>Day</th><th>1 month</th><th title="Dollars traded on the latest day">Traded</th></tr></thead><tbody>` +
        rows.map(r => `<tr><td class="name">${co(r.t, r.n)}</td><td class="num">${usd(r.px)}</td>${cell(r.change)}${cell(r.r && r.r['1M'])}<td class="num soft">${money(r.turnoverUSD)}</td></tr>`).join('') +
        (all.length > 10 ? `<tr><td colspan="5" class="left"><button class="link" type="button" data-all="${side}">${open[side] ? 'Show the top 10' : 'Show all ' + all.length}</button></td></tr>` : '') +
        (all.length ? '' : '<tr><td colspan="5" class="left soft">None on the latest day</td></tr>') + '</tbody>'; });
    $('recStamp').textContent = `Updated ${day(R.as_of)}, ${R.eligible.toLocaleString('en-US')} stocks checked`; paint();
    $('records').addEventListener('click', e => { const b = e.target.closest('[data-all]'); if (b) { open[b.dataset.all] = !open[b.dataset.all]; paint(); } });
  }).catch(() => fail($('hiTable')));

  // weekly review snapshot: indexes, participation, pairs
  const idx = window.QUANT_REVIEWS_INDEX || { editions: [] };
  const id = idx.latest_complete_review_id || (idx.editions[idx.editions.length - 1] || {}).review_id;
  const watch = json('cube/market-watch.json').catch(() => null);
  const plain = { pct_above_20: 'Stocks above their 20-day average', pct_above_50: 'Stocks above their 50-day average', pct_above_200: 'Stocks above their 200-day average', net_highs: '52-week highs minus lows', flags: 'High tight flags', volhighs: 'Volume highs, last 5 sessions' };
  (id ? json(`cube/reviews/${id}/snapshot.json`) : Promise.reject()).then(async S => {
    $('ixTable').innerHTML = `<thead><tr><th>Index</th><th>Last</th><th>1 week</th><th>1 month</th><th>3 months</th><th>This year</th><th title="Gap between the price and its 50-day average">Vs 50-day</th><th title="Gap between the price and its 200-day average">Vs 200-day</th></tr></thead><tbody>` +
      S.indexes.map(x => `<tr><th scope="row">${esc(x.label)}</th><td class="num">${num(x.last)}</td>${[x.r1w, x.r1m, x.r3m, x.ytd, x.vs_ma50, x.vs_ma200].map(n => cell(n == null ? null : n * 100)).join('')}</tr>`).join('') + '</tbody>';
    const pairs = [...(S.ratios || []), ...(S.risk_ratios || [])];
    $('pairTable').innerHTML = '<thead><tr><th>Pair</th><th class="left">Compares</th><th>1 month</th><th>3 months</th></tr></thead><tbody>' +
      pairs.map(r => `<tr><td class="left">${esc(r.label)}</td><td class="wrap">${esc(r.note)}</td>${cell(r.r1m == null ? null : r.r1m * 100)}${cell(r.r3m == null ? null : r.r3m * 100)}</tr>`).join('') + '</tbody>';
    const Wt = await watch, vix = k => Wt && Wt[k] != null ? Wt[k].toFixed(1) : '';
    $('partRows').innerHTML = (S.scoreboard || []).map(s => `<div class="row"><dt title="${esc(s.note)}. Higher than ${Math.round(s.pct)}% of the past five years.">${plain[s.id] || esc(s.label)}</dt><dd class="num">${esc(s.value)}${esc(s.unit || '')}</dd></div>`).join('') +
      (Wt ? `<div class="row"><dt title="Expected swings in the S&amp;P 500 over the next month">VIX</dt><dd class="num">${vix('vix')}</dd></div><div class="row"><dt title="Expected swings over the next three months">VIX, 3 months</dt><dd class="num">${vix('vix3m')}</dd></div>` : '');
  }).catch(() => ['ixTable', 'partRows', 'pairTable'].forEach(k => fail($(k))));

  // sector trends
  const SEC = { XLK: 'Technology', XLC: 'Communication services', XLY: 'Consumer discretionary', XLP: 'Consumer staples', XLE: 'Energy', XLF: 'Financials', XLV: 'Health care', XLI: 'Industrials', XLB: 'Materials', XLRE: 'Real estate', XLU: 'Utilities' };
  watch.then(Wt => { if (!Wt || !Wt.sectors) throw 0;
    const bear = Wt.sectors.filter(s => s.bearish).length;
    $('secCount').textContent = `${bear} of ${Wt.sectors.length} in a downtrend`;
    $('secRows').innerHTML = Wt.sectors.map(s => `<div class="row"><dt>${SEC[s.symbol] || esc(s.symbol)}</dt><dd class="${s.bearish ? 'down' : ''}"${s.bearish ? '' : ' style="font-weight:400;color:var(--muted)"'}>${s.bearish ? 'Downtrend' : 'Holding up'}</dd></div>`).join('');
  }).catch(() => fail($('secRows')));

  // rates and economy: a short list from the macro files, loaded after everything else because the files are large
  const PICK = [['fred:DGS10', '10-year Treasury yield'], ['fred:DGS2', '2-year Treasury yield'], ['fred:MORTGAGE30US', '30-year mortgage rate'], ['fred:UNRATE', 'Unemployment rate'], ['fred:CPILFESL', 'Core inflation, from a year earlier', 'yoy']];
  const later = () => { const all = (window.QUANT_MACRO_INDEX || {}).series || [];
    Promise.all(PICK.map(([sid, title, kind]) => { const s = all.find(x => x.id === sid); if (!s) return null;
      return json(s.file).then(f => { const h = f.histories[kind || 'level'], n = h.length - 1, back = new Date(h[n].date + 'T12:00:00'); back.setFullYear(back.getFullYear() - 1);
        const cutoff = back.toISOString().slice(0, 10); let j = n; while (j > 0 && h[j].date > cutoff) j--;
        return { title, value: h[n].value, prev: n ? h[n - 1].value : null, yearAgo: h[j].value, period: h[n].date }; }).catch(() => null); })).then(rows => {
      rows = rows.filter(Boolean); if (!rows.length) throw 0; const f = x => x == null ? '' : x.toFixed(2) + '%';
      $('macroTable').innerHTML = '<thead><tr><th>Series</th><th>Latest</th><th>Before</th><th>A year ago</th><th>Updated</th></tr></thead><tbody>' +
        rows.map(m => `<tr><th scope="row">${m.title}</th><td class="num">${f(m.value)}</td><td class="num soft">${f(m.prev)}</td><td class="num soft">${f(m.yearAgo)}</td><td class="num soft">${day(m.period, { month: 'short', day: 'numeric' })}</td></tr>`).join('') + '</tbody>';
    }).catch(() => fail($('macroTable'))); };
  if (document.readyState === 'complete') setTimeout(later, 200); else addEventListener('load', () => setTimeout(later, 200));
  EQ.spy();
})();
