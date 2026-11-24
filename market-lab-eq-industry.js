/* Industry page (#live-entertainment, #semiconductors, ...). Live Entertainment holds the theaters and
   streaming call analysis, drawn by market-lab-calls.js into the #live block. Every other industry lists
   its companies from cube/trend-index.json with the date of their last earnings call. The list of
   industries and their names is the side list written by market-lab-eq-build.py. */
(() => {
  const { $, day, esc, co, trend, script } = EQ;
  const LIVE = 'live-entertainment';
  // [ticker for the company pages, call file] for the companies scored in the theaters and streaming work.
  // PSKY is now SKYD (same call file). WBD deregistered on 2026-10-16 and has no company page, so it is
  // left out here; its calls still count in the streaming charts.
  const LIVE_COS = [['AMZN', 'amzn'], ['AAPL', 'aapl'], ['CMCSA', 'cmcsa'], ['DIS', 'dis'], ['NFLX', 'nflx'], ['SKYD', 'paramount']];
  // Which of the site's own sector and industry labels make up each industry. The data carries two
  // naming schemes, so both spellings are listed.
  const RULES = {
    'semiconductors': { ind: ['Semiconductors', 'Semiconductor Materials & Equipment', 'Electronic Production Equipment'] },
    'software': { ind: ['Packaged Software', 'Application Software', 'Systems Software'] },
    'internet': { ind: ['Internet Software/Services', 'Interactive Media & Services', 'Internet Retail', 'Internet Services & Infrastructure'] },
    'banks': { ind: ['Major Banks', 'Regional Banks', 'Diversified Banks', 'Savings Banks'] },
    'energy': { sector: ['Energy'], ind: ['Oil & Gas Pipelines', 'Oilfield Services/Equipment', 'Contract Drilling'] },
    'utilities-power': { sector: ['Utilities'] },
    'health-care': { ind: ['Health Care Distributors', 'Health Care Equipment', 'Health Care Facilities', 'Health Care Services', 'Health Care Supplies', 'Health Care Technology', 'Hospital/Nursing Management', 'Life Sciences Tools & Services', 'Managed Health Care', 'Medical Devices', 'Medical Instruments & Supplies', 'Medical Specialties', 'Medical/Nursing Services', 'Services to the Health Industry', 'Diagnostics & Research'] },
    'biotech-drugs': { ind: ['Biotechnology', 'Pharmaceuticals', 'Pharmaceuticals: Generic', 'Pharmaceuticals: Major', 'Pharmaceuticals: Other', 'Drug Manufacturers - Specialty & Generic'] },
    'retail': { ind: ['Apparel Retail', 'Apparel/Footwear Retail', 'Automotive Retail', 'Broadline Retail', 'Computer & Electronics Retail', 'Department Stores', 'Discount Stores', 'Electronics/Appliance Stores', 'Food Retail', 'Home Improvement Chains', 'Home Improvement Retail', 'Homefurnishing Retail', 'Other Specialty Retail', 'Specialty Stores', 'Consumer Staples Merchandise Retail'] },
    'industrials': { ind: ['Industrial Machinery', 'Industrial Machinery & Supplies & Components', 'Specialty Industrial Machinery', 'Electrical Components & Equipment', 'Electrical Products', 'Heavy Electrical Equipment', 'Building Products', 'Construction & Engineering', 'Engineering & Construction', 'Industrial Conglomerates', 'Construction Machinery & Heavy Transportation Equipment', 'Trucks/Construction/Farm Machinery', 'Agricultural & Farm Machinery', 'Metal Fabrication', 'Miscellaneous Manufacturing'] },
    'aerospace-defense': { ind: ['Aerospace & Defense'] },
    'autos': { ind: ['Automobile Manufacturers', 'Motor Vehicles', 'Auto Parts: OEM', 'Automotive Parts & Equipment', 'Automotive Aftermarket'] },
    'airlines-travel': { ind: ['Airlines', 'Passenger Airlines', 'Hotels, Resorts & Cruise Lines', 'Hotels/Resorts/Cruise lines', 'Casinos & Gaming', 'Casinos/Gaming'] },
  };
  const links = [...document.querySelectorAll('nav.side > a')];
  const label = id => { const a = links.find(x => x.getAttribute('href') === '#' + id); return a ? a.textContent : id; };
  // #semiconductors opens that industry. Anything else, including a saved view of the call charts
  // (#live-entertainment&lens=theater..., or the old #lens=theater...), opens Live Entertainment.
  const want = () => { const id = location.hash.slice(1).split('&')[0]; return RULES[id] ? id : LIVE; };

  // the date of a company's last call, read from its call file and kept for the visit
  const dates = new Map();
  const lastCall = f => { if (!dates.has(f)) dates.set(f, fetch(`cube/calls/${encodeURIComponent(f)}.json`).then(r => { if (!r.ok) throw new Error(f); return window.MarketLabReadJSON(r); })
    .then(j => (j.calls || []).reduce((m, c) => c.d && c.d > m ? c.d : m, '')).catch(() => '')); return dates.get(f); };
  let run = 0, cur = null, calls = null;
  // six files at a time, and it stops when another industry is opened
  function fill(table, me) {
    const cells = [...table.querySelectorAll('td[data-f]')]; let i = 0;
    const work = async () => { while (i < cells.length && me === run) { const td = cells[i++], d = await lastCall(td.dataset.f); td.textContent = d ? day(d) : 'None'; td.classList.toggle('none', !d); } };
    for (let k = 0; k < 6; k++) work();
  }
  const HEAD = '<thead><tr><th class="name">Company</th><th>Last call</th><th>Earnings calls</th></tr></thead>';
  const row = (t, name, f) => `<tr><td class="name">${co(t, name)}</td>` + (f
    ? `<td class="num soft" data-f="${esc(f)}">&nbsp;</td><td><a class="link" href="market-lab-company-calls.html#${encodeURIComponent(t)}">All calls</a></td>`
    : '<td class="none">None</td><td></td>') + '</tr>';

  async function plain(id, me) {
    $('coTable').innerHTML = ''; $('coCount').textContent = '';
    const T = await trend().catch(() => null); await script('cube/calls-index.js').catch(() => null);
    if (me !== run) return;
    if (!T) { $('coCount').textContent = 'This did not load. Refresh to try again.'; return; }
    const R = RULES[id], has = new Set(window.EQUINOX_CALLS && window.EQUINOX_CALLS.tickers || []);
    const M = T.series.filter(s => s.kind === 'equity' && s.nav && s.nav[1] === 'United States' && ((R.sector || []).includes(s.nav[2]) || (R.ind || []).includes(s.nav[3]))).sort((a, b) => a.id.localeCompare(b.id));
    $('coCount').textContent = `${M.length} companies, ${M.filter(s => has.has(s.id)).length} with earnings calls`;
    $('coTable').innerHTML = HEAD + '<tbody>' + M.map(s => row(s.id, s.label, has.has(s.id) ? s.id.toLowerCase() : '')).join('') + '</tbody>';
    fill($('coTable'), me);
  }
  async function liveCos(me) {
    const T = await trend().catch(() => null); if (me !== run) return;
    const name = t => { const s = T && T.series.find(x => x.id === t); return s ? s.label : t; };
    $('liveTable').innerHTML = HEAD + '<tbody>' + LIVE_COS.map(([t, f]) => row(t, name(t), f)).join('') + '</tbody>';
    fill($('liveTable'), me);
  }

  function show() {
    const id = want(); if (id === cur) return;
    const first = cur === null, me = ++run; cur = id;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
    $('indName').textContent = label(id); document.title = `${label(id)} · Industry · Equinox`;
    $('live').hidden = id !== LIVE; $('plain').hidden = id === LIVE;
    if (!first) { scrollTo(0, 0); const box = $(id === LIVE ? 'live' : 'plain'); box.classList.remove('rise'); void box.offsetWidth; box.classList.add('rise'); }
    if (id !== LIVE) return plain(id, me);
    // the analysis script starts itself on load; later visits only need a redraw at the current width
    if (calls) dispatchEvent(new Event('eq:industry')); else calls = script('market-lab-calls.js').catch(() => { calls = null; const b = $('load-error'); b.hidden = false; b.textContent = 'This did not load. Refresh to try again.'; });
    liveCos(me);
  }
  addEventListener('hashchange', show);
  show();
})();
