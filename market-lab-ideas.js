/* Ideas: a log of dated trade ideas, a chart of how they did and one page per idea.
   Data: ideas/index.json (the log and tracking) and ideas/<id>.json (one idea, with its own chart data).
   Both are written by ops/ideas/new_idea.py. Ideas are never edited after they are posted. */
(() => {
  const { $, css, pct, num, esc, day, json, chart, spy, pick, onRedraw } = EQ;
  const STATUS = { open: 'Open', target: 'Hit target', stopped: 'Stopped out', expired: 'Time ran out' };
  const money = v => v == null ? '' : '$' + num(v, v >= 1000 ? 0 : 2);
  const mill = v => v == null ? '' : Math.abs(v) >= 1000 ? '$' + num(v / 1000, 2) + 'B' : '$' + num(v, v >= 100 ? 0 : 1) + 'M';
  const tc = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
  const sp = (v, d = 1) => `<span class="${tc(v)}">${pct(v, d)}</span>`;
  const row = (k, v, cls = '') => `<div class="row"><dt>${k}</dt><dd class="num ${cls}">${v}</dd></div>`;
  const read = (id, html) => { $(id).innerHTML = html || '&nbsp;'; };
  const shade = k => [`var(--accent)`, `color-mix(in srgb,var(--accent) 50%,var(--bg))`, `var(--faint)`, `color-mix(in srgb,var(--faint) 45%,var(--bg))`, `var(--muted)`][k % 5];
  const swatch = (col, label, bar) => `<span><i style="background:${col}${bar ? ';height:10px;width:10px;border-radius:2px' : ''}"></i>${esc(label)}</span>`;

  let index = null, idea = null, draws = [];
  onRedraw(() => draws.forEach(f => f()));

  // bars, plain or stacked, with negative values allowed. o = {labels, series:[{name, v, col}], stacked, fmt, read, every}
  // management points, grouped into hard numbers and tone when the idea tags them (older ideas do not)
  function said(list, note, tone) {
    const li = c => typeof c === 'string' ? `<li><p>${esc(c)}</p></li>`
      : `<li><p>${esc(c.point)}</p><span>${esc([c.speaker, c.call].filter(Boolean).join(', '))}</span></li>`;
    const groups = [['number', 'The numbers they gave'], ['tone', 'How they sounded']];
    const tagged = list.some(c => c && c.kind);
    $('dSaid').innerHTML = tagged
      ? groups.map(([k, t]) => { const xs = list.filter(c => c.kind === k);
          return xs.length ? `<h3 class="ix-h3">${t}</h3><ul class="ix-said">${xs.map(li).join('')}</ul>` : ''; }).join('')
      : `<ul class="ix-said">${list.map(li).join('')}</ul>`;
    $('dTone').hidden = !note; $('dTone').textContent = note || '';
    $('toneWrap').hidden = !tone.length;
    if (!tone.length) return;
    const n = v => v == null ? '–' : (+v).toFixed(0);
    const chg = (v, p) => p == null || v == null ? '' : ` <small>${v - p >= 0 ? '+' : '−'}${Math.abs(v - p).toFixed(0)}</small>`;
    const qa = tone.some(r => 'net_qa' in r);   // ideas logged before the Q&A split have no such column
    $('toneTable').innerHTML = '<thead><tr><th class="left">Call</th><th>Upbeat</th><th>Cautious</th><th>Hedging</th><th>Net</th>'
      + (qa ? '<th>Net in answers</th><th>Dodges</th>' : '') + '</tr></thead><tbody>'
      + tone.map((r, i) => { const p = tone[i - 1] || {};
          return `<tr><td class="left">${esc(r.call.replace(/^\S+\s/, ''))} <small>${day(r.date)}</small></td><td class="num">${n(r.upbeat)}</td><td class="num">${n(r.cautious)}</td><td class="num">${n(r.hedging)}</td><td class="num">${n(r.net)}${chg(r.net, p.net)}</td>`
            + (qa ? `<td class="num">${n(r.net_qa)}${chg(r.net_qa, p.net_qa)}</td><td class="num">${n(r.dodges)}</td>` : '') + '</tr>'; }).join('')
      + '</tbody>';
  }

  function bars(el, o, readId) {
    const W = el.clientWidth, H = el.clientHeight, foot = o.every === 0 ? 0 : 22, n = o.labels.length;
    if (!W || !n) return;
    const tops = o.labels.map((_, i) => o.stacked ? o.series.reduce((s, x) => s + Math.max(0, x.v[i] || 0), 0) : Math.max(0, ...o.series.map(x => x.v[i] || 0)));
    const lows = o.labels.map((_, i) => Math.min(0, ...o.series.map(x => x.v[i] || 0)));
    const hi = Math.max(...tops) || 1, lo = Math.min(...lows), y = v => 6 + (hi - v) / (hi - lo || 1) * (H - 12 - foot);
    const slot = W / n, gw = slot * .7, bw = o.stacked ? gw : gw / o.series.length;
    const every = o.every || Math.ceil(n / Math.max(1, Math.floor(W / 64)));
    let svg = '';
    o.labels.forEach((lab, i) => {
      const x0 = i * slot + (slot - gw) / 2; let base = 0;
      o.series.forEach((s, k) => {
        const v = s.v[i]; if (v == null) return;
        const a = o.stacked ? base : 0, b = o.stacked ? base + v : v; if (o.stacked) base += v;
        const x = o.stacked ? x0 : x0 + k * bw, top = y(Math.max(a, b)), h = Math.max(1, Math.abs(y(a) - y(b)));
        svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(1, bw - (o.stacked ? 0 : 2)).toFixed(1)}" height="${h.toFixed(1)}" rx="2" style="fill:${s.col}"/>`;
      });
      if (foot && i % every === (n - 1) % every) svg += `<text x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="12" style="fill:var(--faint)">${esc(lab)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || '')}">${lo < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--border)"/>` : ''}${svg}<rect class="ix-hov" x="0" y="0" width="${slot}" height="${H - foot}" style="fill:var(--ink);opacity:0"/></svg>`;
    const hov = el.querySelector('.ix-hov'), say = i => readId && read(readId, i == null ? o.rest : o.say(i));
    el.onpointermove = e => { const r = el.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))); hov.setAttribute('x', i * slot); hov.style.opacity = .05; say(i); };
    el.onpointerleave = () => { hov.style.opacity = 0; say(null); };
    say(null);
  }

  // a line chart from EQ.chart plus extra horizontal marks drawn under the lines. marks: [{v, col, dash, label}], band: [lo, hi]
  function marked(el, o, marks = [], band) {
    chart(el, o);
    const g = el._g, svg = el.querySelector('svg'); if (!g || !svg) return;
    const W = el.clientWidth;
    let extra = band ? `<rect x="0" width="${W}" y="${g.y(band[1])}" height="${Math.max(1, g.y(band[0]) - g.y(band[1]))}" style="fill:var(--raised)"/>` : '';
    marks.forEach(m => { const yy = g.y(m.v);
      extra += `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke-width="1.5" stroke-dasharray="${m.dash || '4 5'}" style="stroke:${m.col}"/>`;
      if (m.label) extra += `<text x="${W - 4}" y="${yy - 6}" text-anchor="end" font-size="12" font-weight="600" style="fill:${m.col}">${esc(m.label)}</text>`; });
    svg.insertAdjacentHTML('afterbegin', extra);
  }

  // ---------------------------------------------------------------- list view
  const isOpen = i => !i.perf || i.perf.status === 'open';
  const lineCol = i => { const r = i.perf && i.perf.ret; return r > 0 ? 'var(--up)' : r < 0 ? 'var(--down)' : 'var(--muted)'; };

  function list() {
    $('detail').hidden = true; $('list').hidden = false; $('gone').hidden = true; idea = null;
    document.title = 'Ideas · Equinox'; sideSync();
    const I = index.ideas || [];
    $('scoreStamp').textContent = index.updated ? 'Updated ' + day(index.updated) : '';
    const closed = I.filter(i => !isOpen(i)), wins = closed.filter(i => i.perf.ret > 0);
    const avg = k => { const v = I.map(i => i.perf && i.perf[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    $('retSum').innerHTML = !I.length ? 'No ideas yet.'
      : `${I.length} ${I.length === 1 ? 'idea' : 'ideas'} logged, ${I.length - closed.length} open${closed.length ? `, ${closed.length} closed and ${wins.length} of those with a gain` : ''}. `
        + `Average return ${sp(avg('ret'))}, which is ${sp(avg('vs_spy'))} against the S&amp;P 500 and ${sp(avg('vs_qqq'))} against the Nasdaq 100 (QQQ) over the same days.`;
    const newest = I.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const col = (side, label) => { const L = newest.filter(i => (i.side === 'short') === (side === 'short'));
      return `<div class="ix-col"><h3 class="ix-colh">${label} <small>${L.length}</small></h3>${L.length ? `<ol class="ix-cards">${L.map(card).join('')}</ol>` : `<p class="ix-none">None yet.</p>`}</div>`; };
    $('cards').innerHTML = I.length ? col('long', 'Longs') + col('short', 'Shorts') : '';
    draws = [returns];
    returns();
  }

  function card(i) {
    const p = i.perf || {}, open = isOpen(i);
    return `<li><a class="ix-card${open ? '' : ' shut'}" href="#${esc(i.id)}" data-id="${esc(i.id)}">
      <span class="ix-card-top"><time datetime="${i.date}">${day(i.date)}</time><span>${i.side === 'long' ? 'Long' : 'Short'} · ${STATUS[p.status] || 'Open'}</span></span>
      <span class="ix-card-co"><span><b>${esc(i.ticker)}</b><span>${esc(i.name)}</span></span><em class="num ${tc(p.ret)}">${pct(p.ret)}</em></span>
      <span class="ix-card-head">${esc(i.headline)}</span>
      <span class="ix-card-nums">
        <span><small>Posted</small>${money(i.price)}</span>
        <span><small>${open ? 'Now' : 'Exit'}</small>${money(p.price)}</span>
        <span><small>vs S&amp;P 500</small><span class="${tc(p.vs_spy)}">${pct(p.vs_spy)}</span></span>
        <span><small>vs QQQ</small><span class="${tc(p.vs_qqq)}">${p.vs_qqq != null ? pct(p.vs_qqq) : 'n/a'}</span></span>
      </span></a></li>`;
  }

  // every idea's return since its posted close, on one calendar of trading days. Each line starts on
  // the day its idea was posted; QQQ runs underneath from the first idea's posted close.
  function returns() {
    const el = $('retChart'), W = el.clientWidth, H = el.clientHeight;
    const I = (index.ideas || []).filter(i => i.perf && (i.perf.path || []).length);
    const Q = (index.bench && index.bench.QQQ) || [];
    if (!W || !H) return;
    if (!I.length) { el.innerHTML = ''; read('retRead', ''); return; }
    const dates = [...new Set(I.flatMap(i => i.perf.path.map(p => p[0])).concat(Q.map(p => p[0])))].sort(), at = new Map(dates.map((d, k) => [d, k]));
    const qAt = new Map(Q.map(p => [p[0], p[1]]));
    const vals = I.flatMap(i => i.perf.path.map(p => p[1])).concat(Q.map(p => p[1]), 0);
    let lo = Math.min(...vals), hi = Math.max(...vals); const room = Math.max(2, (hi - lo) * .12); lo -= room; hi += room;
    const R = 96, foot = 26, top = 8, n = Math.max(1, dates.length - 1);
    const x = k => k / n * (W - R), y = v => top + (hi - v) / (hi - lo) * (H - top - foot);
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find(s => (hi - lo) / s <= 5) || 200;
    let grid = '';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      grid += v === 0 ? `<line x1="0" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--border)" stroke-width="1"/>`
        : `<line x1="0" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>`;
      grid += `<text x="${W}" y="${y(v) + 4}" text-anchor="end" font-size="12" style="fill:var(--faint)">${pct(v, 0)}</text>`;
    }
    const every = Math.ceil(dates.length / Math.max(1, Math.floor((W - R) / 96)));
    dates.forEach((d, k) => { if ((dates.length - 1 - k) % every) return;
      const anchor = dates.length === 1 || k === 0 ? 'start' : k === dates.length - 1 ? 'end' : 'middle';
      grid += `<text x="${x(k)}" y="${H - 6}" text-anchor="${anchor}" font-size="12" style="fill:var(--faint)">${day(d, { month: 'short', day: 'numeric' })}</text>`; });
    // end labels, pushed apart so tickers never sit on top of each other
    const ends = I.map(i => { const p = i.perf.path, e = p[p.length - 1]; return { i, k: at.get(e[0]), v: e[1], ly: y(e[1]) }; });
    const qEnd = Q.length ? { i: null, k: at.get(Q[Q.length - 1][0]), v: Q[Q.length - 1][1], ly: y(Q[Q.length - 1][1]) } : null;
    if (qEnd) ends.push(qEnd);
    ends.sort((a, b) => a.ly - b.ly);
    ends.forEach((e, j) => { if (j && e.ly - ends[j - 1].ly < 15) e.ly = ends[j - 1].ly + 15; });
    const lines = I.map(i => { const col = lineCol(i), p = i.perf.path;
      const d = p.map((q, j) => (j ? 'L' : 'M') + x(at.get(q[0])).toFixed(1) + ' ' + y(q[1]).toFixed(1)).join('');
      const e = ends.find(z => z.i === i), s0 = p[0];
      return `<g class="ln${isOpen(i) ? '' : ' shut'}" data-id="${esc(i.id)}"><path d="${d}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style="stroke:${col}"/>
        <circle cx="${x(at.get(s0[0]))}" cy="${y(s0[1])}" r="3.5" stroke-width="1.5" style="fill:var(--bg);stroke:${col}"/>
        <circle cx="${x(e.k)}" cy="${y(e.v)}" r="3.5" style="fill:${col}"/>
        <text x="${x(e.k) + 9}" y="${e.ly + 4}" font-size="12" font-weight="600" style="fill:${col}">${esc(i.ticker)}</text></g>`; }).join('');
    const qLine = Q.length > 1 ? `<g class="bm"><path d="${Q.map((q, j) => (j ? 'L' : 'M') + x(at.get(q[0])).toFixed(1) + ' ' + y(q[1]).toFixed(1)).join('')}" fill="none" stroke-width="1.5" stroke-dasharray="5 4" stroke-linecap="round" style="stroke:var(--faint)"/>
        <text x="${x(qEnd.k) + 9}" y="${qEnd.ly + 4}" font-size="12" style="fill:var(--faint)">QQQ</text></g>` : '';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Return of each idea since the day it was posted, with the Nasdaq 100 fund QQQ for comparison">${grid}${qLine}${lines}<g class="hov" style="opacity:0"><line y1="${top}" y2="${H - foot}" style="stroke:var(--border)"/></g></svg>`;
    const svg = el.firstChild, hov = svg.querySelector('.hov');
    const say = k => {
      const on = I.map(i => [i, i.perf.path.find(q => q[0] === dates[k])]).filter(z => z[1]);
      const qv = qAt.get(dates[k]);
      read('retRead', `${day(dates[k])}: ` + on.map(([i, q]) => `${esc(i.ticker)} ${sp(q[1], 1)} <span class="ix-hint">(S&amp;P 500 ${pct(q[2], 1)}${q[3] != null ? `, QQQ ${pct(q[3], 1)}` : ''})</span>`).join(', ')
        + (qv != null ? `<span class="ix-hint">. QQQ since the first idea ${pct(qv, 1)}</span>` : ''));
      return on;
    };
    el.onpointermove = e => {
      const r = el.getBoundingClientRect(), k = Math.max(0, Math.min(dates.length - 1, Math.round((e.clientX - r.left) / (r.width - R) * n)));
      const on = say(k); hov.style.opacity = 1;
      hov.innerHTML = `<line x1="${x(k)}" x2="${x(k)}" y1="${top}" y2="${H - foot}" style="stroke:var(--border)"/>`
        + on.map(([i, q]) => `<circle cx="${x(k)}" cy="${y(q[1])}" r="4.5" stroke-width="2" style="fill:${lineCol(i)};stroke:var(--bg)"/>`).join('')
        + (qAt.has(dates[k]) ? `<circle cx="${x(k)}" cy="${y(qAt.get(dates[k]))}" r="3.5" stroke-width="2" style="fill:var(--faint);stroke:var(--bg)"/>` : '');
    };
    el.onpointerleave = () => { hov.style.opacity = 0; say(dates.length - 1); };
    say(dates.length - 1);
  }

  // pointing at a card brings its line forward
  const cards = $('cards'), focus = id => { const svg = $('retChart').querySelector('svg'); if (!svg) return;
    svg.classList.toggle('focus', !!id); svg.querySelectorAll('.ln').forEach(g => g.classList.toggle('on', g.dataset.id === id)); };
  cards.addEventListener('pointerover', e => { const a = e.target.closest('.ix-card'); focus(a && a.dataset.id); });
  cards.addEventListener('pointerleave', () => focus(null));
  cards.addEventListener('focusin', e => { const a = e.target.closest('.ix-card'); focus(a && a.dataset.id); });
  cards.addEventListener('focusout', () => focus(null));

  // ---------------------------------------------------------------- one idea
  async function show(id) {
    let d;
    try { d = await json(`ideas/${id}.json`); } catch (_) { return gone(`The idea ${id} did not load. Refresh to try again.`); }
    if (want() !== id) return;
    idea = d; draws = [];
    $('list').hidden = true; $('gone').hidden = true; $('detail').hidden = false;
    document.title = `${d.ticker} idea, ${day(d.date)} · Equinox`;
    const long = d.side === 'long', lv = d.levels, f = d.facts, T = f.technicals, P = d.price;
    const meta = (index.ideas || []).find(i => i.id === id) || {}, perf = meta.perf;

    $('dKicker').textContent = `${long ? 'Long' : 'Short'} idea · Logged ${day(d.date)} · ${[d.sector, d.industry].filter(Boolean).join(', ')}`;
    $('dName').innerHTML = `${esc(d.name)} <span class="ix-tk">${esc(d.ticker)}</span>`;
    $('dHead').textContent = d.headline;
    $('dThesis').textContent = d.thesis;
    $('dWrong').textContent = d.wrong_if;
    const rel = v => (v / P - 1) * 100, risk = Math.abs(P - lv.stop), reward = Math.abs(lv.target - P);
    const until = new Date(d.date + 'T12:00:00'); until.setDate(until.getDate() + (d.timeframe_days || 90));
    $('dSide').innerHTML = `<b class="${long ? 'up' : 'down'}">${long ? 'Long' : 'Short'}</b><span>${esc(d.timeframe)}</span>`;
    $('dLevels').innerHTML = row('Posted price', `${money(P)} <small>${day(d.price_date, { month: 'short', day: 'numeric' })} close</small>`)
      + row(long ? 'Buy zone' : 'Sell zone', `${money(lv.entry_lo)} to ${money(lv.entry_hi)}`)
      + row('Stop', `${money(lv.stop)} <small>${pct(rel(lv.stop))}</small>`, 'down')
      + row('Target', `${money(lv.target)} <small>${pct(rel(lv.target))}</small>`, 'up')
      + row('Reward for each dollar of risk', risk ? `$${num(reward / risk, 2)}` : '')
      + row('Time limit', day(until.toISOString()));
    $('dLevelNote').textContent = lv.note || '';
    $('dPerf').innerHTML = perf ? `Since it was posted: ${STATUS[perf.status].toLowerCase()}, ${perf.status === 'open' ? 'last' : 'exit'} ${money(perf.price)} on ${day(perf.date)}, ${sp(perf.ret)} on the idea against ${sp(perf.spy)} for the S&amp;P 500 over the same days. Best point ${sp(perf.best)}, worst ${sp(perf.worst)}.` : '';

    $('dBiz').textContent = d.business;
    $('dSeg').textContent = d.segments_note;
    $('dGrowth').textContent = d.growth_note;
    $('dTech').textContent = d.technical_note;
    $('dVal').textContent = d.valuation_note;
    said(d.commentary || [], d.tone_note, f.tone || []);
    $('dRisks').innerHTML = (d.risks || []).map(r => `<li>${esc(r)}</li>`).join('');
    $('dCats').innerHTML = (d.catalysts || []).map(r => `<li>${esc(r)}</li>`).join('');
    $('finStamp').textContent = f.financials.updated ? 'Updated ' + day(f.financials.updated) : '';
    $('techStamp').textContent = 'Updated ' + day(T.date);
    $('valStamp').textContent = 'Updated ' + day(T.date);

    techRows(T); guidance(f.guidance); kpis(f.kpis || []);
    draws = [levels, segs, results, tech, pe];
    sideSync(); scrollTo(0, 0);
    requestAnimationFrame(() => draws.forEach(fn => fn()));
  }

  function levels() {
    const d = idea, c = d.chart, lv = d.levels, el = $('lvChart'), n = Math.min(126, c.close.length), v = c.close.slice(-n), D = c.dates.slice(-n);
    const all = v.concat([lv.stop, lv.target, lv.entry_lo, lv.entry_hi]), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * .06;
    const up = css('--up'), dn = css('--down'), ink = css('--ink');
    const rest = `${day(D[n - 1])}: ${money(v[n - 1])}, the posted price`;
    marked(el, { lines: [{ v, col: ink, w: 2 }], min: lo - pad, max: hi + pad, label: `${d.ticker} price for six months with the idea's levels`,
      onHover: i => read('lvRead', i == null ? rest : `${day(D[i])}: ${money(v[i])}`) },
      [{ v: lv.target, col: up, label: `Target ${money(lv.target)}` }, { v: lv.stop, col: dn, label: `Stop ${money(lv.stop)}` }], [lv.entry_lo, lv.entry_hi]);
    read('lvRead', rest);
    $('lvKey').innerHTML = `<span><i style="background:${ink}"></i>Close, last six months</span><span><i style="background:var(--raised);height:10px"></i>${d.side === 'long' ? 'Buy' : 'Sell'} zone</span>`;
  }

  function segs() {
    const s = (idea.facts.segments || [])[0], el = $('segChart');
    if (!s) { $('growth').querySelector('.split').hidden = true; return; }
    const rows = s.rows.slice(0, 5), Q = s.quarters, L = Q.length - 1;
    $('segStamp').textContent = s.label ? `By ${s.label.toLowerCase()}` : '';
    const series = rows.map((r, k) => ({ name: r.name, v: r.values, col: shade(k) }));
    const say = i => `${Q[i]}: ` + rows.map(r => `${r.name} ${mill(r.values[i])}${r.yoy[i] != null ? ` (${pct(r.yoy[i], 0)})` : ''}`).join(', ');
    bars(el, { labels: Q, series, stacked: true, say, rest: say(L), label: 'Revenue by segment' }, 'segRead');
    $('segKey').innerHTML = series.map(x => swatch(x.col, x.name, 1)).join('');
    const tot = rows.reduce((a, r) => a + (r.values[L] || 0), 0);
    $('segTable').innerHTML = `<thead><tr><th>${esc(Q[L])}</th><th>Revenue</th><th>Share</th><th>vs a year ago</th></tr></thead><tbody>`
      + rows.map(r => `<tr><td>${esc(r.name)}</td><td class="num">${mill(r.values[L])}</td><td class="num soft">${tot ? Math.round(r.values[L] / tot * 100) + '%' : ''}</td><td class="num ${tc(r.yoy[L])}">${pct(r.yoy[L])}</td></tr>`).join('') + '</tbody>';
  }

  function results() {
    const q = idea.facts.financials.quarters, Q = q.map(x => x.q), L = q.length - 1;
    const revSay = i => `${Q[i]}: ${mill(q[i].rev)}${q[i].rev_yoy != null ? `, ${pct(q[i].rev_yoy)} from a year ago` : ''}`;
    bars($('revChart'), { labels: Q, series: [{ name: 'Revenue', v: q.map(x => x.rev), col: shade(0) }], say: revSay, rest: revSay(L), label: 'Quarterly revenue' }, 'revRead');
    const M = [['gm', 'Gross', css('--faint')], ['om', 'Operating', css('--accent')], ['nm', 'Net', css('--ink')]];
    const mSay = i => `${Q[i]}: ` + M.map(([k, n]) => `${n} ${q[i][k] == null ? 'n/a' : num(q[i][k], 1) + '%'}`).join(', ');
    chart($('mgnChart'), { lines: [M[1], M[0], M[2]].map(([k, , col]) => ({ v: q.map(x => x[k]), col, w: 2 })), label: 'Margins',
      onHover: i => read('mgnRead', mSay(i == null ? L : i)) });
    read('mgnRead', mSay(L));
    $('mgnKey').innerHTML = M.map(([, n, col]) => swatch(col, n)).join('');
    const adj = q.some(x => x.adj_eps != null);
    const ser = [{ name: 'Reported', v: q.map(x => x.eps), col: shade(adj ? 2 : 0) }].concat(adj ? [{ name: idea.facts.financials.adj_eps_name || 'Adjusted', v: q.map(x => x.adj_eps), col: shade(0) }] : []);
    const eSay = i => `${Q[i]}: ` + ser.map(s => `${s.name} ${s.v[i] == null ? 'n/a' : '$' + num(s.v[i], 2)}`).join(', ') + (q[i].eps_yoy != null && Math.abs(q[i].eps_yoy) < 500 ? `, ${pct(q[i].eps_yoy, 0)} from a year ago` : '');
    bars($('epsChart'), { labels: Q, series: ser, say: eSay, rest: eSay(L), label: 'Earnings per share' }, 'epsRead');
    $('epsKey').innerHTML = ser.length > 1 ? ser.map(s => swatch(s.col, s.name, 1)).join('') : swatch(ser[0].col, 'Reported, per diluted share', 1);
  }

  let span = '1y';
  function tech() {
    const c = idea.chart, N = c.close.length, n = Math.min(N, { '6m': 126, '1y': 252, '2y': 504 }[span]), cut = a => a.slice(-n), D = cut(c.dates);
    const ink = css('--ink'), acc = css('--accent'), fnt = css('--faint');
    const px = cut(c.close), s50 = cut(c.sma50), s200 = cut(c.sma200);
    const pSay = i => `${day(D[i])}: close ${money(px[i])}, 50-day ${money(s50[i])}, 200-day ${money(s200[i])}`;
    chart($('pxChart'), { lines: [{ v: px, col: ink, w: 2 }, { v: s50, col: acc, w: 1.5 }, { v: s200, col: fnt, w: 1.5, dash: '5 4' }], label: 'Price with 50 and 200-day averages', onHover: i => read('pxRead', pSay(i == null ? n - 1 : i)) });
    read('pxRead', pSay(n - 1));
    $('pxKey').innerHTML = swatch(ink, 'Close') + swatch(acc, '50-day average') + swatch(fnt, '200-day average') + '<span class="ranges ix-span" id="spanPick" style="--tint:var(--raised);--tone:var(--ink)"></span>';
    pick($('spanPick'), [['6m', '6M'], ['1y', '1Y'], ['2y', '2Y']], 'market-lab.ideas.span', span, k => { span = k; tech(); });
    const vol = cut(c.volume), up = cut(c.close).map((x, i, a) => i && x < a[i - 1] ? 1 : 0);
    const vSay = i => `${day(D[i])}: ${num(vol[i] / 1e6, 1)} million shares`;
    bars($('volChart'), { labels: D, series: [{ name: 'Up day', v: vol.map((x, i) => up[i] ? null : x), col: `color-mix(in srgb,var(--up) 55%,var(--bg))` }, { name: 'Down day', v: vol.map((x, i) => up[i] ? x : null), col: `color-mix(in srgb,var(--down) 55%,var(--bg))` }], stacked: true, every: 0, say: vSay, rest: pSay(n - 1), label: 'Daily volume' }, 'pxRead');
    read('pxRead', pSay(n - 1));
    // relative strength: both lines set to 100 at the start of the window
    const norm = a => { const b = a.find(x => x != null); return a.map(x => x == null || !b ? null : x / b * 100); };
    const rs = norm(cut(c.rs_spy)), rk = norm(cut(c.rs_sector)), et = idea.facts.technicals.sector_etf;
    const rSay = i => `${day(D[i])}: vs S&P 500 ${pct(rs[i] - 100)}` + (et ? `, vs ${et} ${pct(rk[i] - 100)}` : '');
    chart($('rsChart'), { lines: [{ v: rs, col: acc, w: 2 }].concat(et ? [{ v: rk, col: fnt, w: 1.5 }] : []), dash: 100, label: 'Relative strength', onHover: i => read('rsRead', rSay(i == null ? n - 1 : i)) });
    read('rsRead', rSay(n - 1));
    $('rsKey').innerHTML = swatch(acc, `${idea.ticker} vs S&P 500`) + (et ? swatch(fnt, `${idea.ticker} vs ${et}, its sector fund`) : '') + '<span class="ix-hint">Rising means beating it</span>';
    const r = cut(c.rsi), iSay = i => `${day(D[i])}: RSI ${num(r[i], 0)}`;
    marked($('rsiChart'), { lines: [{ v: r, col: ink, w: 1.5 }], min: 0, max: 100, label: 'RSI', onHover: i => read('rsiRead', iSay(i == null ? n - 1 : i)) },
      [{ v: 70, col: css('--down'), label: '70, stretched' }, { v: 30, col: css('--up'), label: '30, washed out' }]);
    read('rsiRead', iSay(n - 1));
  }

  function techRows(T) {
    const from = (a, b) => b ? pct((a / b - 1) * 100) : '', et = T.sector_etf, rs = T.rs || {};
    $('techRows').innerHTML = [
      row('Close', money(T.close)), row('From the 52-week high', `${pct(T.from_high_pct)} <small>high ${money(T.high52)}</small>`),
      row('50-day average', `${money(T.sma50)} <small>${from(T.close, T.sma50)}</small>`), row('200-day average', `${money(T.sma200)} <small>${from(T.close, T.sma200)}</small>`),
      row('RSI, 14 days', num(T.rsi14, 0)), row('Average daily range', `${money(T.atr14)} <small>${num(T.atr14 / T.close * 100, 1)}% of price</small>`),
      row('Return, 3 and 12 months', `${sp(T.ret['3m'])} · ${sp(T.ret['12m'])}`), row('Return, 1 and 6 months', `${sp(T.ret['1m'])} · ${sp(T.ret['6m'])}`),
      row('vs S&amp;P 500, 3 and 12 months', rs.SPY ? `${sp(rs.SPY['3m'])} · ${sp(rs.SPY['12m'])}` : ''), row(`vs ${esc(et || 'sector')}, 3 and 12 months`, et && rs[et] ? `${sp(rs[et]['3m'])} · ${sp(rs[et]['12m'])}` : ''),
      row('Volume vs normal', `${num(T.vol_vs_50d, 2)}x <small>last 20 days vs 50</small>`), row('Traded a day', `$${num(T.dollar_vol_50d_m, 0)} million`)
    ].join('');
  }

  function pe() {
    const V = idea.facts.valuation, el = $('peChart');
    if (!V || !V.values || !V.values.length) { $('valuation').querySelector('.chart').hidden = true; return; }
    const v = V.values, D = V.dates, n = v.length, cap = Math.max(V.p80 * 1.6, V.now * 1.2), vv = v.map(x => Math.min(x, cap));
    const say = i => `${day(D[i])}: ${num(v[i], 1)} times trailing earnings`;
    marked(el, { lines: [{ v: vv, col: css('--accent'), w: 2 }], min: Math.max(0, Math.min(...vv) * .9), max: cap, dash: V.median, label: 'Trailing P/E history', onHover: i => read('peRead', say(i == null ? n - 1 : i)) }, [], [V.p20, V.p80]);
    read('peRead', say(n - 1));
    $('peKey').innerHTML = swatch(css('--accent'), 'Trailing P/E, weekly') + `<span><i style="background:var(--raised);height:10px"></i>Middle 60% of its history</span><span><i class="ref"></i>Median ${num(V.median, 1)}</span>` + (Math.max(...v) > cap ? '<span class="ix-hint">Peaks above the chart are cut off</span>' : '');
    $('peRows').innerHTML = row('P/E now', num(V.now, 1)) + row('Median since ' + day(V.since, { year: 'numeric' }), num(V.median, 1))
      + row('Typical range', `${num(V.p20, 1)} to ${num(V.p80, 1)}`) + row('Lowest and highest', `${num(V.low, 1)} to ${num(V.high, 1)}`)
      + row('Earnings, last 12 months', `$${num(V.ttm_eps, 2)} a share`) + row('Based on', esc(V.basis || ''));
  }

  function guidance(G) {
    const C = (G && G.calls) || [], t = (G && G.totals) || {};
    $('guidance').hidden = !C.length;
    if (!C.length) return;
    $('guideStamp').textContent = 'Last ' + C.length + ' calls';
    $('guideSum').textContent = t.calls ? `Across the ${t.calls} calls on file, the company raised a forecast ${t.raises || 0} times and cut one ${t.cuts || 0} times.` + (t.quarters ? ` Of ${t.quarters} quarters with a forecast to check, results came in above it ${t.beats || 0} times, below it ${t.misses || 0} times and inside the range ${t.inline || 0} times.` : '') : '';
    const unit = (v, u) => v == null ? '' : u === '%' ? num(v, v % 1 ? 1 : 0) + '%' : u === '$M' ? mill(v) : u === '$B' ? '$' + num(v, 1) + 'B' : u === '$' ? '$' + num(v, 2) : num(v, v % 1 ? 2 : 0) + (u ? ' ' + u : '');
    const rng = (lo, hi, u) => lo == null && hi == null ? '' : lo === hi || hi == null ? unit(lo, u) : lo == null ? unit(hi, u) : `${unit(lo, u)} to ${unit(hi, u)}`;
    const word = { raised: 'Raised', cut: 'Cut', new: 'New', held: 'Held', reaffirmed: 'Held', lowered: 'Cut', narrowed: 'Narrowed', widened: 'Widened' };
    $('guideCalls').innerHTML = C.slice().reverse().map(c => `<h3 class="ix-h3">${esc(c.call)} call, ${day(c.date)}</h3>
      <table class="ix-tight ix-guide"><thead><tr><th>Forecast</th><th>Period</th><th>Range</th><th class="left">Change</th></tr></thead><tbody>${c.guides.map(g => {
        const ch = String(g.change || ''), cls = /raise/.test(ch) ? 'up' : /cut|lower/.test(ch) ? 'down' : 'soft';
        return `<tr><td>${esc(g.metric)}</td><td class="soft">${esc(g.period || '')}</td><td class="num">${rng(g.lo, g.hi, g.unit)}</td><td class="left ${cls}">${word[ch] || esc(ch)}${g.prev ? ` <small>from ${rng(g.prev[0], g.prev[1], g.unit)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table>`).join('');
  }

  function kpis(K) {
    $('kpis').hidden = !K.length;
    if (!K.length) return;
    $('kpiGrid').innerHTML = K.map((k, j) => { const v = k.values || [], L = v.length - 1;
      return `<div class="ix-kpi"><h3 class="ix-h3">${esc(k.name || k.metric)}</h3><div class="ix-kv num">${unitK(v[L], k.unit)}</div><p class="ix-small">${esc((k.periods || [])[L] || '')}${v.length > 4 && v[L - 4] ? ` · ${pct((v[L] / v[L - 4] - 1) * 100)} vs four periods earlier` : ''}</p><div class="ix-bars ix-tiny" id="kpi${j}"></div></div>`; }).join('');
    draws.push(() => K.forEach((k, j) => { const say = i => `${(k.periods || [])[i] || ''}: ${unitK(k.values[i], k.unit)}`;
      bars($('kpi' + j), { labels: k.periods || k.values.map(() => ''), series: [{ v: k.values, col: shade(0) }], every: 0, say, rest: '' }); }));
  }
  const unitK = (v, u) => v == null ? '' : /%/.test(u || '') ? num(v, 1) + '%' : /\$|usd/i.test(u || '') ? '$' + num(v, Math.abs(v) < 100 ? 2 : 0) + (/m/i.test(u) ? 'M' : /b/i.test(u) ? 'B' : '') : num(v, Math.abs(v) < 100 ? 1 : 0) + (u ? ' ' + esc(u) : '');

  // ---------------------------------------------------------------- routing and the left menu
  const side = document.querySelector('nav.side'), watch = spy();
  const sideSync = () => { side.hidden = $('detail').hidden; [...side.children].forEach(a => { const t = $(a.getAttribute('href').slice(1)); a.hidden = !t || t.hidden; }); watch(); };
  side.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault();
    const t = $(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const want = () => decodeURIComponent(location.hash.slice(1));
  function gone(msg) { $('list').hidden = true; $('detail').hidden = true; $('gone').hidden = false; $('gone').innerHTML = `${esc(msg)} <a class="link" href="#">See all ideas</a>`; sideSync(); }
  async function route() {
    if (!index) { try { index = await json('ideas/index.json'); } catch (_) { index = { ideas: [] }; } }
    const id = want();
    if (!id) return list();
    if (idea && idea.id === id) return;
    if ((index.ideas || []).some(i => i.id === id) || /^\d{4}-\d\d-\d\d-[A-Z0-9.\-]+$/.test(id)) return show(id);
    if ($(id) && !$('detail').hidden) return;   // a section anchor typed by hand
    gone(`There is no idea called ${id}.`);
  }
  addEventListener('hashchange', route);
  route();
})();
