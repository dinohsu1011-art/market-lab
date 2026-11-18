/* Leaders: the 25 best stocks by whichever column is picked, and the laggards sitting near their lows.
   The column headers are the controls. The saved leaders choice stays under equinox.leaders.rank.v1. */
(() => {
  const { $, pct, tone, usd, day, esc, cell, co, json, fail } = EQ;
  const root = document.documentElement;
  root.style.setProperty('--tone', 'var(--accent)'); root.style.setProperty('--tint', 'color-mix(in srgb, var(--accent) 12%, transparent)');
  const read = (key, ok, def) => { try { const s = localStorage.getItem(key); return ok(s) ? s : def; } catch (_) { return def; } };
  const save = (key, v) => { try { localStorage.setItem(key, v); } catch (_) {} };
  // one header cell: a button when it ranks the table, marked with aria-sort when it is the one in use
  const head = (k, label, on, o = {}) => `<th${o.cls ? ` class="${o.cls}"` : ''}${k === on ? ` aria-sort="${o.up ? 'ascending' : 'descending'}"` : ''}${o.tip ? ` title="${esc(o.tip)}"` : ''}><button type="button" data-k="${k}">${label}</button></th>`;
  const pressed = (table, cb) => table.addEventListener('click', e => { const b = e.target.closest('thead button[data-k]'); if (b) cb(b.dataset.k); });

  // leaders
  const K = ['1W', '1M', '3M', '6M', '1Y'], NAME = { '1W': '1 week', '1M': '1 month', '3M': '3 months', '6M': '6 months', '1Y': '1 year', RSI: 'RSI', HIGH: 'distance from the high' };
  const KEY = 'equinox.leaders.rank.v1';
  const L = window.QUANT_LEADERS, rows = L ? L.rows.filter(r => r.a === 'stock' && !r.stale) : [];
  const val = { RSI: r => r.rsi ? r.rsi['14'] : null, HIGH: r => r.off52 };
  K.forEach(k => { val[k] = r => r.r[k]; });
  let by = read(KEY, s => s in val, '3M');
  const draw = () => {
    const get = val[by], T = $('leadTable'), ret = K.includes(by);
    T.tHead.innerHTML = `<tr><th></th><th class="name">Company</th><th>Price</th>${K.map(k => head(k, NAME[k], by)).join('')}${head('RSI', 'RSI', by, { tip: 'A 0 to 100 speed gauge over 14 days. Over 70 means the stock has risen fast.' })}${head('HIGH', 'From high', by, { tip: 'How far the price sits below its highest close of the past year.' })}</tr>`;
    T.tBodies[0].innerHTML = rows.filter(r => get(r) != null).sort((a, b) => get(b) - get(a) || (b.r['3M'] || 0) - (a.r['3M'] || 0)).slice(0, 25).map((r, i) =>
      `<tr title="${esc(r.s || '')}"><td class="rank num">${i + 1}</td><td class="name">${co(r.t, r.n)}</td><td class="num soft">${usd(r.px)}</td>${K.map(k => `<td class="num ${tone(r.r[k])}"${k === by || !ret ? '' : ' style="font-weight:400"'}>${pct(r.r[k], 0)}</td>`).join('')}<td class="num soft${by === 'RSI' ? ' on' : ''}">${val.RSI(r) != null ? val.RSI(r).toFixed(0) : ''}</td><td class="num soft${by === 'HIGH' ? ' on' : ''}">${r.off52 == null ? '' : pct(Math.round(r.off52) || 0, 0)}</td></tr>`).join('');
    $('sub').textContent = `${rows.length.toLocaleString('en-US')} stocks, ranked by ${ret ? NAME[by] + ' return' : NAME[by]}`;
    $('leadAll').href = 'market-lab-leaders.html#sort=' + ({ RSI: 'rsi', HIGH: 'high' }[by] || by) + '&uni=stocks';
  };
  if (L) { $('stamp').textContent = 'Updated ' + day(L.meta.as_of); $('leadAll').textContent = `All ${rows.length.toLocaleString('en-US')} stocks`;
    pressed($('leadTable'), k => { if (k === by || !(k in val)) return; by = k; save(KEY, k); draw(); $('leadTable').querySelector(`button[data-k="${k}"]`).focus(); });
    draw(); }
  else fail($('leadTable').tBodies[0]);

  // laggards: the file lists every stock near its own low, strongest before the drop first
  const LKEY = 'equinox.laggards.rank.v1';
  const LCOL = { strong: null, rsi: [r => r.rsi, 1], r1m: [r => r.r1m, 1], off52: [r => r.off52, 1], low: [r => Date.parse(r.low_date), -1] };
  let lby = read(LKEY, s => s in LCOL, 'strong');
  json('cube/rsi-lows.json').then(R => {
    const T = $('lowTable'); T.innerHTML = '<thead></thead><tbody></tbody>';
    const paint = () => {
      const c = LCOL[lby], list = c ? R.rows.filter(r => c[0](r) != null && !isNaN(c[0](r))).sort((a, b) => (c[0](a) - c[0](b)) * c[1]) : R.rows;
      const on = k => lby === k ? ' on' : '';
      T.tHead.innerHTML = `<tr>${head('strong', 'Company', lby, { cls: 'name', tip: 'Stocks that were strongest before the drop come first.' })}<th class="left">Theme</th>${head('rsi', 'RSI', lby, { up: 1, tip: 'A 0 to 100 speed gauge over 14 days. Under 30 means the stock has fallen fast.' })}${head('r1m', '1 month', lby, { up: 1 })}${head('off52', 'From high', lby, { up: 1 })}${head('low', 'Low set', lby, { tip: 'The day the speed gauge hit its lowest reading of the past year.' })}</tr>`;
      T.tBodies[0].innerHTML = list.slice(0, 25).map(r => `<tr><td class="name">${co(r.id, r.name)}</td><td class="wrap">${esc(r.theme && r.theme.label || '')}</td><td class="num${on('rsi')}">${r.rsi.toFixed(0)}</td>${cell(r.r1m, 0)}${cell(r.off52, 0)}<td class="num soft${on('low')}">${day(r.low_date, { month: 'short', day: 'numeric' })}</td></tr>`).join('');
    };
    pressed(T, k => { if (k === lby || !(k in LCOL)) return; lby = k; save(LKEY, k); paint(); T.querySelector(`button[data-k="${k}"]`).focus(); });
    paint();
    $('lowStamp').textContent = 'Updated ' + day(R.updated); $('lowSub').textContent = `${R.rows.length.toLocaleString('en-US')} stocks near their lows, strongest before the drop first`;
  }).catch(() => fail($('lowTable')));
  EQ.spy();
  // Leaders and Laggards share this file; the address decides which of the two tables is on the page
  const show = () => { const low = location.hash === '#laggards'; $('top').hidden = low; $('laggards').hidden = !low; document.title = (low ? 'Laggards' : 'Leaders') + ' · Equinox'; scrollTo(0, 0); };
  addEventListener('hashchange', show); show();
})();
