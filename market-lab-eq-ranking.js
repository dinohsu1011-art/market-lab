/* Full ranking: every stock, fund and index in one table. The column headers rank it.
   The view is kept in the address (#sort=3M&uni=stocks) and under equinox.ranking.state.v1.
   Older addresses (#1D|all|best|... and ?analytics=...) still open the matching view. */
(() => {
  const { $, pct, tone, usd, day, esc, href, json } = EQ;
  const L = window.QUANT_LEADERS, T = $('rkTable');
  if (!L) { EQ.fail(T.tBodies[0]); return; }
  const M = L.meta, KEY = 'equinox.ranking.state.v1', STEP = 150;
  const short = r => { const n = r.n || ''; return n.endsWith(' · ' + r.t) ? n.slice(0, -r.t.length - 3) : n.startsWith(r.t + ' · ') ? n.slice(r.t.length + 3) : n; };
  const whole = v => v == null ? '' : pct(Math.round(v) || 0, 0);
  let rows = L.rows.filter(r => !r.stale);

  // columns: [key, label, value, cell, optional, tip]
  const ret = k => [k, { '1D': '1 day', '1W': '1 week', '1M': '1 month', '3M': '3 months', '6M': '6 months', YTD: 'This year', '1Y': '1 year', '3Y': '3 years' }[k], r => r.r ? r.r[k] : null,
    r => { const v = r.r ? r.r[k] : null; return `<td class="num ${tone(v)}">${pct(v, Math.abs(v) < 9.95 ? 1 : 0)}</td>`; }, k === '3Y'];
  const COLS = [
    ['px', 'Price', r => r.px, r => `<td class="num soft">${r.px == null ? '' : r.a === 'index' ? EQ.num(r.px) : usd(r.px)}</td>`],
    ...['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y'].map(ret),
    ['rsi', 'RSI', r => r.rsi ? r.rsi['14'] : null, r => `<td class="num soft">${r.rsi && r.rsi['14'] != null ? r.rsi['14'].toFixed(0) : ''}</td>`, false, 'A 0 to 100 speed gauge over 14 days. Over 70 means a fast rise, under 30 a fast fall.'],
    ['high', 'From high', r => r.off52, r => `<td class="num soft">${whole(r.off52)}</td>`, false, 'How far the price sits below its highest close of the past year.'],
    ['low', 'From low', r => r.up52, r => `<td class="num soft">${whole(r.up52)}</td>`, true, 'How far the price sits above its lowest close of the past year.'],
  ];
  const COL = Object.fromEntries(COLS.map(c => [c[0], c]));
  const UNI = [['all', 'All', () => true], ['stocks', 'Stocks', r => r.a === 'stock'], ['etfs', 'Funds', r => r.a === 'etf'], ['indexes', 'Indexes', r => r.a === 'index'], ['sp', 'S&P 500', r => r.sp]];
  const themeId = v => !v ? '' : M.themes[v] ? v : (Object.entries(M.themes).find(e => e[1].toLowerCase() === v.toLowerCase()) || [''])[0];
  const sectorName = v => M.sectors.find(s => s.toLowerCase() === (v || '').toLowerCase()) || '';

  // state
  const st = { sort: '3M', dir: 'desc', uni: 'stocks', sector: '', theme: '', q: '' };
  const clean = o => { if (!o) return;
    const s = String(o.sort || ''), k = COL[s] ? s : COL[s.toUpperCase()] ? s.toUpperCase() : COL[s.toLowerCase()] ? s.toLowerCase() : s.toLowerCase() === 'name' ? 'name' : '';
    if (k) { st.sort = k; st.dir = o.dir === 'asc' || o.dir === 'desc' ? o.dir : k === 'name' ? 'asc' : 'desc'; }
    if (UNI.some(u => u[0] === o.uni)) st.uni = o.uni;
    if (o.sector != null) st.sector = sectorName(o.sector);
    if (o.theme != null) st.theme = themeId(o.theme);
    if (st.sector) st.theme = '';
    if (o.q != null) st.q = String(o.q).slice(0, 40); };
  const dec = s => { try { return decodeURIComponent(s || ''); } catch (_) { return s || ''; } };
  // the old page packed its view as win|uni|rank|top|adv|sector|theme|view|... ; chart views now open the table
  const legacy = h => { const p = h.split('|'), win = COL[p[0]] ? p[0] : '3M', rank = p[2] || 'best';
    const by = { worst: [win, 'asc'], rsi: ['rsi', 'desc'], oversold: ['rsi', 'asc'], high52: ['high', 'desc'], low52: ['low', 'asc'] }[rank] || [win, 'desc'];
    return { sort: by[0], dir: by[1], uni: UNI.some(u => u[0] === p[1]) ? p[1] : 'all', sector: dec(p[5]), theme: dec(p[6]), q: '' }; };
  const fromHash = () => { const h = location.hash.slice(1); if (!h) return null;
    if (h.includes('|')) return legacy(h);
    if (!h.includes('=')) return null;
    const q = new URLSearchParams(h); return { sort: q.get('sort'), dir: q.get('dir'), uni: q.get('uni'), sector: q.get('sector') || '', theme: q.get('theme') || '', q: q.get('q') || '' }; };
  const query = new URLSearchParams(location.search), drill = query.get('analytics');
  let stored = null; try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  clean(stored); clean(fromHash());
  if (drill) { st.uni = 'all'; st.sector = st.theme = st.q = ''; }
  let mine = '';
  const keep = () => {
    const q = new URLSearchParams(); q.set('sort', st.sort); if (st.dir !== (st.sort === 'name' ? 'asc' : 'desc')) q.set('dir', st.dir); q.set('uni', st.uni);
    if (st.sector) q.set('sector', st.sector); if (st.theme) q.set('theme', st.theme); if (st.q) q.set('q', st.q);
    mine = '#' + q.toString();
    try { history.replaceState(null, '', location.pathname + location.search + mine); } catch (_) {}
    if (!drill) try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };

  // table
  let only = null, list = [], shown = 0;
  const pool = () => { const u = UNI.find(x => x[0] === st.uni)[2], q = st.q.trim().toLowerCase();
    return rows.filter(r => (!only || only.has(r.t.toLowerCase())) && u(r) && (!st.sector || r.s === st.sector) && (!st.theme || (r.th || []).includes(st.theme)) && (!q || r.t.toLowerCase().startsWith(q) || (r.n || '').toLowerCase().includes(q))); };
  const line = (r, i) => `<tr><td class="rank num">${i + 1}</td><td class="name"><a href="${href(r.t)}">${esc(r.t)}</a><span>${esc(short(r))}</span></td>${COLS.map(c => c[4] ? c[3](r).replace('<td class="', `<td class="opt o-${c[0]} `) : c[0] === 'px' ? c[3](r).replace('<td class="', '<td class="px ') : c[3](r)).join('')}</tr>`;
  const more = () => { const next = list.slice(shown, shown + STEP); if (!next.length) return;
    T.tBodies[0].insertAdjacentHTML('beforeend', next.map((r, i) => line(r, shown + i)).join('')); shown += next.length; foot(); };
  const foot = () => { const n = list.length;
    $('rkMore').innerHTML = shown < n ? `<button type="button" id="rkNext">Show ${Math.min(STEP, n - shown)} more</button><span>Showing ${shown.toLocaleString('en-US')} of ${n.toLocaleString('en-US')}</span><button type="button" id="rkAll">Show all</button>` : n > STEP ? `<span>All ${n.toLocaleString('en-US')} shown</span>` : ''; };
  const heads = () => { const th = (k, label, o = {}) => `<th class="${o.cls || ''}"${k === st.sort ? ` aria-sort="${st.dir}ending"` : ''}${o.tip ? ` title="${esc(o.tip)}"` : ''}><button type="button" data-k="${k}">${label}</button></th>`;
    T.tHead.innerHTML = `<tr><th></th>${th('name', 'Company', { cls: 'name' })}${COLS.map(c => th(c[0], c[1], { cls: c[4] ? 'opt o-' + c[0] : c[0] === 'px' ? 'px' : '', tip: c[5] })).join('')}</tr>`;
    T.dataset.wide = COL[st.sort] && COL[st.sort][4] ? st.sort : ''; };
  const draw = () => {
    const get = st.sort === 'name' ? null : COL[st.sort][2], d = st.dir === 'asc' ? 1 : -1;
    list = pool();
    if (get) list = list.filter(r => get(r) != null).sort((a, b) => (get(a) - get(b)) * d || a.t.localeCompare(b.t)).concat(list.filter(r => get(r) == null));
    else list.sort((a, b) => a.t.localeCompare(b.t) * d);
    heads(); T.tBodies[0].innerHTML = ''; shown = 0;
    if (list.length) more(); else { T.tBodies[0].innerHTML = `<tr><td colspan="${COLS.length + 2}" class="none">Nothing matches. Clear a filter to see more.</td></tr>`; foot(); }
    const u = UNI.find(x => x[0] === st.uni), what = st.uni === 'all' ? 'stocks, funds and indexes' : st.uni === 'sp' ? 'S&P 500 stocks' : u[1].toLowerCase();
    $('sub').textContent = `${list.length.toLocaleString('en-US')} ${what}${st.sector ? ' in ' + st.sector : st.theme ? ' in ' + M.themes[st.theme] : ''}`;
    controls(); keep(); };

  // controls
  const controls = () => {
    [...$('rkUni').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.u === st.uni));
    const g = st.sector || (st.theme ? M.themes[st.theme] : '');
    $('rkGroup').hidden = !!g; $('rkPicked').hidden = !g;
    if (g) $('rkPicked').innerHTML = `${esc(g)}<span aria-hidden="true">×</span>`, $('rkPicked').setAttribute('aria-label', 'Remove the ' + g + ' filter');
    if (document.activeElement !== $('rkText')) $('rkText').value = st.q; };
  $('rkUni').innerHTML = UNI.map(u => `<button type="button" data-u="${u[0]}" aria-pressed="false">${esc(u[1])}</button>`).join('');
  $('rkUni').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.u !== st.uni) { st.uni = b.dataset.u; draw(); } });
  const groups = () => M.sectors.map(s => ({ id: 's:' + s, name: s, key: s.toLowerCase(), note: 'Sector' })).concat(Object.entries(M.themes).map(([id, n]) => ({ id: 't:' + id, name: n, key: (n + ' ' + id).toLowerCase(), note: 'Theme' })).sort((a, b) => a.name.localeCompare(b.name)));
  EQ.finder($('rkGroup'), id => { st.sector = id.startsWith('s:') ? id.slice(2) : ''; st.theme = id.startsWith('t:') ? id.slice(2) : ''; draw(); }, { items: groups, all: true });
  $('rkPicked').addEventListener('click', () => { st.sector = st.theme = ''; draw(); $('rkGroup').querySelector('input').focus(); });
  let wait = 0; $('rkText').addEventListener('input', e => { clearTimeout(wait); wait = setTimeout(() => { st.q = e.target.value; draw(); }, 120); });
  $('rkText').form.addEventListener('submit', e => e.preventDefault());
  T.addEventListener('click', e => { const b = e.target.closest('thead button[data-k]'); if (!b) return; const k = b.dataset.k;
    if (k === st.sort) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = k === 'name' ? 'asc' : 'desc'; }
    draw(); T.querySelector(`thead button[data-k="${k}"]`).focus(); });
  $('rkMore').addEventListener('click', e => { if (e.target.id === 'rkNext') more(); if (e.target.id === 'rkAll') { while (shown < list.length) more(); } });
  addEventListener('hashchange', () => { if (location.hash === mine) return; clean(fromHash()); draw(); });
  $('stamp').textContent = 'Updated ' + day(M.as_of);
  draw();

  // a group handed over from the Analytics page: ?analytics=sp500&screen=highs&date=2026-11-16
  if (drill) {
    const note = $('rkNote'), back = `<a class="link" href="market-lab-analytics.html#universe=${encodeURIComponent(drill)}">Back to Analytics</a> <a class="link" href="market-lab-leaders.html">Show everything</a>`;
    const NAMES = { advancing: 'Stocks that rose', declining: 'Stocks that fell', highs: 'New highs', lows: 'New lows', dd0: 'Within 5% of the high', dd1: '5% to 10% below the high', dd2: '10% to 20% below the high', dd3: '20% to 40% below the high', dd4: 'More than 40% below the high' };
    note.hidden = false; note.textContent = 'Loading the Analytics group.'; only = new Set(); draw();
    (['sp500', 'nasdaq', 'total'].includes(drill) ? Promise.all([json('cube/analytics-members.json'), json('cube/analytics-drill-' + drill + '.json')]) : Promise.reject()).then(([cat, d]) => {
      const date = query.get('date'), screen = query.get('screen'), i = d.dates.indexOf(date), enc = d.screens[screen] && d.screens[screen][i];
      if (i < 0 || !enc) throw 0;
      const bits = Uint8Array.from(atob(enc), c => c.charCodeAt(0)), picked = d.stems.filter((s, n) => (bits[n >> 3] >> (n & 7)) & 1);
      const look = {}; Object.entries(cat.stocks).forEach(([stem, s]) => { look[stem.toLowerCase()] = s; if (s.id) look[s.id.toLowerCase()] = s; });
      const have = new Set(rows.map(r => r.t.toLowerCase()));
      picked.forEach(stem => { const s = look[stem.toLowerCase()]; if (have.has(stem.toLowerCase()) || !s || !s.fresh) return;
        rows.push({ t: stem, n: s.name, a: 'stock', s: s.sector || '', th: [], r: s.r || {}, px: s.px, rsi: null, off52: s.off52, up52: null, sp: drill === 'sp500' }); });
      only = new Set(picked.map(s => s.toLowerCase()));
      note.innerHTML = `${esc(NAMES[screen] || 'Analytics group')} on ${esc(day(date))}, ${picked.length.toLocaleString('en-US')} stocks. Returns run through ${esc(day(M.as_of))}. ${back}`;
      draw();
    }).catch(() => { note.innerHTML = 'That Analytics group did not load. ' + back; });
  }
})();
