/* Data center capacity: page tidy-up that runs after the chart scripts.
   - one figures table at a time (key equinox.capacity.table.v1)
   - capex amount and capex growth share one slot (key equinox.capacity.capex.v1)
   - friendlier "Updated" date */
(function () {
  const get = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

  const stamp = document.querySelector('.capacity-updated');
  if (stamp) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(stamp.textContent);
    if (m) stamp.textContent = 'Updated ' + new Date(m[1] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---- capex: amount or growth ----
  const amount = document.getElementById('capexPanel'), growth = document.getElementById('capexGrowthPanel');
  if (amount && growth) {
    const KEY = 'equinox.capacity.capex.v1';
    const segs = [];
    const show = which => {
      amount.hidden = which === 'growth';
      growth.hidden = which !== 'growth';
      segs.forEach(s => s.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === which))));
      set(KEY, which);
    };
    [amount, growth].forEach(p => {
      const h = p.querySelector('h2'); if (h) h.textContent = 'Capex';
      const seg = document.createElement('div');
      seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Amount or growth');
      [['amount', 'Amount'], ['growth', 'Growth']].forEach(([v, label]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.v = v; b.textContent = label;
        b.addEventListener('click', () => show(v));
        seg.appendChild(b);
      });
      const ctl = p.querySelector('.comp-controls');
      if (ctl) ctl.insertBefore(seg, ctl.firstChild);
      segs.push(seg);
    });
    show(get(KEY) === 'growth' ? 'growth' : 'amount');
  }

  // ---- figures: tabs ----
  const figures = document.querySelector('.figures');
  if (figures) {
    const KEY = 'equinox.capacity.table.v1';
    const panels = [...figures.querySelectorAll('.figures-panel')];
    const names = { actualsTable: 'Estimates vs actuals', capexTable: 'Capex', capacityTable: 'Capacity', capacityQuarterTable: 'Quarterly capacity', cloudTable: 'Cloud', backlogTable: 'Backlog', fcfTable: 'Free cash flow' };
    const idOf = p => (p.querySelector('[id$="Table"]') || {}).id || '';
    const nav = document.createElement('div');
    nav.className = 'cap-tabs'; nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Choose a table');
    const title = document.createElement('h2'); title.textContent = 'Figures'; nav.appendChild(title);
    const pick = id => {
      panels.forEach(p => { p.hidden = idOf(p) !== id; });
      nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      set(KEY, id);
    };
    panels.forEach(p => {
      const id = idOf(p), b = document.createElement('button');
      b.type = 'button'; b.dataset.id = id;
      b.textContent = names[id] || (p.querySelector('h2') || {}).textContent || id;
      b.addEventListener('click', () => pick(id));
      nav.appendChild(b);
    });
    figures.insertBefore(nav, figures.firstChild);
    figures.classList.add('tabbed');
    const saved = get(KEY);
    pick(panels.some(p => idOf(p) === saved) ? saved : idOf(panels[0]));
  }

  const ag = document.querySelector('.agreements-panel h2');
  if (ag) ag.textContent = 'Rental agreements';
  const rw = document.querySelector('.rental-panel h2');
  if (rw) rw.textContent = 'Revenue per watt';
})();
