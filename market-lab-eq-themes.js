/* Themes: any set of themes, baskets, indexes and funds on one chart, each as percent change over the same window.
   The search box under the chart adds a line; the × beside a name takes it off; a click on a name puts it in the heading.
   With nothing saved the chart opens on the S&P 500 and the two Nasdaq indexes.
   "Create a new theme" saves an equal-weight basket the way the Charts page does (the private cloud workspace);
   on this static site, where that store is read-only, it is kept in this browser instead.
   extra-themes.json (ops/build_extra_themes.py) adds the baskets beyond AI and tech and the Citrini themes.
   hated-m7-basket.json (ops/build_hated_m7_basket.py) is the Most-hated Mag 7 basket and its monthly holdings. */
(() => {
  const { $, css, pct, tone, day, esc, cell, href, json, series, trend, fail, pick, finder, chart, setTone, onRedraw, sortable } = EQ;
  const R = { '1M': [22, 'past month'], '3M': [64, 'past 3 months'], '6M': [127, 'past 6 months'], '1Y': [252, 'past year'] };
  // compare.v1 holds every line on the chart, pick.v1 the one in the heading. lines.v1 marks the set as saved in this form.
  const K = { set: 'equinox.themes.compare.v1', focus: 'equinox.themes.pick.v1', done: 'equinox.themes.lines.v1', mine: 'equinox.themes.mine.v1' };
  const DEF = ['spy', 'ixic'], MAX = 12, HATED = 'saved:most-hated-mag7';
  const SEC = { xlk: 'Technology', xlc: 'Communication services', xly: 'Consumer discretionary', xlp: 'Consumer staples', xle: 'Energy', xlf: 'Financials', xlv: 'Health care', xli: 'Industrials', xlb: 'Materials', xlre: 'Real estate', xlu: 'Utilities' };
  const NICE = { spy: 'S&P 500', ixic: 'Nasdaq Composite', ndx: 'Nasdaq 100', qqq: 'Nasdaq 100 fund (QQQ)' };
  const KIND = { etf: 'Index or fund', basket: 'Basket', asset: 'Asset', reco: 'Basket', level: 'Index' };
  const TINT = ['#c2851a', '#8a63d2', '#1f9d94', '#d1497a', '#3b7dd8', '#7a8b2a', '#c65d2e', '#5b6ac4', '#2e9e5b', '#b0478f', '#8c6d3f', '#4a9bb8'];
  const Cloud = window.MarketLabCloud;
  const baskets = Object.fromEntries(((window.QUANT_BASKETS || {}).baskets || []).map(b => [b.id, b]));
  const read = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const list = k => { try { const x = JSON.parse(read(k) || 'null'); return Array.isArray(x) ? x : null; } catch (_) { return null; } };

  // saved state. A view saved under the old layout (one theme against the S&P 500 plus compare lines, no marker) comes back as the same lines.
  const old = (list(K.set) || []).filter(v => typeof v === 'string');
  let focus = read(K.focus) || '';
  let set = read(K.done) ? old.slice(0, MAX) : focus || old.length ? [...new Set([focus, 'spy', ...old].filter(Boolean))].slice(0, MAX) : DEF.slice();
  let mine = (list(K.mine) || []).filter(b => b && b.id && b.name && Array.isArray(b.members));
  const keep = () => { try { localStorage.setItem(K.set, JSON.stringify(set)); localStorage.setItem(K.done, '1'); if (focus) localStorage.setItem(K.focus, focus); } catch (_) {} };
  const keepMine = () => { try { localStorage.setItem(K.mine, JSON.stringify(mine)); } catch (_) {} };

  let rows = [], info = {}, ids = {}, S = {}, axis = null, ready = false, table = null, L = [], d = [], hated = null;
  const tint = {}; const colour = id => id === 'spy' ? css('--muted') : TINT[tint[id] ?? (tint[id] = TINT.findIndex((_, i) => !Object.values(tint).includes(i)))] || TINT[0];
  const say = t => { $('cmpNote').textContent = t || ''; };

  // prices. carry() puts a series on the chart's dates, holding the last close across gaps; norm() turns it into percent change
  const carry = (p, dates) => { let k = 0, last = null; return dates.map(x => { while (k < p.dates.length && p.dates[k] <= x) { if (p.close[k] != null) last = p.close[k]; k++; } return last; }); };
  const norm = s => { const s0 = s.find(v => v != null); return s.map(v => v == null ? null : (v / s0 - 1) * 100); };
  const canon = t => (ids[String(t).toUpperCase()] || {}).id || t;
  // an equal-weight basket: each day's move is the average move of the members that traded on both days
  const blend = members => Promise.all(members.map(t => series(canon(t)).catch(() => null))).then(ps => {
    const dates = axis.slice(-300), have = ps.filter(Boolean).map(p => carry(p, dates));
    if (!have.length) throw new Error('no prices');
    let level = 100, on = false; const close = [];
    dates.forEach((_, j) => { let num = 0, den = 0; if (j) have.forEach(c => { if (c[j] != null && c[j - 1]) { num += c[j] / c[j - 1] - 1; den++; } });
      if (den) { if (!on) { on = true; close[j - 1] = 100; } level *= 1 + num / den; } close.push(on ? level : null); });
    return { dates, close };
  });
  const load = id => S[id] ? Promise.resolve(S[id]) : info[id].get().then(p => (S[id] = p));

  // everything that can be a line
  const basket = (b, id, own, where) => { const m = b.members.map(t => ({ t: canon(t), name: ((ids[String(t).toUpperCase()] || {}).label || '').split(' · ')[1] || '' }));
    info[id] = { id, name: b.name, note: 'My basket', n: m.length, members: m, own, sub: `${m.length} ${m.length === 1 ? 'stock' : 'stocks'}, equal weight${where}`, get: () => blend(b.members) }; };
  const catalog = (T, snap, extra) => {
    info = {}; ids = {}; T.series.forEach(x => { ids[x.id.toUpperCase()] = x; });
    rows = snap.themes.map(t => ({ ...t, name: t.kind === 'sector' ? SEC[t.id] || t.label : t.label }));
    rows.forEach(r => { const B = baskets[r.id];
      info[r.id] = { id: r.id, name: r.name, note: r.kind === 'sector' ? 'Sector' : r.n + ' stocks', n: r.n, members: B ? B.members : null, more: B ? r.id : null,
        sub: r.kind === 'sector' ? 'Sector fund ' + r.id.toUpperCase() : `${r.n} stocks, equal weight`, get: () => series(r.id) }; });
    if (extra) extra.themes.filter(t => !info[t.id]).forEach(t => {
      rows.push({ id: t.id, label: t.label, name: t.label, kind: 'extra', n: t.n, r1w: t.r1w, r1m: t.r1m, r3m: t.r3m, drank: null });
      info[t.id] = { id: t.id, name: t.label, note: t.n + ' stocks', n: t.n, members: t.members, signed: true,
        sub: `${t.n} stocks, ${t.weights !== 'equal' ? 'Citrini weights' : 'equal weight'}${t.missing.length ? '. No prices for ' + t.missing.join(', ') : ''}`,
        get: () => Promise.resolve({ dates: extra.dates, close: t.close }) }; });
    T.series.filter(x => KIND[x.kind] && !info[x.id]).forEach(x => {
      info[x.id] = { id: x.id, name: NICE[x.id] || x.label, note: KIND[x.kind], sub: (x.nav || [])[1] || KIND[x.kind], hide: x.id === 'hatedm7' && !!hated, get: () => series(x.id) }; });
    ((Cloud && Cloud.state.baskets) || []).forEach(b => basket(b, 'saved:' + b.id, !Cloud.static, ''));
    mine.forEach(b => basket(b, 'mine:' + b.id, true, ', saved in this browser'));
    if (hated) { const c = hated.current, t = c.members.join(', ');
      info[HATED] = { id: HATED, name: hated.name, note: 'My basket, changes monthly', n: c.members.length, members: c.members.map(x => ({ t: x, name: '' })),
        sub: `Holding ${t} for ${day(c.month + '-01', { month: 'long', year: 'numeric' })}, picked at the ${day(c.decided, { month: 'long', day: 'numeric' })} close`,
        tail: '<a href="market-lab-hatedm7.html">How it is picked</a>', get: () => Promise.resolve({ dates: hated.dates, close: hated.close }) };
      rows.push({ id: HATED, label: hated.name, name: hated.name, kind: 'mine', n: c.members.length, r1w: hated.r1w, r1m: hated.r1m, r3m: hated.r3m, drank: null }); }
  };
  const items = () => Object.values(info).filter(x => !x.hide && !set.includes(x.id)).map(x => ({ id: x.id, name: x.name, note: x.note, key: (x.name + ' ' + x.id).toLowerCase() }));

  // every stock in the heading's theme as its own line
  const MP = {}, off = new Set(); let all = false;
  const stocks = () => ((info[focus] || {}).members || []).slice(0, 40);
  const fetchAll = () => Promise.all(stocks().filter(m => !(m.t in MP)).map(m => series(canon(m.t)).then(p => { MP[m.t] = p; }).catch(() => { MP[m.t] = null; })));

  const live = () => set.filter(id => info[id] && S[id]);
  const head = i => { const j = i == null ? d.length - 1 : i, f = L[0];
    $('price').textContent = f ? pct(f.v[j], 1) : ''; $('price').className = 'price num ' + (f ? tone(f.v[j]) : '');
    $('chg').innerHTML = f ? `<span>${i == null ? R[range()][1] : day(d[i])}</span>` : '';
    const by = Object.fromEntries(L.map(l => [l.id || 't:' + l.t, l]));
    $('cmpKey').innerHTML = live().map(id => { const l = by[id], v = l.v[j], n = esc(l.name);
      return `<span class="key${id === focus ? ' on' : ''}"><button type="button" class="chip" data-f="${esc(id)}" aria-pressed="${id === focus}" title="Put ${n} in the heading"><i style="background:${l.col}"></i>${n} <b class="num ${tone(v)}">${pct(v, 1)}</b></button><button type="button" class="x" data-x="${esc(id)}" aria-label="Remove ${n}" title="Remove ${n}">×</button></span>`; }).join('') +
      L.filter(l => l.t).map(l => `<span class="key"><span class="chip"><i style="background:${l.col}"></i>${esc(l.name)} <b class="num ${tone(l.v[j])}">${pct(l.v[j], 1)}</b></span><button type="button" class="x" data-t="${esc(l.t)}" aria-label="Remove ${esc(l.name)}" title="Remove ${esc(l.name)}">×</button></span>`).join(''); };
  const draw = () => { if (!ready) return; const on = live(); d = axis.slice(-R[range()][0]);
    if (!on.includes(focus)) focus = on[0] || '';
    const line = (id, w) => ({ id, name: info[id].name, v: norm(carry(S[id], d)), col: colour(id), w });
    L = focus ? [line(focus, 2.5), ...on.filter(id => id !== focus).map(id => line(id, 1.75)),
      ...(all ? stocks().filter(m => MP[m.t] && !off.has(m.t)).map((m, i) => ({ t: m.t, name: m.t, v: norm(carry(MP[m.t], d)), col: TINT[(on.length + i) % TINT.length], w: 1.25 })) : [])] : [];
    describe();
    if (!L.length) { $('chart').innerHTML = '<p class="wait">Nothing on the chart. Search below to add a line.</p>'; head(null); return; }
    setTone(L[0].v[L[0].v.length - 1]);
    chart($('chart'), { lines: L, dash: 0, label: `${L.map(l => l.name).join(', ')}: percent change, ${R[range()][1]}`, onHover: head }); head(null); };
  const range = pick($('ranges'), Object.keys(R).map(k => [k]), 'equinox.themes.range.v1', '3M', draw);
  onRedraw(draw);

  // heading, member list and the buttons that depend on the line in the heading
  const allBtn = $('showAll'), delBtn = $('delTheme'); let shown = null;
  const describe = () => { if (shown === focus + all) return; shown = focus + all; const x = info[focus];
    $('name').textContent = x ? x.name : 'Themes'; document.title = (x ? x.name + ' · ' : '') + 'Themes · Equinox'; $('sub').innerHTML = x ? esc(x.sub) : '&nbsp;';
    const link = m => `<a href="${href(m.t)}" title="${esc(m.name || '')}">${esc(m.t)}</a>`, M = (x && x.members) || [];
    const long = x && x.signed ? M.filter(m => m.w > 0) : x && x.more ? M.slice(0, 10) : M, short = x && x.signed ? M.filter(m => m.w < 0) : [];
    $('members').innerHTML = long.map(link).join('') + (x && x.more && M.length > long.length ? `<a href="market-lab-baskets.html#${encodeURIComponent(x.more)}">and ${M.length - long.length} more</a>` : '') +
      (short.length ? `<span class="short">Short</span>` + short.map(link).join('') : '') + ((x && x.tail) || '');
    allBtn.hidden = !M.length; delBtn.hidden = !(x && x.own);
    if (table) table.paint(); };
  const setAll = on => { all = on; off.clear(); allBtn.textContent = on ? 'Hide stocks' : 'Show all'; allBtn.setAttribute('aria-pressed', on); if (on) fetchAll().then(draw); else draw(); };
  allBtn.addEventListener('click', () => setAll(!all));
  const setFocus = id => { focus = id; off.clear(); keep(); if (all) fetchAll().then(draw); else draw(); };

  // add and remove lines
  const add = (id, quiet) => { const x = info[id]; if (!x) return Promise.resolve(false);
    if (set.includes(id) && S[id]) { say(''); setFocus(id); return Promise.resolve(true); }
    if (!set.includes(id) && live().length >= MAX) { if (!quiet) say(`The chart holds ${MAX} lines. Take one off to add ${x.name}.`); return Promise.resolve(false); }
    return load(id).then(() => { if (!set.includes(id)) set.push(id); say(''); setFocus(id); return true; }).catch(() => { say(`No prices for ${x.name} yet.`); return false; }); };
  const drop = id => { set = set.filter(v => v !== id); delete tint[id]; if (focus === id) focus = ''; say(''); keep(); draw(); };
  finder($('cmpFind'), id => add(id), { items, all: true });
  $('cmpKey').addEventListener('click', e => { const b = e.target.closest('[data-x],[data-t],[data-f]'); if (!b) return;
    if (b.dataset.t) { off.add(b.dataset.t); draw(); } else if (b.dataset.x) drop(b.dataset.x); else setFocus(b.dataset.f); });

  // create a theme: a name and tickers checked against the site's list
  const form = $('newForm'), newBtn = $('newBtn'), nameIn = $('newName'), note = $('newNote'); let draft = [], busy = false;
  const paintDraft = () => { $('newList').innerHTML = draft.map(t => `<span class="key"><span class="chip">${esc(t)}</span><button type="button" class="x" data-t="${esc(t)}" aria-label="Remove ${esc(t)}" title="Remove ${esc(t)}">×</button></span>`).join('') +
    (draft.length ? `<span class="when">${draft.length} ${draft.length === 1 ? 'stock' : 'stocks'}, equal weight</span>` : ''); };
  const openForm = on => { form.hidden = !on; newBtn.setAttribute('aria-expanded', on); newBtn.hidden = on; if (on) { draft = []; nameIn.value = ''; note.textContent = ''; paintDraft(); nameIn.focus(); } else newBtn.focus(); };
  newBtn.addEventListener('click', () => openForm(true)); $('newCancel').addEventListener('click', () => openForm(false));
  form.addEventListener('keydown', e => { if (e.key === 'Escape' && $('newFind').querySelector('ul').hidden) openForm(false); });
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('newFind').querySelector('input').focus(); } });
  finder($('newFind'), typed => { const bad = [];
    String(typed).split(/[\s,;]+/).filter(Boolean).forEach(t => { const x = ids[t.toUpperCase()];
      if (!x || !['equity', 'asset', 'etf'].includes(x.kind)) bad.push(t.toUpperCase()); else if (!draft.includes(x.id) && draft.length < 50) draft.push(x.id); });
    note.textContent = bad.length ? `Not on the site's list: ${bad.join(', ')}` : ''; paintDraft(); setTimeout(() => $('newFind').querySelector('input').focus(), 0); });
  $('newList').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { draft = draft.filter(t => t !== b.dataset.t); paintDraft(); } });
  $('newSave').addEventListener('click', () => { const name = nameIn.value.trim(); if (busy) return;
    if (!name) { note.textContent = 'Give the theme a name.'; nameIn.focus(); return; }
    if (Object.values(info).some(x => x.name.toLowerCase() === name.toLowerCase())) { note.textContent = `There is already a line called ${name}. Pick another name.`; nameIn.focus(); return; }
    if (draft.length < 2) { note.textContent = 'Add at least 2 tickers.'; return; }
    busy = true; note.textContent = '';
    // same call the Charts page makes; the static site has no writable store, so the theme stays in this browser
    const saved = Cloud && !Cloud.static
      ? Cloud.request('baskets', { method: 'POST', body: JSON.stringify({ name, members: draft.slice() }) }).then(body => { const b = body.basket;
          Cloud.state.baskets = Cloud.state.baskets.filter(r => r.id !== b.id).concat(b); dispatchEvent(new Event('ml:cloudchange')); basket(b, 'saved:' + b.id, true, ''); return 'saved:' + b.id; })
      : Promise.resolve().then(() => { const b = { id: 'm' + Date.now().toString(36), name, members: draft.slice() }; mine.push(b); keepMine(); basket(b, 'mine:' + b.id, true, ', saved in this browser'); return 'mine:' + b.id; });
    saved.then(id => { openForm(false); return add(id); }).catch(err => { note.textContent = (err && err.message) || 'The theme could not be saved.'; }).finally(() => { busy = false; }); });
  delBtn.addEventListener('click', () => { const x = info[focus]; if (!x || !x.own || busy) return;
    if (!confirm(`Delete "${x.name}"? This cannot be undone.`)) return;
    const id = x.id, done = () => { delete info[id]; delete S[id]; drop(id); };
    if (id.startsWith('mine:')) { mine = mine.filter(b => 'mine:' + b.id !== id); keepMine(); done(); }
    else { busy = true; Cloud.deleteBasket(id.slice(6)).then(done).catch(err => say((err && err.message) || 'The theme could not be deleted.')).finally(() => { busy = false; }); } });

  const idx = window.QUANT_REVIEWS_INDEX || { editions: [] };
  const rid = idx.latest_complete_review_id || (idx.editions[idx.editions.length - 1] || {}).review_id;
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (!info[id]) return Promise.resolve(false);
    history.replaceState(null, '', location.pathname + location.search); return add(id).then(ok => { scrollTo(0, 0); return ok; }); };
  Promise.all([rid ? json(`cube/reviews/${rid}/snapshot.json`) : Promise.reject(), json('extra-themes.json').catch(() => null), trend(), series('spy'),
    json('hated-m7-basket.json').catch(() => null), Cloud ? Cloud.ready.catch(() => null) : null]).then(([snap, extra, T, spy, H]) => {
    hated = H; axis = spy.dates; S.spy = spy; catalog(T, snap, extra);
    $('stamp').textContent = 'Updated ' + day(axis[axis.length - 1]);
    $('thTable').tHead.innerHTML = `<tr><th data-k="label"><button type="button">Theme</button></th><th data-k="n"><button type="button">Stocks</button></th><th data-k="r1w"><button type="button">1 week</button></th><th data-k="r1m"><button type="button">1 month</button></th><th data-k="r3m"><button type="button">3 months</button></th><th data-k="drank" title="Places gained or lost in the weekly ranking"><button type="button">Rank change</button></th></tr>`;
    const pc = v => cell(v == null ? null : v * 100);
    table = sortable($('thTable'), rows, r => `<tr class="${set.includes(r.id) ? 'pick' : ''}"><td class="left"><button class="rowbtn" type="button" data-id="${esc(r.id)}" title="Add ${esc(r.name)} to the chart">${esc(r.name)}</button></td><td class="num soft">${r.kind === 'sector' ? '' : r.n}</td>${pc(r.r1w)}${pc(r.r1m)}${pc(r.r3m)}<td class="num soft">${r.drank ? (r.drank > 0 ? '+' : '−') + Math.abs(r.drank) : ''}</td></tr>`,
      { k: 'r1w', dir: 1, key: 'equinox.themes.sort.v1', cols: { label: r => r.name, n: r => r.n, r1w: r => r.r1w, r1m: r => r.r1m, r3m: r => r.r3m, drank: r => r.drank } });
    $('thTable').tBodies[0].addEventListener('click', e => { const btn = e.target.closest('.rowbtn'); if (!btn) return;
      add(btn.dataset.id).then(ok => { table.paint(); if (ok) scrollTo({ top: 0, behavior: 'smooth' }); else $('cmpNote').scrollIntoView({ block: 'center', behavior: 'smooth' }); }); });
    return Promise.all(set.filter(id => info[id]).map(id => load(id).catch(() => null))).then(() => { ready = true; draw(); return fromHash(); });
  }).catch(() => { $('name').textContent = 'Themes'; fail($('thTable').tBodies[0]); });
  addEventListener('hashchange', () => { if (ready) fromHash(); });
  EQ.spy();
})();
