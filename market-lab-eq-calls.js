/* Earnings calls for one company (#NVDA, or the last company viewed): every call with its transcript,
   slides and press release, then investor days. Links come from cube/calls and, when a file exists,
   company-links/<TICKER>.json. */
(() => {
  const { $, pct, tone, day, esc, json, trend, finder } = EQ;
  const LAST = 'equinox.company.last.v1';
  let run = 0, last = [], said = null;
  EQ.onRedraw(() => { if (!$('react').hidden) EQ.reaction($('dots'), last, said); });
  const want = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
    if (!h) try { h = localStorage.getItem(LAST) || ''; } catch (_) {} return h; };
  const web = u => /^https?:\/\//.test(u || '');
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  const a = (u, text, title) => `<a class="link" href="${esc(u)}" target="_blank" rel="noopener"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</a>`;
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : '';
  // name the place a transcript lives
  const source = u => { const h = host(u); return h.endsWith('fool.com') ? 'Motley Fool' : h.endsWith('huggingface.co') ? 'Transcript dataset' : h.endsWith('seekingalpha.com') ? 'Seeking Alpha' : h.endsWith('investing.com') ? 'Investing.com' : h.endsWith('insidermonkey.com') ? 'Insider Monkey' : h.endsWith('yahoo.com') ? 'Yahoo Finance' : h.endsWith('marketbeat.com') ? 'MarketBeat' : h.endsWith('aol.com') ? 'AOL' : 'Company file'; };

  async function load() {
    const me = ++run, ask = want();
    $('irRow').hidden = $('events').hidden = true; $('callStamp').textContent = '';
    if (!ask) { $('react').hidden = true; $('name').textContent = 'Earnings calls'; $('sub').textContent = 'Search for a company to see its calls.'; $('callTable').innerHTML = ''; $('calls').hidden = true; MarketLab.menu(''); return; }
    const T = await trend().catch(() => null); if (me !== run) return;
    const up = ask.toUpperCase(), S = T && (T.series.find(x => x.id === ask) || T.series.find(x => x.id.toUpperCase() === up));
    const sym = S ? S.id : up, short = S && S.label.startsWith(sym + ' · ') ? S.label.slice(sym.length + 3) : sym;
    try { localStorage.setItem(LAST, sym); } catch (_) {}
    MarketLab.menu(sym);
    $('name').textContent = short; $('sub').textContent = sym + ' · Earnings calls'; document.title = `${short} earnings calls · Equinox`;
    const [calls, links, talk] = await Promise.all([
      json(`cube/calls/${encodeURIComponent(sym.toLowerCase())}.json`).catch(() => null),
      json(`company-links/${encodeURIComponent(sym)}.json`).catch(() => null),
      json(`call-guidance/${encodeURIComponent(sym)}.json`).catch(() => null)]);
    if (me !== run) return;
    said = talk && talk.calls || null;

    if (links && (web(links.ir) || web(links.results))) { $('irRow').hidden = false;
      $('irRow').innerHTML = (web(links.ir) ? a(links.ir, 'Investor relations site') : '') + (web(links.results) && links.results !== links.ir ? a(links.results, 'All quarterly results') : ''); }

    // one row per quarter, from both sources
    const Q = new Map();
    (calls && calls.calls || []).forEach(c => { const id = c.id.split(' ').slice(-2).join(' '); Q.set(id, { id, d: c.d, call: c }); });
    (links && links.quarters || []).forEach(q => { const r = Q.get(q.id) || { id: q.id, d: q.date }; r.doc = q; if (!r.d) r.d = q.date; Q.set(q.id, r); });
    const rows = [...Q.values()].sort((x, y) => (y.d || '').localeCompare(x.d || '') || y.id.localeCompare(x.id));
    $('calls').hidden = false;
    last = calls && calls.calls || []; $('react').hidden = !last.some(c => c.move && c.move.r1 != null); if (!$('react').hidden) EQ.reaction($('dots'), last, said);
    if (!rows.length) { $('callTable').innerHTML = `<tbody><tr><td class="left none">Equinox has no earnings calls for ${esc(sym)}.</td></tr></tbody>`; }
    else { const mv = v => v == null ? '<td></td>' : `<td class="num ${tone(v)}">${pct(v * 100)}</td>`, none = '<td class="docs none"></td>', say = (t, cls, quote) => t ? `<td class="docs said ${cls}" tabindex="0" title="${esc(quote || '')}">${esc(t)}</td>` : none;
      $('callTable').innerHTML = `<thead><tr><th class="left">Quarter</th><th>Date</th><th class="left">Transcript</th><th class="left">Slides</th><th class="left">Press release</th><th class="left" title="Results against the forecast management gave before the quarter, in their own words on the call">Vs their forecast</th><th class="left" title="What management did to its forecast on the call">Guidance</th><th title="Stock move on the first trading day after the call">Next day</th><th>5 days</th></tr></thead><tbody>` +
        rows.map(r => { const [fy, fq] = r.id.split(' '), c = r.call || {}, q = r.doc || {}, m = c.move || {}, s = said && said[r.id] || {};
          const tr = web(q.transcript) ? q.transcript : web(c.url) && !host(c.url).endsWith('huggingface.co') ? c.url : '';
          const kind = q.slides_kind && q.slides_kind !== 'slides' ? cap(q.slides_kind) : 'Slides';
          return `<tr data-q="${esc(r.id)}"><th scope="row" class="left" style="font-weight:400">${esc(fq)} fiscal ${esc(fy)}</th><td class="num soft">${r.d ? day(r.d) : ''}</td>` +
            (tr ? `<td class="docs">${a(tr, source(tr))}</td>` : none) +
            (web(q.slides) && q.slides_ok !== false ? `<td class="docs">${a(q.slides, kind)}</td>` : none) +
            (web(q.release) && q.release_ok !== false ? `<td class="docs">${a(q.release, 'Release')}</td>` : none) +
            say(s.beat && cap(s.beat), s.beat === 'above' ? 'up' : 'down', s.bq) + say(s.g && cap(s.g) + (s.amt ? ' ' + s.amt : ''), s.g === 'raised' ? 'up' : s.g === 'cut' ? 'down' : 'soft', s.gq) +
            mv(m.r1) + mv(m.r5) + '</tr>'; }).join('') + '</tbody>';
      if (calls && calls.updated) $('callStamp').textContent = 'Updated ' + day(calls.updated);
      // arriving from an E on the price chart: show that call
      let hit = ''; try { hit = new URLSearchParams(location.search).get('q') || ''; } catch (_) {}
      const tr = hit && [...$('callTable').querySelectorAll('tr[data-q]')].find(x => x.dataset.q === hit);
      if (tr) { tr.classList.add('hit'); tr.scrollIntoView({ block: 'center' }); } }

    const E = (links && links.events || []).filter(e => web(e.url) && e.ok !== false).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    $('events').hidden = !E.length;
    if (E.length) $('eventTable').innerHTML = `<thead><tr><th class="left">Event</th><th>Date</th><th class="left">Link</th></tr></thead><tbody>` +
      E.map(e => `<tr><th scope="row" class="left" style="font-weight:400">${esc(e.title)}</th><td class="num soft">${e.date ? (e.date_approx ? e.date.slice(0, 4) : day(e.date)) : ''}</td><td class="docs">${a(e.url, cap(e.kind || 'Open'))}</td></tr>`).join('') + '</tbody>';
  }
  addEventListener('hashchange', () => { scrollTo(0, 0); load(); });
  load();
})();
