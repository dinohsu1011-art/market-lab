/* Today: the market call, a sector heatmap, the indexes on one chart, upcoming earnings, breadth, this week's recap, warning signs, volume. */
(() => {
  const { $, css, pct, tone, day, esc, cell, co, json, series, trend, ret, ytd, fail, pick, chart, onRedraw } = EQ;
  const T = [['1D', 'Day'], ['1W', 'Week'], ['1M', 'Month'], ['YTD', 'YTD'], ['1Y', '1 year']];
  const BACK = { '1D': 1, '1W': 5, '1M': 21, '1Y': 252 };
  const words = { '1D': 'latest day', '1W': 'past week', '1M': 'past month', YTD: 'this year', '1Y': 'past year' };
  // sessions to look back for a window; YTD counts from the last close of the prior year
  const back = (dates, k) => { if (k !== 'YTD') return BACK[k]; const y = dates[dates.length - 1].slice(0, 4); let i = dates.length - 1; while (i >= 0 && dates[i].slice(0, 4) === y) i--; return dates.length - 1 - Math.max(i, 0); };

  // sector heatmap: tile size is the sector's share of the S&P 500, color is its return
  const SEC = { xlk: ['Technology', 'Information Technology'], xlc: ['Communication services', 'Communication Services'], xly: ['Consumer discretionary', 'Consumer Discretionary'], xlp: ['Consumer staples', 'Consumer Staples'], xle: ['Energy', 'Energy'], xlf: ['Financials', 'Financials'], xlv: ['Health care', 'Health Care'], xli: ['Industrials', 'Industrials'], xlb: ['Materials', 'Materials'], xlre: ['Real estate', 'Real Estate'], xlu: ['Utilities', 'Utilities'] };
  function squarify(items, W, H) {
    const k = W * H / items.reduce((a, b) => a + b.w, 0), out = [];
    let rest = items.map(it => ({ it, a: it.w * k })), x = 0, y = 0, w = W, h = H;
    const worst = (row, side) => { const s = row.reduce((p, c) => p + c.a, 0), a = row.map(r => r.a); return Math.max(side * side * Math.max(...a) / (s * s), s * s / (side * side * Math.min(...a))); };
    while (rest.length) {
      const side = Math.min(w, h), row = [rest[0]]; let j = 1;
      while (j < rest.length && worst([...row, rest[j]], side) <= worst(row, side)) row.push(rest[j++]);
      const s = row.reduce((p, c) => p + c.a, 0);
      if (w >= h) { const cw = s / h; let cy = y; row.forEach(r => { out.push({ ...r.it, x, y: cy, bw: cw, bh: r.a / cw }); cy += r.a / cw; }); x += cw; w -= cw; }
      else { const rh = s / w; let cx = x; row.forEach(r => { out.push({ ...r.it, x: cx, y, bw: r.a / rh, bh: rh }); cx += r.a / rh; }); y += rh; h -= rh; }
      rest = rest.slice(j);
    }
    return out;
  }
  const rgb = h => h.replace('#', '').match(/../g).map(v => parseInt(v, 16));
  const mix = (a, b, t) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  let tiles = null;
  const drawHeat = () => { if (!tiles) return; const k = heat();
    const top = Math.max(...tiles.map(t => Math.abs(t.r[k] || 0)), k === '1D' ? 1 : 2), base = rgb(css('--raised')), up = rgb(css('--up')), down = rgb(css('--down'));
    $('heat').innerHTML = tiles.map(t => { const v = t.r[k], bg = v == null ? css('--raised') : mix(base, v < 0 ? down : up, .12 + .78 * Math.min(1, Math.abs(v) / top));
      const size = t.bw > 200 && t.bh > 120 ? 'l' : t.bw < 110 || t.bh < 70 ? 's' : 'm';
      return `<a class="tile ${size}" href="market-lab-theme-board.html#${t.id}" style="left:${t.x / 9}%;top:${t.y / 3.8}%;width:${t.bw / 9}%;height:${t.bh / 3.8}%;background:${bg};color:${MarketLab.contrastText(bg)}" title="${esc(t.name)} is ${(t.w * 100).toFixed(1)}% of the S&amp;P 500. ${T.map(([q, l]) => `${l} ${pct(t.r[q])}`).join(', ')}."><span>${esc(t.name)}</span><b class="num">${pct(v, k === '1D' ? 2 : 1)}</b></a>`; }).join(''); };
  const heat = pick($('heatPick'), T, 'equinox.today.heat.v1', '1D', drawHeat);
  try { const S = window.QUANT_SECTORS, wt = {}; window.QUANT_INDEX_WEIGHTS.indexes.spx.rows.forEach(r => wt[r.s] = (wt[r.s] || 0) + r.w);
    const rows = S.series.filter(s => SEC[s.id]).map(s => ({ id: s.id, name: SEC[s.id][0], w: wt[SEC[s.id][1]] || 0, r: Object.fromEntries(T.map(([k]) => [k, ret(s.close, back(S.dates, k))])) })).filter(r => r.w > 0).sort((a, b) => b.w - a.w);
    tiles = squarify(rows, 900, 380); $('heatStamp').textContent = 'Updated ' + day(S.dates[S.dates.length - 1]); drawHeat();
  } catch (_) { fail($('heat')); }

  // indexes: percent change over the chosen window, all on one scale
  const IX = [['spy', 'S&P 500', '--ink'], ['qqq', 'Nasdaq 100', '--accent'], ['iwm', 'Russell 2000', '#c2851a'], ['mdy', 'Midcap 400', '#8a63d2'], ['rsp', 'Equal weight', '#1f9d94']];
  const col = c => c.startsWith('--') ? css(c) : c;
  let P = null, L = null, D = null;
  const key = i => { $('ixKey').innerHTML = L.map((l, j) => { const v = l.v[i == null ? l.v.length - 1 : i]; return `<span><i style="background:${l.col}"></i>${IX[j][1]} <b class="num ${tone(v)}">${pct(v, 2)}</b></span>`; }).join('') + `<span class="when">${i == null ? words[ix()] : day(D[i])}</span>`; };
  const drawIx = () => { if (!P) return; const k = ix(), n = Math.min(back(P[0].dates, k), ...P.map(p => p.close.length - 1)) + 1;
    D = P[0].dates.slice(-n);
    L = P.map((p, j) => { const c = p.close.slice(-n); return { v: c.map(x => (x / c[0] - 1) * 100), col: col(IX[j][2]), w: j ? 1.75 : 2.5 }; });
    chart($('ixChart'), { lines: L, dash: 0, label: 'Index returns, ' + words[k], onHover: key }); key(null); };
  let old = ''; try { old = localStorage.getItem('equinox.today.range.v1') || ''; } catch (_) {}
  const ix = pick($('ixPick'), T, 'equinox.today.index.v1', old === '1M' || old === '1Y' ? old : 'YTD', drawIx);
  onRedraw(() => { drawHeat(); drawIx(); });
  Promise.all(IX.map(x => series(x[0]))).then(all => { P = all; drawIx();
    $('ixTable').innerHTML = '<thead><tr><th>Index</th><th>Day</th><th>Week</th><th>Month</th><th>3 months</th><th>YTD</th><th>1 year</th></tr></thead><tbody>' +
      all.map((p, j) => `<tr><th scope="row">${IX[j][1]}</th>${cell(ret(p.close, 1), 2)}${[ret(p.close, 5), ret(p.close, 21), ret(p.close, 63), ytd(p), ret(p.close, 252)].map(v => cell(v)).join('')}</tr>`).join('') + '</tbody>';
  }).catch(() => { fail($('ixChart')); $('ixKey').textContent = ''; });

  // breadth: share of stocks trading above a moving average, over the chosen stretch of time
  { const WIN = [['21', '21-day'], ['50', '50-day'], ['200', '200-day']]; let M = null, v, d;
    const RNG = [['3M', '3 months', 63], ['6M', '6 months', 126], ['1Y', '1 year', 252], ['3Y', '3 years', 756], ['All', 'All', 0]];
    const now = i => { const a = i == null ? v[v.length - 1] : v[i]; if (a == null) return; $('brNow').textContent = a.toFixed(1) + '%'; $('brWhen').textContent = i == null ? 'now' : day(d[i]); };
    const drawBr = () => { if (!M) return; const u = M.universes.find(x => x.id === uni()) || M.universes[0], r = RNG.find(x => x[0] === rng()), n = r[2] || M.dates.length;
      v = u.windows[win()].pct.slice(-n); d = M.dates.slice(-n);
      chart($('brChart'), { lines: [{ v, col: css('--accent') }], dash: 50, min: 0, max: 100, label: `${u.label} above their ${win()}-day average, ${r[2] ? 'past ' + r[1] : 'since ' + day(d[0], { month: 'short', year: 'numeric' })}`, onHover: now }); now(null); };
    let seed = '50'; try { seed = localStorage.getItem('equinox.markets.breadth.v1') || '50'; } catch (_) {}
    const win = pick($('brPick'), WIN, 'equinox.today.breadth.v1', seed, drawBr);
    const uni = pick($('brUni'), [['sp500', 'S&P 500'], ['nasdaq', 'Nasdaq stocks'], ['total', 'All US stocks']], 'equinox.today.breadthSet.v1', 'sp500', drawBr);
    const rng = pick($('brRange'), RNG, 'equinox.today.breadthRange.v1', '1Y', drawBr);
    onRedraw(drawBr);
    json('cube/market-breadth.json').then(B => { M = B; drawBr(); }).catch(() => fail($('brChart'))); }

  // weekly review: the call, the recap and unusual volume
  const idx = window.QUANT_REVIEWS_INDEX || { editions: [] };
  const id = idx.latest_complete_review_id || (idx.editions[idx.editions.length - 1] || {}).review_id;
  const names = trend().then(t => Object.fromEntries(t.series.map(x => [x.id, x.label]))).catch(() => ({}));
  (id ? json(`cube/reviews/${id}/snapshot.json`) : Promise.reject()).then(async S => {
    const N = S.narrative || {};
    $('call').textContent = N.call || 'Today';
    $('recap').innerHTML = `<div><p class="lede" style="margin-top:0">${esc(N.detail)} ${esc(N.market)}</p></div>
      <div><h3>Led the week</h3><p>${esc(N.winners)}</p><h3>Lagged</h3><p>${esc(N.laggards)}</p></div>`;
    const Lb = await names;
    $('volTable').innerHTML = `<thead><tr><th>Company</th><th title="Latest volume divided by its usual level">Volume vs normal</th><th>Latest day</th><th>1 week</th></tr></thead><tbody>` +
      S.volume.map(v => `<tr><td class="name">${co(v.t, Lb[v.t])}</td><td class="num">${v.rvol.toFixed(1)}×</td>${cell(v.chg * 100)}${cell(v.r1w * 100)}</tr>`).join('') + '</tbody>';
  }).catch(() => { $('call').textContent = 'Today'; ['recap', 'volTable'].forEach(k => fail($(k))); });

  // warning signs
  json('cube/market-watch.json').then(W => {
    const active = W.flags.filter(f => f.active).length;
    $('signCount').textContent = active ? `${active} of ${W.flags.length} active` : `None of ${W.flags.length} active`;
    $('signTable').innerHTML = '<thead><tr><th>Sign</th><th>Reading</th><th>State</th></tr></thead><tbody>' + W.flags.map(f => `<tr><th scope="row">${esc(f.label)}</th><td class="num soft">${esc(f.reading)}</td><td class="${f.active ? 'down' : 'soft'}">${f.active ? 'Active' : 'Clear'}</td></tr>`).join('') + '</tbody>';
  }).catch(() => fail($('signTable')));

  // earnings ahead: this week and the two after it, filtered by sector or industry (earnings-ahead.json, ops/build_earnings_ahead.py)
  const later = () => json('earnings-ahead.json').then(E => {
    const iso = d => d.toISOString().slice(0, 10), now = new Date(), mon = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7));
    const edge = n => iso(new Date(+mon + n * 7 * 864e5)), today = iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    const W = { this: [today, edge(1)], next: [edge(1), edge(2)], after: [edge(2), edge(3)], all: [today, edge(3)] };
    const rows = E.rows.filter(r => r.date >= today && r.date < edge(3));
    if (!rows.length) { $('earnings').hidden = true; document.querySelector('.side a[href="#earnings"]').hidden = true; return; }
    const IKEY = 'equinox.today.earnings.industry.v1', sel = $('aheadIndustry');
    const secs = [...new Set(rows.map(r => r.sector).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All industries</option>' + secs.map(s => `<optgroup label="${esc(s)}"><option value="s:${esc(s)}">All ${esc(s)}</option>` +
      [...new Set(rows.filter(r => r.sector === s).map(r => r.industry).filter(Boolean))].sort().map(i => `<option value="i:${esc(i)}">${esc(i)}</option>`).join('') + '</optgroup>').join('');
    try { const v = localStorage.getItem(IKEY) || ''; if ([...sel.options].some(o => o.value === v)) sel.value = v; } catch (_) {}
    // the real moment of each report, so a calendar shows it at the viewer's own local time. New York clock time is
    // turned into an instant through the America/New_York zone, which carries daylight saving.
    const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const nyParts = t => Object.fromEntries(nyFmt.formatToParts(new Date(t)).map(p => [p.type, +p.value]));
    const ny = (date, h, m) => { const [Y, Mo, D] = date.split('-').map(Number), want = Date.UTC(Y, Mo - 1, D, h, m); let t = want;
      for (let k = 0; k < 2; k++) { const p = nyParts(t); t += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute); } return t; };
    // the feed stamps most reports 16:00 or 08:00 New York, which only means after the close or before the open:
    // those become 16:05 and 07:00. Any other stamp is taken as the real time.
    const at = r => { const t = r.ts ? Date.parse(r.ts) : NaN, p = isFinite(t) ? nyParts(t) : null;
      return p && !(p.minute === 0 && (p.hour === 16 || p.hour === 8)) ? t : r.when === 'after' ? ny(r.date, 16, 5) : ny(r.date, 7, 0); };
    const stamp = t => new Date(t).toISOString().replace(/[-:]|\.\d+/g, '');
    const gcal = r => { const t = at(r); return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(`${r.t} earnings`) + `&dates=${stamp(t)}/${stamp(t + 18e5)}` +
      '&details=' + encodeURIComponent(`${r.name} reports ${r.when === 'after' ? 'after the US market close' : 'before the US market opens'}.`); };
    // when that moment falls on another day where the viewer is, say so in the row
    const local = r => { const x = new Date(at(r)), same = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') === r.date;
      return same ? '' : `<span class="local">${x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${x.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ').toLowerCase()} your time</span>`; };
    const paint = () => { const [lo, hi] = W[week()], f = sel.value, k = f.slice(2);
      const list = rows.filter(r => r.date >= lo && r.date < hi && (!f || (f[0] === 's' ? r.sector === k : r.industry === k)));
      let last = '';
      $('aheadTable').innerHTML = !list.length ? '<tbody><tr><td class="left none">No reports on the calendar for this choice.</td></tr></tbody>' :
        '<thead class="stick"><tr><th>Date</th><th class="left">Company</th><th class="left">Industry</th><th class="left">Reports</th><th></th></tr></thead><tbody>' + list.map(r => { const d = r.date === last ? '' : day(r.date, { weekday: 'long', month: 'short', day: 'numeric' }); last = r.date;
          return `<tr><th scope="row">${d}</th><td class="name" style="padding-left:20px">${co(r.t, r.name)}</td><td class="left soft">${esc(r.industry)}</td><td class="left soft">${r.when === 'after' ? 'After close' : 'Before open'}${local(r)}</td>` +
            `<td class="num"><a class="addcal" href="${esc(gcal(r))}" target="_blank" rel="noopener" title="Add ${esc(r.t)} earnings to Google Calendar">Add to calendar</a></td></tr>`; }).join('') + '</tbody>'; };
    const week = pick($('aheadWeek'), [['this', 'This week'], ['next', 'Next week'], ['after', 'Week after'], ['all', 'All 3 weeks']], 'equinox.today.earnings.week.v1', 'all', paint);
    sel.addEventListener('change', () => { try { localStorage.setItem(IKEY, sel.value); } catch (_) {} paint(); });
    // the table sits above other sections now, so a link to one of those is put back in view once the rows are in
    const y0 = scrollY, to = /^#[\w-]+$/.test(location.hash) && location.hash !== '#earnings' ? document.querySelector(location.hash) : null;
    paint();
    if (to && Math.abs(scrollY - y0) < 2 && $('earnings').compareDocumentPosition(to) & 4) to.scrollIntoView();
  }).catch(() => fail($('aheadTable')));
  if (document.readyState === 'complete') setTimeout(later, 200); else addEventListener('load', () => setTimeout(later, 200));
  EQ.spy();
})();
