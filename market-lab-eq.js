/* Shared helpers for the rebuilt Equinox pages: formatting, data loading, a bare line chart,
   remembered button groups and sortable tables. The top bar and theme live in market-lab-shell.js. */
window.EQ = (() => {
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const css = v => getComputedStyle(root).getPropertyValue(v).trim();
  const pct = (v, d = 1) => v == null || !isFinite(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
  const tone = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
  const num = (v, d = 2) => v == null || !isFinite(v) ? '' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd = v => v == null || !isFinite(v) ? '' : '$' + num(v);
  const big = v => { if (v == null || !isFinite(v)) return ''; const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + '$' + (a >= 1e12 ? (a / 1e12).toFixed(2) + ' trillion' : a >= 1e9 ? (a / 1e9).toFixed(1) + ' billion' : a >= 1e6 ? (a / 1e6).toFixed(0) + ' million' : num(a, 0)); };
  const day = (s, o = { month: 'short', day: 'numeric', year: 'numeric' }) => s ? new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', o) : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cell = (v, d = 1) => `<td class="num ${tone(v)}">${pct(v, d)}</td>`;
  const href = s => 'market-lab-company.html#' + encodeURIComponent(s);
  const co = (s, name) => `<a href="${href(s)}">${esc(s)}</a>${name && name !== s ? `<span>${esc(name.startsWith(s + ' · ') ? name.slice(s.length + 3) : name)}</span>` : ''}`;

  // data
  const cache = {};
  const json = path => cache[path] || (cache[path] = fetch(path).then(r => { if (!r.ok) throw new Error(path + ' ' + r.status); return window.MarketLabReadJSON(r); }));
  const script = src => cache[src] || (cache[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.append(s); }));
  const trend = () => json('cube/trend-index.json');
  // price files store dates as day gaps: the first is days since 1970, the rest are steps
  const iso = n => new Date(n * 864e5).toISOString().slice(0, 10);
  const prices = file => json('cube/' + file).then(p => { let d = 0; return { dates: p.days.map(g => iso(d += g)), close: p.close }; });
  const series = id => trend().then(t => { const s = t.series.find(x => x.id === id); if (!s) throw new Error('no series ' + id); return prices(s.file).then(p => ({ ...p, label: s.label })); });
  const ret = (close, back) => close.length > back ? (close[close.length - 1] / close[close.length - 1 - back] - 1) * 100 : null;
  const ytd = p => { const y = p.dates[p.dates.length - 1].slice(0, 4); let i = p.dates.length - 1; while (i >= 0 && p.dates[i].slice(0, 4) === y) i--; return i < 0 ? null : (p.close[p.close.length - 1] / p.close[i] - 1) * 100; };
  const fail = (el, what) => { if (el) el.innerHTML = `<p class="wait">${esc(what || 'This did not load. Refresh to try again.')}</p>`; };

  const redraws = [];
  const onRedraw = f => redraws.push(f);
  const redraw = () => redraws.forEach(f => f());
  addEventListener('ml:themechange', redraw);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 100); });

  // left section list: highlight the section in view
  function spy() {
    const links = [...document.querySelectorAll('.side > a[href^="#"]')], targets = links.map(a => document.querySelector(a.getAttribute('href')));
    const line = () => parseFloat(css('--ml-header')) + 80;
    const run = () => {
      let on = 0; const at = line(); targets.forEach((t, i) => { if (t && !t.hidden && t.getBoundingClientRect().top < at) on = i; });
      if (innerHeight + scrollY >= root.scrollHeight - 4) on = links.length - 1;
      links.forEach((a, i) => a.classList.toggle('on', i === on));
    };
    addEventListener('scroll', run, { passive: true }); run(); return run;
  }

  // remembered text-button group
  function pick(el, items, key, def, cb) {
    let cur = def;
    try { const s = localStorage.getItem(key); if (items.some(x => x[0] === s)) cur = s; } catch (_) {}
    el.insertAdjacentHTML('afterbegin', items.map(([k, label]) => `<button type="button" data-k="${k}">${label || k}</button>`).join(''));
    const paint = () => [...el.querySelectorAll('button[data-k]')].forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cur));
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-k]'); if (!b) return;
      cur = b.dataset.k; try { localStorage.setItem(key, cur); } catch (_) {}
      paint(); cb(cur);
    });
    paint();
    return () => cur;
  }

  // search box: form holds an input and an empty list. Companies by default, same matching as the one in the top bar.
  // o.items = () => [{id, name, key}] searches another list; o.all opens the whole list before anything is typed.
  function finder(form, onPick, o = {}) {
    const input = form.querySelector('input'), ul = form.querySelector('ul'); let names = null, shown = [], act = 0;
    const close = () => { ul.hidden = true; };
    const go = id => { input.value = ''; close(); input.blur(); onPick(id); };
    const ready = () => o.items ? Promise.resolve(names = o.items()) : names ? Promise.resolve() : trend().then(T => { names = T.series.filter(x => x.kind === 'equity' || x.kind === 'asset').map(x => { const c = x.label.indexOf(' · ');
      return { id: x.id, name: c < 0 ? '' : x.label.slice(c + 3), key: (x.label + ' ' + (x.aliases || []).join(' ')).toLowerCase() }; }); }).catch(() => { names = []; });
    const mark = () => [...ul.children].forEach((li, i) => i === act ? li.setAttribute('aria-selected', 'true') : li.removeAttribute('aria-selected'));
    const max = o.all ? 400 : 8;
    const paint = () => { const q = input.value.trim().toLowerCase(); if (!q && !o.all) return close();
      const rank = n => !q ? 0 : n.id.toLowerCase() === q ? 0 : n.id.toLowerCase().startsWith(q) ? 1 : n.name.toLowerCase().startsWith(q) ? 2 : n.key.includes(q) ? 3 : 9;
      shown = names.map(n => [rank(n), n]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (q && !o.items ? a[1].id.length - b[1].id.length || a[1].id.localeCompare(b[1].id) : 0)).slice(0, max).map(x => x[1]);
      if (!shown.length) return close(); act = 0;
      ul.innerHTML = shown.map((n, i) => `<li data-i="${i}">${o.items ? `<b>${esc(n.b || n.name)}</b><span>${esc(n.note || '')}</span>${n.kind ? `<small>${esc(n.kind)}</small>` : ''}` : `<b>${esc(n.id)}</b><span>${esc(n.name)}</span>`}</li>`).join(''); mark(); ul.hidden = false; };
    input.addEventListener('focus', () => ready().then(paint)); input.addEventListener('input', () => ready().then(paint));
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => { if (ul.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; mark(); ul.children[act].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Escape') { close(); o.onClose && o.onClose(); } });
    if (o.onClose) input.addEventListener('blur', () => setTimeout(o.onClose, 130));
    ul.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); go(shown[+li.dataset.i].id); } });
    form.addEventListener('submit', e => { e.preventDefault(); const typed = input.value.trim(); if (!typed) return;
      ready().then(() => { paint(); if (!ul.hidden && shown[act]) go(shown[act].id); else if (!o.items) go(typed.toUpperCase()); }); });
  }

  const setTone = v => { const col = `var(--${v < 0 ? 'down' : 'up'})`; root.style.setProperty('--tone', col); root.style.setProperty('--tint', `color-mix(in srgb, ${col} 12%, transparent)`); return css(v < 0 ? '--down' : '--up'); };

  // bare line chart. o = {lines:[{v, col, w}], dash, min, max, foot, label, onHover}; lines[0] is the main line.
  function chart(el, o) {
    const W = el.clientWidth, H = el.clientHeight, pad = 10;
    const all = o.lines.flatMap(l => l.v).filter(v => v != null);
    if (!W || !all.length) return;
    const lo = o.min ?? Math.min(...all), hi = o.max ?? Math.max(...all), n = Math.max(1, o.lines[0].v.length - 1);
    const x = i => i / n * W, y = v => pad + (hi - v) / (hi - lo || 1) * (H - pad * 2 - (o.foot || 0));
    const path = v => { let d = '', pen = false; v.forEach((p, i) => { if (p == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p).toFixed(1); pen = true; }); return d; };
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(o.label || '')}">
      ${o.dash == null ? '' : `<line x1="0" x2="${W}" y1="${y(o.dash)}" y2="${y(o.dash)}" stroke="${css('--faint')}" stroke-width="1" stroke-dasharray="1 6" stroke-linecap="round"/>`}
      ${o.lines.slice().reverse().map(l => `<path d="${path(l.v)}" fill="none" stroke="${l.col}" stroke-width="${l.w || 2}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}${l.op ? ` stroke-opacity="${l.op}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
      <g class="hair" style="opacity:0"><line y1="0" y2="${H}" stroke="${css('--border')}" stroke-width="1"/><circle r="5" fill="${o.lines[0].col}" stroke="${css('--bg')}" stroke-width="2"/></g></svg>`;
    el._g = { x, y, n, o };
    if (el._on) return; el._on = true;
    el.addEventListener('pointermove', e => {
      const g = el._g, r = el.getBoundingClientRect(), i = Math.max(0, Math.min(g.n, Math.round((e.clientX - r.left) / r.width * g.n)));
      const v = g.o.lines[0].v[i]; if (v == null) return;
      const h = el.querySelector('.hair'); h.style.opacity = 1;
      h.firstChild.setAttribute('x1', g.x(i)); h.firstChild.setAttribute('x2', g.x(i));
      h.lastChild.setAttribute('cx', g.x(i)); h.lastChild.setAttribute('cy', g.y(v));
      g.o.onHover && g.o.onHover(i);
    });
    el.addEventListener('pointerleave', () => { const h = el.querySelector('.hair'); if (h) h.style.opacity = 0; el._g.o.onHover && el._g.o.onHover(null); });
  }

  // click a column header to sort a table body. def = {k, dir, cols:{key: row => value}, key: storage key}
  // One dot per earnings call: how the stock did the next day against the S&P 500. Guidance wording from the call, when any was found, sits under the quarter.
  const guide = c => { const g = c.lens && c.lens.guidance && c.lens.guidance[4]; if (!g) return '';
    return g.raise > g.cut ? 'Raised' : g.cut > g.raise ? 'Cut' : g.raise && g.cut ? 'Mixed' : g.reaffirm ? 'Held' : ''; };
  const SAID = { raised: 'Raised', cut: 'Cut', held: 'Held', mixed: 'Mixed', up: 'Guided up', down: 'Guided down' };   // up/down: the new quarter's guide against the one before
  function reaction(el, calls, said) {
    const C = (calls || []).filter(c => c.move && c.move.r1 != null).slice(-8), W = el.clientWidth, H = el.clientHeight, N = C.length;
    if (!W || !N) { el.innerHTML = N ? '' : '<p class="wait">No call has a next-day price move yet.</p>'; return; }
    const V = C.map(c => c.move.r1 * 100), ext = Math.max(2, ...V.map(Math.abs)), top = 98, bot = H - 88;
    const y = v => top + (ext - v) / (2 * ext) * (bot - top), x = k => (k + .5) * W / N, ink = css('--ink'), bg = css('--bg'), mut = css('--muted');
    const tips = [];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stock move the day after each earnings call"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="${css('--faint')}" stroke-width="1" stroke-dasharray="1 6" stroke-linecap="round"/>` + C.map((c, k) => {
      const v = V[k], [fq, fy] = c.id.split(' ').reverse(), s = said && said[c.id.split(' ').slice(-2).join(' ')], g = s ? SAID[s.g] || '' : guide(c), col = css(v < 0 ? '--down' : '--up'), below = v < 0;
      const T = [`${pct(c.move.r1 * 100, 1)} next day`, c.move.r5 != null && `${pct(c.move.r5 * 100, 1)} after 5 days`, s && s.beat && `Results ${s.beat} their forecast`, g && (g.startsWith('Guided') ? g : `Guidance ${g.toLowerCase()}`) + (s && s.amt ? ' ' + s.amt : '')].filter(Boolean);
      const h = T.length * 20 + 12, w = Math.max(...T.map(t => t.replace('&amp;', '&').length)) * 7.6 + 26, cx = Math.max(w / 2, Math.min(W - w / 2, x(k))), ty = Math.max(2, Math.min(y(v), y(0)) - 36 - h);
      tips.push(`<g class="yoy" data-k="${k}"><rect x="${cx - w / 2}" y="${ty}" width="${w}" height="${h}" rx="8" fill="${ink}"/>${T.map((t, j) => `<text x="${cx}" y="${ty + 22 + j * 20}" text-anchor="middle" font-size="14" font-weight="600" fill="${bg}" style="font-variant-numeric:tabular-nums">${t}</text>`).join('')}</g>`);
      return `<g class="col" data-k="${k}" tabindex="0"><rect x="${x(k) - W / N / 2}" y="0" width="${W / N}" height="${H}" fill="transparent"/>
        <line x1="${x(k)}" x2="${x(k)}" y1="${y(0)}" y2="${y(v)}" stroke="${col}" stroke-width="2" opacity=".28"/>
        <circle cx="${x(k)}" cy="${y(v)}" r="8" fill="${col}"/>
        <text x="${x(k)}" y="${below ? y(v) + 26 : y(v) - 16}" text-anchor="middle" font-size="14" font-weight="600" fill="${ink}" style="font-variant-numeric:tabular-nums">${pct(v, 1)}</text>
        <text x="${x(k)}" y="${H - 30}" text-anchor="middle" font-size="14" fill="${mut}">${esc(fq)} ${esc(fy)}</text>
        ${g ? `<text x="${x(k)}" y="${H - 10}" text-anchor="middle" font-size="13" font-weight="600" fill="${g === 'Cut' || g === 'Guided down' ? css('--down') : g === 'Raised' || g === 'Guided up' ? css('--up') : mut}">${g}</text>` : ''}</g>`; }).join('') + tips.join('') + '</svg>';
    if (!el._tips) { el._tips = 1; const tip = k => el.querySelectorAll('.yoy').forEach(g => g.classList.toggle('on', g.dataset.k === k)), at = e => { const c = e.target.closest && e.target.closest('.col'); tip(c ? c.dataset.k : null); };
      el.addEventListener('pointerover', at); el.addEventListener('focusin', at); el.addEventListener('pointerleave', () => tip(null)); el.addEventListener('focusout', () => tip(null)); }
  }

  function sortable(table, rows, render, def) {
    let st = { k: def.k, dir: def.dir || 1 };
    try { const s = JSON.parse(localStorage.getItem(def.key) || 'null'); if (s && def.cols[s.k]) st = { k: s.k, dir: s.dir < 0 ? -1 : 1 }; } catch (_) {}
    const paint = () => {
      const get = def.cols[st.k];
      const s = rows.slice().sort((a, b) => { const A = get(a), B = get(b); return (A == null) - (B == null) || (typeof A === 'string' ? A.localeCompare(B) : B - A) * st.dir; });
      table.tBodies[0].innerHTML = (def.limit ? s.slice(0, def.limit()) : s).map(render).join('');
      [...table.tHead.querySelectorAll('th')].forEach(th => th.dataset.k === st.k ? th.setAttribute('aria-sort', st.dir > 0 ? 'descending' : 'ascending') : th.removeAttribute('aria-sort'));
    };
    table.tHead.addEventListener('click', e => {
      const th = e.target.closest('th[data-k]'); if (!th) return;
      st = { k: th.dataset.k, dir: st.k === th.dataset.k ? -st.dir : 1 };
      if (def.key) try { localStorage.setItem(def.key, JSON.stringify(st)); } catch (_) {}
      paint();
    });
    paint(); return { paint, set: r => { rows = r; paint(); } };
  }

  return { $, css, pct, tone, num, usd, big, day, esc, cell, co, href, json, script, trend, prices, series, ret, ytd, fail, spy, pick, finder, chart, setTone, onRedraw, redraw, sortable, reaction };
})();
