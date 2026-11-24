/* Indexes and volume: the two index sections are drawn by market-lab-index-weights.js and market-lab-index-history.js.
   This file adds the basket volume table. */
(() => {
  const { $, day, esc, json, fail, sortable } = EQ;
  json('cube/basket-volume.json').then(D => {
    const rows = (D.rows || []).filter(r => r.accel5d != null), max = Math.max(1, ...rows.map(r => r.accel5d)), x = v => v == null ? '' : v.toFixed(2) + '×';
    $('bvStamp').textContent = 'Updated ' + day(D.as_of);
    $('bvTable').tHead.innerHTML = `<tr><th data-k="label"><button type="button">Basket</button></th><th data-k="group" class="left"><button type="button">Group</button></th><th data-k="accel5d" title="Dollar volume over the past 5 sessions divided by the usual pace over the prior year"><button type="button">5-day pace</button></th><th></th><th data-k="spike1d" title="Latest day's dollar volume divided by the usual pace"><button type="button">Latest day</button></th><th class="left" title="The stocks with the largest share of the basket's recent dollar volume">Most of the volume</th></tr>`;
    sortable($('bvTable'), rows, r => `<tr><td class="left"><a class="link" style="color:var(--ink)" href="market-lab-theme-board.html#${encodeURIComponent(r.id)}">${esc(r.label)}</a></td><td class="left soft">${esc(r.group || '')}</td><td class="num">${x(r.accel5d)}</td><td class="bar"><i style="transform:scaleX(${(r.accel5d / max).toFixed(3)})"></i></td><td class="num soft">${x(r.spike1d)}</td><td class="left soft">${(r.drivers || []).map(d => `${esc(d.symbol)} ${Math.round(d.share * 100)}%`).join(', ')}</td></tr>`,
      { k: 'accel5d', dir: 1, key: 'equinox.indexes.volume.sort.v1', cols: { label: r => r.label, group: r => r.group || '', accel5d: r => r.accel5d, spike1d: r => r.spike1d } });
  }).catch(() => fail($('bvTable').tBodies[0]));
  EQ.spy();
})();
