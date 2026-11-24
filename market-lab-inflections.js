/* Inflections: stocks where the business and the price just turned, with each screen's tested record.
   Data: inflections.json, written by analysis/inflection_page.py. Names come from cube/trend-index.json. */
(() => {
  const { $, pct, tone, day, esc, co, json, fail } = EQ;
  const root = document.documentElement;
  root.style.setProperty('--tone', 'var(--accent)'); root.style.setProperty('--tint', 'color-mix(in srgb, var(--accent) 12%, transparent)');
  const n = v => v == null ? '' : Number(v).toLocaleString('en-US');
  const p0 = v => v == null ? '' : Math.round(v) + '%';
  const money = v => v == null ? '' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) + 'M';
  const td = (v, d = 1, cls = '') => `<td class="num ${tone(v)}${cls}">${pct(v, d)}</td>`;
  const short = s => day(s, { month: 'short', day: 'numeric', year: 'numeric' });
  const PAST = 20;

  const ABOUT = {
    turn: 'The stock fell 40% or more from its two-year high at some point in the past six months. Since then it has beaten SPY by 15% or more over three months and sits above its 100-day trend against SPY. And the company just posted its first profit: a loss last quarter and a year ago, a profit now, on an operating or net basis.',
    accel: 'The same price test: a drop of 40% or more, then three months of beating SPY by 15% or more. And sales growth sped up for the second quarter in a row, while still above zero.',
    gap: 'On the day after earnings the stock opened 4% or more above the prior close, on at least twice its normal volume. Twenty trading days later it still holds at least half of that jump and never fell back to the old close. The test buys on that 20th day.',
  };

  json('inflections.json').then(async D => {
    let names = {};
    try { (await EQ.trend()).series.forEach(x => { names[x.id] = x.label; }); } catch (_) {}
    const nm = t => co(t, names[t]);
    const bar = D.bar, S = D.screens;
    const keys = ['turn', 'accel', 'gap'];
    const works = k => { const r = S[k].record, b = k === 'gap' ? D.bar_d20 : bar; return r.median - b.median >= 5 && r.beat - b.beat >= 8; };

    $('stamp').textContent = 'Updated ' + day(D.updated);
    $('sub').textContent = `${n(D.companies)} companies, checked after every earnings report`;
    const good = keys.filter(works), weak = keys.filter(k => !works(k));
    $('lede').textContent = `${good.length === 2 ? 'Two' : good.length} of these screens have a real record. A year after firing, they beat SPY ${good.map(k => p0(S[k].record.beat)).sort().join(' and ')} of the time, against ${p0(bar.beat)} for any stock after any report.` +
      (weak.length ? ` The ${weak.map(k => S[k].title.toLowerCase()).join(' and ')} did about the same as an average stock. It is here so you can watch it, and its weak record is shown with it.` : '');
    $('jump').innerHTML = keys.map(k => `<a href="#${k}">${esc(S[k].title)} <b>${S[k].now.length}</b></a>`).join('') + '<a href="#scorecard">Everything we tested</a><a href="#method">How this works</a>';

    // one screen: what it looks for, how it did, who matches today, and every past case
    const years = (rec, base) => {
      const ys = Object.keys(rec.years).filter(y => y >= '2017').sort();
      if (!ys.length) return '';
      const vals = ys.flatMap(y => [rec.years[y][0], base.years[y] ? base.years[y][0] : 0]).filter(v => v != null);
      const top = Math.max(20, Math.ceil(Math.max(...vals.map(Math.abs)) / 10) * 10);
      const W = 520, H = 200, padT = 18, padB = 40, mid = padT + (H - padT - padB) / 2, half = (H - padT - padB) / 2, step = W / ys.length, bw = Math.min(30, step * .5);
      const y = v => mid - (v / top) * half;
      const cols = ys.map((yr, i) => {
        const [m, c] = rec.years[yr], b = base.years[yr] ? base.years[yr][0] : null, x = i * step + step / 2;
        const h = Math.abs(y(m) - mid), top0 = m >= 0 ? y(m) : mid;
        return `<g class="${c < 5 ? 'thin' : ''}"><title>${yr}: median ${pct(m)} vs SPY over ${c} case${c === 1 ? '' : 's'}${b == null ? '' : `. All stocks: ${pct(b)}`}</title>` +
          `<rect x="${x - bw / 2}" y="${top0}" width="${bw}" height="${Math.max(h, 1)}" rx="2" class="${m >= 0 ? 'u' : 'd'}"/>` +
          (b == null ? '' : `<line x1="${x - bw / 2 - 6}" x2="${x + bw / 2 + 6}" y1="${y(b)}" y2="${y(b)}" class="ref"/>`) +
          `<text x="${x}" y="${H - padB + 18}" class="yr">${'’' + yr.slice(2)}</text><text x="${x}" y="${H - padB + 34}" class="cnt">${c}</text>` +
          `<text x="${x}" y="${m >= 0 ? y(m) - 5 : y(m) + 13}" class="val">${Math.round(m)}</text></g>`;
      }).join('');
      return `<figure class="yrs"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median return against SPY a year later, by the year the screen fired">` +
        `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="zero"/>${cols}</svg>` +
        `<figcaption><span><i class="sw"></i>Median a year later vs SPY, by year it fired</span><span><i class="dash"></i>Any stock that year</span><span class="faint">Small number: cases that year</span></figcaption></figure>`;
    };

    const record = (k) => {
      const r = S[k].record, b = k === 'gap' ? D.bar_d20 : bar, w = works(k);
      const line = (label, v, bv, fmt) => `<div class="row"><dt>${label}</dt><dd><span class="${fmt === 'pct' ? tone(v) : ''}">${fmt === 'pct' ? pct(v) : p0(v)}</span><em>any stock ${fmt === 'pct' ? pct(bv) : p0(bv)}</em></dd></div>`;
      return `<div class="rec">
        <div>
          <p class="verdict">${w ? `Beat SPY ${p0(r.beat)} of the time a year later, with a median lead of ${pct(r.median)}.` : `About the same as an average stock: ${p0(r.beat)} beat SPY a year later, against ${p0(b.beat)} for any stock, and the median case ${r.median < 0 ? 'trailed SPY by ' + pct(-r.median).replace('+', '') : 'led SPY by ' + pct(r.median).replace('+', '')}.`}</p>
          <dl>${line('Beat SPY a year later', r.beat, b.beat, 'p')}${line('Median vs SPY, 12 months', r.median, b.median, 'pct')}${line('Median vs SPY, 6 months', r.m6, b.m6, 'pct')}${line('Median vs SPY, 3 months', r.m3, b.m3, 'pct')}${line('Big wins: 50%+ ahead of SPY', r.big, b.big, 'p')}${line('Blowups: 50%+ behind SPY', r.bust, b.bust, 'p')}</dl>
          <p class="note">${n(r.cases)} cases at ${n(r.companies)} companies since ${k === 'gap' ? 2016 : 2017}, ${n(r.n12)} with a full year after. Leaving out the COVID rebound (March 2020 to June 2021), the median was ${pct(r.excovid)} over ${n(r.excovid_n)} cases.${k === 'gap' ? ' Measured from the 20th day, when the test buys.' : ''}</p>
        </div>
        ${years(r, b)}
      </div>`;
    };

    const today = k => {
      const now = S[k].now;
      if (k !== 'gap') {
        if (!now.length) return '<h3>Today</h3><p class="note">No company matches right now.</p>';
        return `<h3>Today <span>${now.length} compan${now.length === 1 ? 'y' : 'ies'}</span></h3><div class="scroll"><table><thead><tr><th class="name">Company</th><th>Reported</th><th>Quarter</th><th title="Deepest point below the two-year high in the past six months">Fell from high</th><th title="Return against SPY over the three months before the report">Beat SPY, 3 months</th><th title="Revenue growth from a year earlier">Sales growth</th><th>Operating profit</th><th>Net profit</th><th title="Return against SPY from the day after the report to the latest close">Since then vs SPY</th></tr></thead><tbody>` +
          now.map(r => `<tr><td class="name">${nm(r.t)}</td><td class="num soft">${short(r.date)}</td><td class="soft">${esc(r.q.replace(/^FY(\d{4})(Q\d)$/, '$2 $1'))}</td><td class="num soft">${pct(r.drop, 0)}</td><td class="num soft">${pct(r.beat3m, 0)}</td><td class="num soft">${pct(r.yoy, 0)}</td><td class="num soft">${money(r.op)}</td><td class="num soft">${money(r.ni)}</td>${td(r.since)}</tr>`).join('') + '</tbody></table></div>';
      }
      const held = now.filter(r => !('waiting' in r)), wait = now.filter(r => 'waiting' in r);
      const head = last => `<thead><tr><th class="name">Company</th><th>Reported</th><th title="How far it opened above the prior close">Gap</th><th title="Volume on the gap day against its normal day">Volume</th>${last}</tr></thead>`;
      const rowStart = r => `<td class="name">${nm(r.t)}</td><td class="num soft">${short(r.date)}</td><td class="num soft">${pct(r.gap, 0)}</td><td class="num soft">${r.volx.toFixed(1)}×</td>`;
      return `<h3>Held for 20 days <span>${held.length}</span></h3>` + (held.length ? `<div class="scroll"><table>${head('<th>Buy day</th><th title="Return against SPY from the buy day to the latest close">Since buy day vs SPY</th>')}<tbody>` +
        held.map(r => `<tr>${rowStart(r)}<td class="num soft">${short(r.entry)}</td>${td(r.since)}</tr>`).join('') + '</tbody></table></div>' : '<p class="note">None right now.</p>') +
        `<h3>Still inside the 20 days <span>${wait.length}</span></h3><p class="note">Holding so far. They count once they reach day 20 without giving back half the gap.</p>` + (wait.length ? `<div class="scroll"><table>${head('<th>Days left</th><th title="Return against SPY since the day after the report">Since report vs SPY</th>')}<tbody>` +
        wait.map(r => `<tr>${rowStart(r)}<td class="num soft">${r.waiting}</td>${td(r.since_report)}</tr>`).join('') + '</tbody></table></div>' : '');
    };

    const past = k => {
      const P = S[k].past;
      if (!P.length) return '';
      return `<div class="past"><h3>Every past case <span>${P.length}, newest first</span></h3><div class="scroll"><table data-past="${k}"><thead><tr><th class="name">Company</th><th>Reported</th><th>Quarter</th><th>3 months</th><th>6 months</th><th title="Against SPY. A case under a year old shows its return so far.">12 months</th></tr></thead><tbody></tbody></table></div>` +
        (P.length > PAST ? `<div class="more"><button type="button" class="link" data-all="${k}">Show all ${P.length}</button></div>` : '') + '</div>';
    };
    const paintPast = (k, all) => {
      const T = document.querySelector(`table[data-past="${k}"]`);
      if (!T) return;
      T.tBodies[0].innerHTML = S[k].past.slice(0, all ? undefined : PAST).map(r => `<tr><td class="name">${nm(r.t)}</td><td class="num soft">${short(r.date)}</td><td class="soft">${esc(r.q.replace(/^FY(\d{4})(Q\d)$/, '$2 $1'))}</td>${td(r.m3, 0)}${td(r.m6, 0)}` +
        (r.m12 != null ? td(r.m12, 0) : `<td class="num soft" title="Not a full year yet: return against SPY so far">${r.since == null ? '' : 'so far ' + pct(r.since, 0)}</td>`) + '</tr>').join('');
    };

    $('screens').innerHTML = keys.map(k => `<section id="${k}" class="screen-sec">
      <h2>${esc(S[k].title)} <small>${S[k].now.length} today</small></h2>
      <p class="about">${ABOUT[k]}</p>
      ${record(k)}
      ${today(k)}
      ${past(k)}
    </section>`).join('');
    keys.forEach(k => paintPast(k, false));
    $('screens').addEventListener('click', e => { const b = e.target.closest('button[data-all]'); if (!b) return; paintPast(b.dataset.all, true); b.parentElement.remove(); });

    // scorecard: the bar, this page's screens, then the rest, best median first within each group
    const GROUP = { bar: 'The bar', page: 'On this page', other: 'Turnaround signals, first round', history: 'Breaking the company’s own records, second round' };
    const anchor = { 'First profit after a big drop': 'turn', 'Sales speeding up after a big drop': 'accel', 'Gap up that held (bought 20 days later)': 'gap' };
    const T = $('scTable');
    T.tHead.innerHTML = '<tr><th class="name">Signal</th><th>Cases</th><th>Beat SPY</th><th>Median vs SPY</th><th title="50% or more ahead of SPY">Big wins</th><th title="50% or more behind SPY">Blowups</th></tr>';
    T.tBodies[0].innerHTML = Object.keys(GROUP).map(g => {
      let rows = D.scorecard.filter(r => r.group === g);
      if (g === 'other' || g === 'history') rows = rows.sort((a, b) => b.median - a.median);
      return `<tr class="grp"><th colspan="6">${GROUP[g]}</th></tr>` + rows.map(r => `<tr class="${r.median - bar.median >= 5 && r.beat - bar.beat >= 8 ? 'good' : 'soft'}"><td class="name">${anchor[r.label] ? `<a href="#${anchor[r.label]}">${esc(r.label)}</a>` : esc(r.label)}</td><td class="num">${n(r.cases)}</td><td class="num">${p0(r.beat)}</td>${td(r.median)}<td class="num">${p0(r.big)}</td><td class="num">${p0(r.bust)}</td></tr>`).join('');
    }).join('');
    $('scStamp').textContent = `Reports from ${day(D.first, { month: 'short', year: 'numeric' })} to ${day(D.tested_to, { month: 'short', year: 'numeric' })}`;
    $('scorecard').hidden = false;

    $('methodBody').innerHTML = [
      ['What gets checked', `${n(D.companies)} companies and every quarterly report they filed, mostly from 2017 on. Sales and profit figures are the ones first reported where we have them, so the test never uses numbers that were only known later.`],
      ['When each screen is read', 'At the close of the first trading day after the earnings call, so you could have acted on it. The gap screen waits 20 more trading days and is read then.'],
      ['What "beat SPY" means', 'The stock’s return minus the return of SPY, the S&P 500 fund, over the same months, with dividends counted. The median is the middle case, so one giant winner cannot carry a screen.'],
      ['The bar to beat', `After any report at any of these stocks, ${p0(bar.beat)} beat SPY over the next year and the median trailed it by ${pct(-bar.median).replace('+', '')}. A screen is only useful if it clears that bar by a wide margin.`],
      ['Why the record may look better than the future', 'The list holds companies that exist today, so firms that went bust or were bought out are missing. That flatters every row, the bar included. The two screens that work rest on 105 and 282 cases, and some years have only a handful. The screens were also chosen after seeing the results, so expect less edge going forward. Trading costs are left out.'],
      ['Who shows up today', 'A company stays on a screen until its next report, for up to 120 days. "Since then" is its return against SPY from the day after the report to the latest close.'],
      ['Where the numbers come from', `analysis/inflection_backtest.py and analysis/inflection_paradigm.py run the test. analysis/inflection_page.py writes this page’s data. Prices updated ${day(D.updated)}.`],
    ].map(([h, p]) => `<div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('');
    $('method').hidden = false;
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }).catch(() => fail($('screens')));
})();
