/* Guidance for one company (#NVDA, or the last company viewed): the numbers management guided to on
   each call, what they were before, and how each reported quarter landed against the number guided for it.
   Data: guidance/<TICKER>.json, written by ops/build_guidance.py. Every figure carries a source link
   (the call it was said on, or the earnings release). The header counts and the two small timelines
   come from the same rows the tables show. */
(() => {
  const { $, day, esc, json, trend, finder } = EQ;
  const LAST = 'equinox.company.last.v1';
  let run = 0;
  const want = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
    if (!h) try { h = localStorage.getItem(LAST) || ''; } catch (_) {} return h; };

  const trim = (v, d) => v.toFixed(d).replace(/\.?0+$/, '') || '0';
  // one number in its unit: $ per share, $M company totals, %
  const one = (v, u) => u === '%' ? trim(v, 2) + '%' : u === '$' ? '$' + v.toFixed(2) : Math.abs(v) >= 1000 ? '$' + trim(v / 1000, 2) + 'B' : '$' + trim(v, 1) + 'M';
  const span = (lo, hi, u) => lo === hi ? one(lo, u) : `${one(lo, u)} to ${one(hi, u)}`;
  const mid = a => (a[0] + a[1]) / 2;
  // a range management gave in words ("mid single digits") shows the words, then the usual reading of them
  const said = g => !g.w ? span(g.lo, g.hi, g.u) : (() => { const w = (g.hi < 0 ? 'down ' : '') + g.w.replace(/-/g, ' ').replace(/\bdigit\b/, 'digits');
    return `${esc(w[0].toUpperCase() + w.slice(1))} <span class="read">${span(g.lo, g.hi, g.u)}</span>`; })();
  const signed = (v, u) => (v > 0 ? '+' : '−') + (u === '%' ? trim(Math.abs(v), 2) + ' pts' : one(Math.abs(v), u));
  const per = p => !p ? '' : p.startsWith('FY') ? 'Fiscal ' + p.slice(2).replace('-FY', ' to ') : p.replace(/^Q(\d) (\d+)$/, 'Q$1 fiscal $2').replace(/^H([12]) (\d+)$/, (_, h, y) => (h === '1' ? 'First' : 'Second') + ' half fiscal ' + y);
  const WORD = { raised: 'Raised', cut: 'Cut', held: 'Unchanged', new: 'New' };
  // a quarter guided for the first time is set beside the guide for the quarter before it
  const STEP = { up: 'Guided up', down: 'Guided down', flat: 'Guided flat' };
  // a company that guides only the next quarter (no full-year revenue or earnings guide in at least one call in five)
  // gives new guidance each call, so a quarter set above the last one is new guidance, not a raise
  let QONLY = false;
  const quarterOnly = G => { const C = Object.values(G.calls).filter(c => c.guides.length);
    return !!C.length && C.filter(c => c.guides.some(g => !/^Q/.test(g.p) && rank(g.m) !== 1 && rank(g.m) <= 2)).length < C.length / 5; };
  const stepped = g => g.act === 'new' && g.step && !QONLY;
  const verb = g => stepped(g) ? STEP[g.step] : WORD[g.act];
  const tone = g => g.act === 'raised' || (stepped(g) && g.step === 'up') ? 'up' : g.act === 'cut' || (stepped(g) && g.step === 'down') ? 'down' : 'soft';
  const was = g => g.prev || (g.act === 'new' && g.seq) || null;

  // rows in each call: revenue, then margins, then earnings, then segments, then everything else
  const OTHER = /headwind|tailwind|contribution|accretion|impact|uplift|synerg|cost|as a share of|^capital|^cumulative|^r&d/i;
  const rank = m => OTHER.test(m) ? 4
    : /^(?:revenue|net sales|sales|organic|price realization|net interest income|non-interest income)\b/i.test(m) ? 0
    : /^(?:adjusted |core )?(?:gross|operating|segment|adjusted segment|ebitda|adjusted ebitda|incremental|free cash flow)(?: \w+)? margin\b/i.test(m) ? 1
    : /^(?:adjusted |long-term |core )?(?:eps|earnings|net income|operating income|operating profit|adjusted operating profit|ebitda|adjusted ebitda|ffo)\b/i.test(m) ? 2
    : /revenue|sales|margin|ebitda|profit|organic/i.test(m) ? 3 : 4;
  const FIRST = ['Revenue', 'Revenue growth', 'Net interest income', 'Net interest income growth', 'Non-interest income', 'Non-interest income growth', 'Organic growth', 'Gross margin', 'Operating margin', 'Segment margin', 'Adjusted EBITDA margin',
    'Adjusted EPS', 'EPS', 'Adjusted EPS growth', 'EPS growth', 'Adjusted EBITDA', 'EBITDA', 'Operating income', 'Net income', 'FFO'];
  const sub = m => { const i = FIRST.indexOf(m); return i < 0 ? 99 : i; };
  const when = p => { let x; return (x = /^Q(\d) (\d{4})/.exec(p)) ? +x[2] * 10 + +x[1] : (x = /^H(\d) (\d{4})/.exec(p)) ? +x[2] * 10 + 5 + +x[1] : (x = /^FY(\d{4})/.exec(p)) ? +x[1] * 10 + 8 : 1e6; };
  const order = (a, b) => rank(a.m) - rank(b.m) || sub(a.m) - sub(b.m) || a.m.localeCompare(b.m) || when(a.p) - when(b.p);
  const HOW = { above: 'Above', below: 'Below', 'high end': 'High end', 'low end': 'Low end', 'in line': 'In line' };

  function change(g) {
    const o = was(g);
    if (!o || g.act === 'held' || (g.act === 'new' && (!g.step || g.step === 'flat'))) return '<td></td>';
    // against the quarter before, for a company that guides one quarter at a time: shown, but not as a raise or cut
    const cls = g.act === 'new' && QONLY ? 'soft' : null;
    const d = mid([g.lo, g.hi]) - mid(o), base = mid(o);
    const rel = g.u !== '%' && base ? ` (${d > 0 ? '+' : '−'}${trim(Math.abs(d / base) * 100, 1)}%)` : '';
    return `<td class="num ${cls || (d > 0 ? 'up' : 'down')}">${signed(d, g.u)}${rel}</td>`;
  }
  let NAMES = {};   // calls the company names its own way (FedEx's first calendar quarters after its fiscal-year change)
  const label = k => { if (NAMES[k]) return NAMES[k]; const [fy, fq] = k.split(' '); return `${fq} fiscal ${fy}`; };
  // a small link to where a figure came from: the call it was said on, or the earnings release
  function src(o, text) {
    if (!o || !o.url) return '';
    const call = o.kind === 'call', tip = call ? `${label(o.call)} call, ${day(o.date)}${o.quote ? ': “' + o.quote + '”' : ''}` : `${o.call ? label(o.call) + ' earnings release' : 'Earnings release'}${o.date ? ', ' + day(o.date) : ''}${o.quote ? ': “' + o.quote + '”' : ''}${o.sum ? '. The year is the four reported quarters added up.' : ''}`;
    return ` <a class="src" href="${esc(call && o.call ? o.url.replace('#', '?q=' + encodeURIComponent(o.call) + '#') : o.url)}" target="_blank" rel="noopener" title="${esc(tip)}">${text || (call ? 'source' : 'release')}</a>`;
  }
  const good = h => h === 'above', bad = h => h === 'below';
  function beat(b) {
    const cls = b.how === 'above' || b.how === 'high end' ? 'up' : b.how === 'below' || b.how === 'low end' ? 'down' : 'soft';
    const got = b.got ? span(b.got[0], b.got[1], b.u) + (b.basis === 'reported' ? src(b.source) : '') : '';
    const guide = b.lo != null ? said(b) + src(b.guide) : b.none ? 'No guidance given' : 'No figure on record';
    let by = b.by ? 'by ' + b.by : '';
    if (!by && b.lo != null && b.got && (good(b.how) || bad(b.how))) { const d = good(b.how) ? b.got[0] - b.hi : b.got[0] - b.lo, base = good(b.how) ? b.hi : b.lo;
      by = 'by ' + one(Math.abs(d), b.u) + (base ? ` (${trim(Math.abs(d / base) * 100, 1)}%)` : ''); }
    const verdict = b.how ? (HOW[b.how] || esc(b.how)) + (by ? ' ' + esc(by) : '') + (b.basis === 'said' ? src(b.source) : '') : b.lo != null ? 'Result not on record' : '';
    return `<td class="left">${esc(b.m)}</td><td class="left soft">${esc(per(b.p))}</td><td class="num${b.lo != null ? '' : ' soft'}">${guide}</td><td class="num">${got}</td><td class="left said ${b.how ? cls : 'soft'}">${verdict}</td>`;
  }
  // one line of what a mark on the timeline stands for
  const line = b => `${b.m}${b.got ? ' ' + span(b.got[0], b.got[1], b.u) : ''}${b.lo != null ? ' against ' + span(b.lo, b.hi, b.u) + ' guided' : ''}: ${(HOW[b.how] || b.how).toLowerCase()}`;
  const moved = g => stepped(g) ? `${g.m}, ${per(g.p)}: ${span(g.lo, g.hi, g.u)}, ${STEP[g.step].toLowerCase()} from ${span(g.seq[0], g.seq[1], g.u)} for ${per(g.seqp)}`
    : `${g.m}, ${per(g.p)}: ${WORD[g.act].toLowerCase()} to ${span(g.lo, g.hi, g.u)}${g.prev ? ' from ' + span(g.prev[0], g.prev[1], g.u) : ''}`;
  // a call counts as up or down when a guided number moved: the same period against an earlier call, or
  // a main line (revenue, margins, earnings) against the guide for the quarter before
  const mover = (g, a) => g.act === (a === 'up' ? 'raised' : 'cut') || (stepped(g) && g.step === a && rank(g.m) <= 2);

  // the verdict in each tooltip line takes the colour of its dot: green above or raised, red below or cut
  const paint = s => s.replace(/: (above|high end|below|low end|in line)$/, (_, w) => `: <em class="${/above|high/.test(w) ? 'up' : /below|low/.test(w) ? 'down' : 'soft'}">${w}</em>`)
    .replace(/: (raised|cut|guided up|guided down)( to| from)/, (_, w, t) => `: <em class="${/raised|up/.test(w) ? 'up' : 'down'}">${w}</em>${t}`)
    .replace(/(, )(guided up|guided down)( from)/, (_, a, w, t) => `${a}<em class="${/up/.test(w) ? 'up' : 'down'}">${w}</em>${t}`);

  // header: the counts as plain figures, and beside each a small timeline of when they happened
  function summary(G, keys) {
    const el = $('gsum'), C = keys.map(k => ({ k, c: G.calls[k], t: Date.parse(G.calls[k].date) })).filter(x => x.t).reverse();
    const beats = C.filter(x => x.c.res), moves = C.filter(x => x.c.guides.length);
    if (!C.length || (!beats.length && !moves.length)) { el.hidden = true; el.innerHTML = ''; return; }
    const n = (list, f) => list.filter(f).length, has = (x, h) => x.c.beats.some(b => b.how === h), did = (x, a) => x.c.guides.some(g => mover(g, a));
    const T = { beats: n(beats, x => has(x, 'above')), misses: n(beats, x => has(x, 'below')), raises: n(moves, x => did(x, 'up')), cuts: n(moves, x => did(x, 'down')) };
    const W = 300, L = 5, R = 5, t0 = C[0].t, t1 = Math.max(C[C.length - 1].t, t0 + 864e5), X = t => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y0 = new Date(t0).getFullYear() + 1, y1 = new Date(t1).getFullYear(), step = y1 - y0 > 9 ? 3 : y1 - y0 > 4 ? 2 : 1;
    let years = ''; for (let y = y1; y >= y0; y -= step) { const x = X(Date.parse(y + '-01-01T12:00:00')); if (x > L + 8) years += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="4" class="tick"/><text x="${x.toFixed(1)}" y="15" text-anchor="middle">${y}</text>`; }
    const row = (list, up, down, tip) => `<svg viewBox="0 0 ${W} 18" width="${W}" height="18" role="img"><line x1="${L}" x2="${W - R}" y1="9" y2="9" class="base"/>` + list.map(x => { const u = up(x), d = down(x);
      const mark = u && d ? '<circle r="3.2" class="on"/><circle r="6" class="off"/>' : u ? '<circle r="3.2" class="on"/>' : d ? '<circle r="3" class="off"/>' : '<circle r="1.2" class="flat"/>';
      return `<g class="pt" transform="translate(${X(x.t).toFixed(1)} 9)" tabindex="0" aria-label="${esc(label(x.k) + ', ' + tip(x).replace(/\n/g, '. '))}" data-head="${esc(label(x.k) + ' · ' + day(x.c.date))}" data-tip="${esc(tip(x))}"><circle r="8" fill="transparent"/><g class="pop">${mark}</g></g>`; }).join('') + '</svg>';
    const fig = (a, an, b, bn, of) => `<p title="${esc(of)}"><b>${a}</b> ${an}<i></i><b>${b}</b> ${bn}</p>`;
    el.hidden = false;
    el.innerHTML = (beats.length ? fig(T.beats, T.beats === 1 ? 'beat' : 'beats', T.misses, T.misses === 1 ? 'miss' : 'misses', `Of ${beats.length} quarters with a result to compare. A beat is a quarter where at least one measure landed above guidance, a miss one where at least one landed below. A filled dot is a beat, a ring a miss, a small point in line.`) +
        row(beats, x => has(x, 'above'), x => has(x, 'below'), x => x.c.beats.filter(b => b.how).map(line).join('\n')) : '') +
      (moves.length ? fig(T.raises, T.raises === 1 ? 'raise' : 'raises', T.cuts, T.cuts === 1 ? 'cut' : 'cuts', `Of ${moves.length} calls with a guided number. A raise is a call where at least one guided number went up, a cut one where at least one went down. ${QONLY ? `That counts a number raised for the same period. This company guides one quarter at a time, so each new quarter's guide is new guidance and is not counted.` : 'That counts a number raised for the same period, and a revenue, margin or earnings guide set above the one given for the quarter before.'} A filled dot is a raise, a ring a cut, a small point no change.`) +
        row(moves, x => did(x, 'up'), x => did(x, 'down'), x => x.c.guides.filter(g => mover(g, 'up') || mover(g, 'down')).sort(order).map(moved).join('\n') || 'No change to guided numbers') : '') +
      `<svg class="yrs" viewBox="0 0 ${W} 18" width="${W}" height="18" aria-hidden="true">${years}</svg><div class="gtip" role="tooltip"></div>`;
    // hovering or focusing a mark lifts it and opens a card with that call's details
    const box = el.querySelector('.gtip');
    const show = pt => { if (!pt) { box.classList.remove('on'); return; }
      box.innerHTML = `<b>${esc(pt.dataset.head)}</b>` + pt.dataset.tip.split('\n').map(s => `<span>${paint(esc(s))}</span>`).join('');
      const a = el.getBoundingClientRect(), r = pt.getBoundingClientRect();
      box.classList.add('on');
      const w = box.offsetWidth, x = Math.min(Math.max(r.left + r.width / 2 - a.left - w / 2, 0), a.width - w);
      box.style.left = x + 'px'; box.style.top = (r.bottom - a.top + 8) + 'px'; };
    el.onpointerover = e => show(e.target.closest('.pt'));
    el.onpointerleave = () => show(null);
    el.onfocusin = e => show(e.target.closest('.pt'));
    el.onfocusout = () => show(null);
  }

  async function load() {
    const me = ++run, ask = want();
    $('guides').hidden = $('results').hidden = $('gsum').hidden = true; $('stamp').textContent = '';
    if (!ask) { $('name').textContent = 'Guidance'; $('sub').textContent = 'Search for a company to see its guidance.'; MarketLab.menu(''); return; }
    const T = await trend().catch(() => null); if (me !== run) return;
    const up = ask.toUpperCase(), S = T && (T.series.find(x => x.id === ask) || T.series.find(x => x.id.toUpperCase() === up));
    const sym = S ? S.id : up, short = S && S.label.startsWith(sym + ' · ') ? S.label.slice(sym.length + 3) : sym;
    try { localStorage.setItem(LAST, sym); } catch (_) {}
    MarketLab.menu(sym);
    $('name').textContent = short; $('sub').textContent = sym + ' · Guidance'; document.title = `${short} guidance · Equinox`;
    const G = await json(`guidance/${encodeURIComponent(sym)}.json`).catch(() => null); if (me !== run) return;
    const keys = G ? Object.keys(G.calls).sort((a, b) => b.localeCompare(a)) : [];
    NAMES = {}; if (G) for (const k in G.calls) if (G.calls[k].name) NAMES[k] = G.calls[k].name;
    QONLY = !!G && quarterOnly(G);
    summary(G, keys);
    const head = (k, n) => `<th scope="rowgroup" rowspan="${n}" class="left call">${esc(label(k))}<span>${G.calls[k].date ? day(G.calls[k].date) : ''}</span>${G.calls[k].from === 'release' ? '<span title="No call transcript on file for this quarter, so these numbers are read from the earnings release.">From the release</span>' : ''}</th>`;

    const gk = keys.filter(k => G.calls[k].guides.length);
    $('guides').hidden = false;
    $('guideTable').innerHTML = !gk.length ? `<tbody><tr><td class="left none">Equinox found no guided numbers in ${esc(sym)}'s calls or earnings releases.</td></tr></tbody>` :
      `<thead><tr><th class="left">Call</th><th class="left">Measure</th><th class="left">For</th><th>Guidance</th><th>Before</th><th>Change</th><th class="left"></th><th class="left"></th></tr></thead>` +
      gk.map(k => { const gs = [...G.calls[k].guides].sort(order);
        return '<tbody>' + gs.map((g, i) => `<tr title="${esc(g.source && g.source.quote || g.q || '')}">${i ? '' : head(k, gs.length)}<td class="left">${esc(g.m)}</td><td class="left soft">${esc(per(g.p))}</td>` +
          `<td class="num">${said(g)}</td><td class="num soft">${g.prev ? span(g.prev[0], g.prev[1], g.u) : g.act === 'new' && g.seq ? span(g.seq[0], g.seq[1], g.u) + `<span class="read">${esc(g.seqp.split(' ')[0])}</span>` : ''}</td>${change(g)}` +
          `<td class="left said ${tone(g)}">${verb(g)}</td><td class="left">${src(g.source)}</td></tr>`).join('') + '</tbody>'; }).join('');

    const bk = keys.filter(k => G.calls[k].beats.length);
    $('results').hidden = !bk.length;
    if (bk.length) $('beatTable').innerHTML = `<thead><tr><th class="left">Call</th><th class="left">Measure</th><th class="left">For</th><th>Guided</th><th>Result</th><th class="left">Against guidance</th></tr></thead>` +
      bk.map(k => { const bs = G.calls[k].beats; return '<tbody>' + bs.map((b, i) => `<tr>${i ? '' : head(k, bs.length)}${beat(b)}</tr>`).join('') + '</tbody>'; }).join('');
    if (keys.length) $('stamp').textContent = 'Through ' + label(keys[0]);
  }
  addEventListener('hashchange', () => { scrollTo(0, 0); load(); });
  load();
})();
