/* Shared presentation only. Calculations and data loading belong to each page. */
window.MarketLabReadJSON = async function(response){const bytes=new Uint8Array(await response.arrayBuffer());return JSON.parse(bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes));};
// One ticker per company: an old GOOG link opens GOOGL. Runs before any page reads the address.
try { if (/^#GOOG$/i.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#GOOGL'); } catch (_) {}
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'market-lab.appearance.v1';
  let appearance = 'light';
  try { appearance = localStorage.getItem(key) || appearance; } catch (_) {}
  root.dataset.theme = appearance === 'dark' ? 'dark' : 'light';
  // Older pages get the bar styles through market-lab-shell.css. A browser holding an
  // old copy of that file would draw the bar unstyled, so the bar brings its own sheet.
  if (!document.querySelector('link[href*="market-lab-bar.css"]')) {
    const bar = document.createElement('link'); bar.rel = 'stylesheet'; bar.href = 'market-lab-bar.css'; bar.blocking = 'render';
    const shell = document.querySelector('link[href*="market-lab-shell.css"]');
    if (shell) shell.before(bar); else document.head.append(bar);
  }
  // Sites canonicalizes static pages to extensionless URLs; local previews
  // retain .html. Both must choose the same CSS scope and page initializer.
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const route = pathname.match(/(?:^|\/)market-lab(?:-([\w-]+))?(?:\.html)?$/);
  const aliases = {'/macro':'macro','/macro.html':'macro','/theme-returns':'themes','/theme-returns.html':'themes'};
  const page = route ? (route[1] || 'studies') : (aliases[pathname] || 'themes');
  // New pages carry <html data-eq>. They use the shared bar and theme only.
  const eq = root.hasAttribute('data-eq');
  const home = !eq && (page === 'home' || root.dataset.workspace === 'home');
  if (!eq) {
    root.dataset.page = home ? 'themes' : page;
    root.dataset.workspace = home ? 'home' : 'charts';
  }
  // A page that is leaving must not build its header: the body may not exist yet.
  let leaving = false;
  const leave = url => { leaving = true; location.replace(url); };
  const hash = location.hash;
  if (page === 'themes' && /^#(?:sectors:|baskets:)/.test(hash)) leave('market-lab-theme-returns.html'+hash);
  if (!leaving && home && hash.includes('|')) leave('market-lab-themes.html'+hash);
  // Old Home bookmarks: the page at this address is now Today.
  if (!leaving && eq && page === 'home' && hash.length > 1 && !document.getElementById(hash.slice(1))) {
    const moved = {'#home-momentum':'market-lab-movers.html','#home-rsi-lows':'market-lab-movers.html#laggards'};
    if (hash.includes('|')) leave('market-lab-themes.html'+hash);
    else if (moved[hash]) leave(moved[hash]);
    else if (!/^#(?:week|indexes|breadth|warnings|sectors|volume|earnings)$/.test(hash)) leave('market-lab-theme-returns.html'+hash);
  }
  const colors = () => {
    const css = getComputedStyle(root);
    return Object.fromEntries(['bg','surface','raised','ink','muted','faint','border','accent','up','down']
      .map(name => [name, css.getPropertyValue('--ml-' + name).trim()]));
  };
  function setTheme(value) {
    root.dataset.theme = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    const next = value === 'dark' ? 'Light mode' : 'Dark mode';
    document.querySelectorAll('[data-eq-appearance]').forEach(button => {
      if (button.classList.contains('eq-sun')) { button.setAttribute('aria-label', next); button.title = next; }
      else button.textContent = next;
    });
    window.dispatchEvent(new CustomEvent('ml:themechange', {detail:{theme:value}}));
  }
  function styledSVG(svg) {
    const clone = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    const properties = ['fill','stroke','stroke-width','font-family','font-size','font-weight','opacity','display','visibility'];
    originals.forEach((node, i) => {
      const css = getComputedStyle(node);
      properties.forEach(property => copies[i].style.setProperty(property, css.getPropertyValue(property)));
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return clone;
  }
  function contrastText(hex) {
    const rgb = hex.replace('#','').match(/../g).map(v => parseInt(v,16)/255);
    const linear = rgb.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722 > .35 ? '#13202b' : '#f0f5f9';
  }
  window.MarketLab = {colors, setTheme, styledSVG, contrastText};

  // One list drives the bar on every page.
  // [section, label, landing page, [[page id, label, href, group heading?], ...], shown in the bar ('left') or not ('')]
  // A fourth value on a page starts a named group. The Company button opens the screener; the pages under it open the last company viewed (see coLinks).
  const sections = [
    ['today','Today','market-lab-home.html',[],'left'],
    ['company','Company','market-lab-company.html',[
      ['company','Overview','market-lab-company.html'],
      ['financials','Financials','market-lab-financials.html'],
      ['company-calls','Earnings calls','market-lab-company-calls.html'],
      ['company-guidance','Guidance','market-lab-company-guidance.html']],'left'],
    ['markets','Markets','market-lab-movers.html',[
      ['movers','Leaders','market-lab-movers.html','Stocks'],
      ['laggards','Laggards','market-lab-movers.html#laggards'],
      ['leaders','Full ranking','market-lab-leaders.html'],
      ['themes','Charts','market-lab-themes.html','Market'],
      ['markets','Overview','market-lab-markets.html'],
      ['analytics','Analytics','market-lab-analytics.html'],
      ['heatmaps','Heatmaps','market-lab-heatmaps.html'],
      ['macro','Macro','market-lab-macro.html'],
      ['drawdowns','Drawdowns','market-lab-drawdowns.html']],'left'],
    ['themes','Themes','market-lab-theme-board.html',[
      ['theme-board','All themes','market-lab-theme-board.html'],
      ['theme-returns','Indexes and volume','market-lab-theme-returns.html'],
      ['baskets','Basket members','market-lab-baskets.html'],
      ['citrini','Citrini ideas','market-lab-citrini.html'],
      ['hatedm7','Most-hated Mag 7','market-lab-hatedm7.html']],'left'],
    ['comps','Comps','market-lab-comps.html',[],'left'],
    ['research','Research','market-lab-industry.html',[
      ['industry','Industry','market-lab-industry.html'],
      ['capacity','Data center capacity','market-lab-capacity.html'],
      ['notebook','Notebook','market-lab-notebook.html']],'left'],
  ];
  // Pages that are not in a list still belong to a section.
  const belongs = {home:'today', comps:'comps', calls:'research', research:'research', lows:'markets'};
  const more = sections.flatMap(section => section[3]);
  const current = sections.find(section => section[3].some(([id]) => id === page)) || sections.find(section => section[0] === belongs[page]);
  // Laggards is a part of the Leaders page, so the address decides which of the two is open.
  const here = () => page === 'movers' && location.hash === '#laggards' ? 'laggards' : page;
  // The left menu: the pages of this section, with the open page's own sections nested under it.
  // Company pages pass the open ticker so every page in the Company menu stays on that company.
  const LAST = 'equinox.company.last.v1';
  // Overview, Financials, Earnings calls and Guidance in the bar open the last company viewed, or the screener before any has been opened.
  function coLinks() {
    let t = ''; try { t = localStorage.getItem(LAST) || ''; } catch (_) {}
    document.querySelectorAll('.eq-bar a[data-co]').forEach(a => { a.href = a.dataset.co + (t ? '#' + encodeURIComponent(t) : ''); });
  }
  addEventListener('pageshow', coLinks);
  let asked;
  function menu(ticker) {
    if (ticker !== undefined) asked = ticker; else ticker = asked;
    if (!document.querySelector('.ml-header')) return null;
    let el = document.querySelector('.eq-menu');
    if (!el) {
      el = document.createElement('aside'); el.className = 'eq-menu';
      el.innerHTML = '<nav class="eq-pages" aria-label="Pages in this section"></nav>';
      document.querySelector('.ml-header').after(el);
    }
    const nav = el.firstElementChild, side = document.querySelector('nav.side');
    const inCompany = current && current[0] === 'company';
    coLinks();
    if (inCompany && ticker === undefined) { ticker = ''; if (page !== 'company') try { ticker = localStorage.getItem(LAST) || ''; } catch (_) {} }
    const open = here(), nodes = [];
    const links = (current ? current[3] : []).map(([id, label, href, group]) => {
      if (group) { const head = document.createElement('p'); head.className = 'eq-group'; head.textContent = group; nodes.push(head); }
      const a = document.createElement('a'); a.textContent = label;
      a.href = href + (inCompany && ticker ? '#' + encodeURIComponent(ticker) : '');
      if (open === id && !(page === 'company' && !ticker)) a.setAttribute('aria-current', 'page');
      nodes.push(a);
      return a;
    });
    nav.replaceChildren(...nodes);
    if (side) { const on = nav.querySelector('[aria-current]'); if (on) on.after(side); else nav.prepend(side); side.classList.toggle('solo', !links.length); }
    return el;
  }
  window.MarketLab.menu = menu;
  const text = value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // Company search: the name list loads on first focus, then stays in memory.
  function setupSearch(form) {
    const input = form.querySelector('input'), list = form.querySelector('ul');
    let names = null, loading = null, active = -1, shown = [];
    const load = () => loading || (loading = fetch('cube/trend-index.json').then(window.MarketLabReadJSON).then(index => {
      names = index.series.filter(s => s.kind === 'equity' || s.kind === 'asset').map(s => {
        const cut = s.label.indexOf(' · ');
        return {id:s.id, name:cut < 0 ? '' : s.label.slice(cut + 3), key:(s.label + ' ' + (s.aliases || []).join(' ')).toLowerCase()};
      });
    }).catch(() => { names = []; }));
    const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded','false'); };
    const go = id => { close(); input.value = ''; input.blur(); location.href = 'market-lab-company.html#' + encodeURIComponent(id); if (page === 'company') window.dispatchEvent(new Event('hashchange')); };
    const paint = () => {
      const q = input.value.trim().toLowerCase();
      if (!q || !names) return close();
      const rank = n => n.id.toLowerCase() === q ? 0 : n.id.toLowerCase().startsWith(q) ? 1 : n.name.toLowerCase().startsWith(q) ? 2 : n.key.includes(q) ? 3 : 9;
      shown = names.map(n => [rank(n), n]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || a[1].id.length - b[1].id.length || a[1].id.localeCompare(b[1].id)).slice(0, 8).map(x => x[1]);
      if (!shown.length) return close();
      active = 0;
      list.innerHTML = shown.map((n, i) => `<li role="option" data-i="${i}"${i ? '' : ' aria-selected="true"'}><b>${text(n.id)}</b><span>${text(n.name)}</span></li>`).join('');
      list.hidden = false; input.setAttribute('aria-expanded','true');
    };
    const mark = () => [...list.children].forEach((li, i) => i === active ? li.setAttribute('aria-selected','true') : li.removeAttribute('aria-selected'));
    input.addEventListener('focus', () => load().then(paint));
    input.addEventListener('input', () => load().then(paint));
    input.addEventListener('keydown', event => {
      if (list.hidden) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; mark(); }
      if (event.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    list.addEventListener('pointerdown', event => { const li = event.target.closest('li'); if (li) { event.preventDefault(); go(shown[+li.dataset.i].id); } });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const typed = input.value.trim(); if (!typed) return;
      load().then(() => { paint(); go(shown[Math.max(active, 0)] ? shown[Math.max(active, 0)].id : typed.toUpperCase()); });
    });
  }

  function start() {
    if (leaving || !document.body) return;
    if (!eq) document.body.classList.add('ml-app');
    const sub = current && current[3].length ? current[3] : null;
    if (!eq && !document.querySelector('link[data-eq-font]')) {
      const font = document.createElement('link'); font.rel = 'stylesheet'; font.dataset.eqFont = '';
      font.href = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap';
      document.head.append(font);
    }
    if (!document.querySelector('link[rel~="icon"]')) {
      const icon = document.createElement('link'); icon.rel = 'icon'; icon.type = 'image/svg+xml'; icon.href = 'equinox-logo.svg';
      document.head.append(icon);
    }
    const open = here();
    const coIds = new Set(sections.find(section => section[0] === 'company')[3].map(([id]) => id));
    const co = (id, href) => coIds.has(id) ? ` data-co="${href}"` : '';
    const link = ([id, label, href]) => `<a href="${href}" data-id="${id}"${co(id, href)}${id === open ? ' aria-current="page"' : ''}>${label}</a>`;
    const groups = items => items.reduce((out, item) => { if (item[3] || !out.length) out.push([item[3] || '', []]); out[out.length - 1][1].push(item); return out; }, []);
    const on = section => section === current ? ` aria-current="${section[3].length && open !== section[3][0][0] ? 'true' : 'page'}"` : '';
    const button = section => !section[3].length
      ? `<a class="eq-btn" href="${section[2]}"${on(section)}>${section[1]}</a>`
      : `<div class="eq-sec"><a class="eq-btn" href="${section[2]}" aria-haspopup="true" aria-expanded="false"${on(section)}>${section[1]}</a>
          <div class="eq-panel"><div class="eq-sheet">${groups(section[3]).map(([name, items]) => `<div class="eq-list">${name ? `<p class="eq-head">${name}</p>` : ''}${items.map(link).join('')}</div>`).join('')}</div></div></div>`;
    const shown = sections.filter(section => section[4]);
    const row = where => shown.filter(section => section[4] === where).map(button).join('');
    const header = document.createElement('header');
    header.className = 'ml-header eq-bar';
    // The word and the mark share one spot: the word shows at the top of the page, the mark once it scrolls.
    header.innerHTML = `<div class="eq-row"><div class="eq-in">
      <div class="eq-start"><div class="eq-sec eq-all"><button type="button" class="eq-btn" aria-haspopup="true" aria-expanded="false">Menu</button>
          <div class="eq-panel"><div class="eq-sheet">${shown.map(section => `<div class="eq-list"><a class="eq-head" href="${section[2]}">${section[1]}</a>${section[3].map(link).join('')}</div>`).join('')}
            <div class="eq-list"><button type="button" class="eq-text" data-eq-appearance></button></div></div></div></div>
        <nav class="eq-nav" aria-label="Main">${row('left')}</nav></div>
      <a class="eq-brand" href="market-lab-home.html" aria-label="Equinox, go to Today"><span class="eq-word">Equinox</span><svg class="eq-mark" viewBox="0 0 1000 1025" aria-hidden="true" focusable="false"><path class="eq-mark-top" d="M0 500 A500 500 0 0 1 1000 500 Z"/><path class="eq-mark-low" d="M1000 525 A500 500 0 0 1 0 525 Z"/></svg></a>
      <div class="eq-end">
        <button type="button" id="ml-sidebar-toggle" class="eq-text" aria-expanded="false" hidden></button>
        <form class="eq-search" role="search"><input type="search" placeholder="Search a company" aria-label="Search a company" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="eq-search-list"><ul id="eq-search-list" role="listbox" hidden></ul></form>
        <button type="button" id="ml-appearance" class="eq-sun" data-eq-appearance><svg viewBox="0 0 1000 1025" aria-hidden="true" focusable="false"><path class="eq-mark-top" d="M0 500 A500 500 0 0 1 1000 500 Z"/><path class="eq-mark-low" d="M1000 525 A500 500 0 0 1 0 525 Z"/></svg></button></div></div></div>`;
    document.body.prepend(header);
    coLinks();
    setupMenus(header);
    const side = menu();
    if (page === 'baskets') side.insertAdjacentHTML('beforeend', '<aside id="ml-basket-rail" class="eq-tools" aria-label="Baskets"></aside>');
    setupSearch(header.querySelector('.eq-search'));
    header.querySelectorAll('[data-eq-appearance]').forEach(button => { button.onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); });
    const toggle = document.getElementById('ml-sidebar-toggle');
    if (eq) { setTheme(root.dataset.theme); return; }
    // Filters and pickers now sit in the left menu and stay open, so the old show/hide
    // button is unused. Its saved choice (market-lab.sidebar.<page>) is left in place.
    const shade = document.createElement('button');
    shade.type = 'button'; shade.className = 'ml-sidebar-shade'; shade.setAttribute('aria-label','Close sidebar');
    shade.onclick = () => { document.body.classList.remove('ml-sidebar-open'); toggle.setAttribute('aria-expanded','false'); };
    document.body.append(shade);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.ml-choice[open]').forEach(el => {
          if(el.contains(document.activeElement))el.querySelector('summary')?.focus();
          el.removeAttribute('open');
        });
        shade.click();
      }
    });
    document.addEventListener('click', event => {
      document.querySelectorAll('.ml-choice[open]').forEach(el => {
        if (!el.contains(event.target)) el.removeAttribute('open');
      });
    });
    if (page === 'themes' || home) setupCharts();
    if (page === 'macro') {
      const latest=document.getElementById('latest');
      document.querySelector('.card.details').append(latest);
    }
    if (page === 'leaders') setupLeaders();
    if (page === 'weekend') setupReviews();
    if (['drawdowns','studies'].includes(page)) setupResearch();
    // A page's own picker or filter column moves into the left menu, under the page list.
    if (!home) document.querySelectorAll(':is(.shell,.layout)>:is(aside,nav,div):is(.rail,#rail),.ml-context-rail').forEach(rail => { rail.classList.add('eq-tools'); side.append(rail); });
    setTheme(root.dataset.theme);
    window.dispatchEvent(new Event('resize'));
  }

  // Section menus open on hover, on keyboard focus and on tap. They close on Escape, on a click
  // elsewhere, and a moment after the pointer leaves so a short slip does not shut them.
  function setupMenus(header) {
    const all = [...header.querySelectorAll('.eq-sec')];
    let timer = 0, tapped = null, quiet = false;
    const set = (sec, on) => { sec.classList.toggle('open', on); sec.querySelector('.eq-btn').setAttribute('aria-expanded', String(on)); };
    const show = sec => { clearTimeout(timer); all.forEach(other => set(other, other === sec)); };
    const hide = () => { clearTimeout(timer); all.forEach(sec => set(sec, false)); };
    const later = () => { clearTimeout(timer); timer = setTimeout(hide, 220); };
    all.forEach(sec => {
      const btn = sec.querySelector('.eq-btn'), isLink = btn.tagName === 'A';
      sec.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && isLink) show(sec); });
      sec.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && isLink) later(); });
      sec.addEventListener('focusin', event => { if (!quiet && (isLink || event.target !== btn)) show(sec); });
      sec.addEventListener('focusout', event => { if (!sec.contains(event.relatedTarget)) later(); });
      // A finger has no hover: the first tap opens the list, the second follows the link.
      btn.addEventListener('pointerdown', event => { tapped = event.pointerType !== 'mouse' && !sec.classList.contains('open') ? sec : null; });
      btn.addEventListener('click', event => {
        if (!isLink) { if (sec.classList.contains('open')) hide(); else show(sec); return; }
        if (tapped === sec) { event.preventDefault(); show(sec); }
        tapped = null;
      });
      sec.addEventListener('keydown', event => {
        const links = [...sec.querySelectorAll('.eq-panel a,.eq-panel button')], at = links.indexOf(document.activeElement);
        if (event.key === 'Escape') { hide(); quiet = true; btn.focus(); quiet = false; event.stopPropagation(); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); show(sec); links[Math.min(at + 1, links.length - 1)].focus(); }
        else if (event.key === 'ArrowUp' && at >= 0) { event.preventDefault(); (at ? links[at - 1] : btn).focus(); }
      });
    });
    document.addEventListener('pointerdown', event => { if (!event.target.closest('.eq-sec')) hide(); });
    addEventListener('pagehide', hide);
    const scrolled = () => header.classList.toggle('eq-scrolled', (window.scrollY || root.scrollTop || document.body.scrollTop) > 24);
    addEventListener('scroll', scrolled, {passive:true}); scrolled();
    addEventListener('hashchange', () => {
      const open = here();
      header.querySelectorAll('.eq-panel a[data-id]').forEach(a => { if (a.dataset.id === open) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      if (page === 'movers') menu();
    });
  }

  function setupCharts() {
    const main = document.querySelector('main.main');
    const search = document.getElementById('q');
    const searchBox = document.createElement('label');
    searchBox.className = 'ml-search';
    searchBox.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.6"/></svg>';
    const railHead = document.querySelector('.rail .rh');
    searchBox.append(search); railHead.querySelector('h2').after(searchBox);
    document.querySelector('.mast h1').textContent = home ? 'Theme returns' : 'Charts';
    const measure=makeChoice('modes','Cumulative %');
    measure.id='chart-measure';
    const controlRows = [...document.querySelectorAll('.theme-controls')];
    const toolbar=document.querySelector('.chartbar');
    toolbar.classList.add('ml-chart-controls','theme-controls');
    toolbar.setAttribute('aria-label','Chart controls');
    const period=makeChoice('spans','Custom dates');
    period.id='chart-period';
    const dates=document.getElementById('d1').closest('.cgrp');
    dates.classList.add('ml-custom-dates');
    const clearDateErrors=()=>dates.querySelectorAll('.date-input').forEach(input=>{
      input.classList.remove('invalid');input.setAttribute('aria-invalid','false');
    });
    document.getElementById('spans').addEventListener('click',e=>{if(e.target.closest('button'))clearDateErrors();});
    const timePanel=document.createElement('div');timePanel.className='ml-chart-popover';
    const dateLabel=document.createElement('div');dateLabel.className='ml-menu-label';dateLabel.textContent='Custom dates';
    const applyDates=document.createElement('button');applyDates.type='button';applyDates.className='chart-action ml-apply-dates';applyDates.textContent='Apply dates';
    applyDates.addEventListener('click',()=>{
      dates.querySelector('#d2 [data-part="year"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      if(!dates.querySelector('[aria-invalid="true"]'))period.open=false;
    });
    timePanel.append(document.getElementById('spans'),dateLabel,dates,applyDates,document.getElementById('anchors'));
    period.append(timePanel);
    const menu=(id,label,nodes)=>{
      const wrapper=document.createElement('details');wrapper.className='ml-choice ml-chart-menu';wrapper.id=id;
      const summary=document.createElement('summary');summary.textContent=label;
      const content=document.createElement('div');content.className='ml-chart-popover';
      content.append(...nodes);wrapper.append(summary,content);return wrapper;
    };
    const options=menu('chart-options','Options',['benchwrap','corrwin','pebasis','pewhy'].map(id=>document.getElementById(id)));
    const detail=menu('chart-details','Details',[document.getElementById('stock-detail-actions')]);
    const actions=menu('chart-actions','More',[document.getElementById('savebasket'),document.getElementById('downloadchart'),document.getElementById('cloudstatus')]);
    actions.querySelector('summary').setAttribute('aria-label','Chart actions');
    actions.querySelector('#downloadchart').textContent='Download PNG';
    const analogNode=document.getElementById('analogwrap');
    const analogs=analogNode?menu('chart-analogs','Past period',[analogNode]):null;
    const reset=document.getElementById('stock-chart-reset'),overlay=document.getElementById('stock-chart-overlays'),readout=document.getElementById('readout');
    toolbar.replaceChildren(...[period,measure,overlay,analogs,options,document.getElementById('stock-chart-measure'),reset,detail,actions,readout].filter(Boolean));
    document.querySelector('.mast').after(toolbar);
    controlRows.forEach(row=>row.remove());
    document.getElementById('anchor').setAttribute('aria-label','Price anchor');
    document.getElementById('bench').setAttribute('aria-label','Comparison benchmark');
    [detail,actions].forEach(wrapper=>wrapper.addEventListener('click',e=>{if(e.target.closest('button'))wrapper.open=false;}));
    document.getElementById('anchor').addEventListener('change',()=>{clearDateErrors();period.open=false;});
    [period,measure,analogs,options,detail,actions].filter(Boolean).forEach(wrapper=>{
      wrapper.addEventListener('toggle',()=>{
        if(!wrapper.open)return;
        toolbar.querySelectorAll('.ml-choice[open]').forEach(other=>{if(other!==wrapper)other.open=false;});
        const panel=wrapper.querySelector(':scope > .ml-chart-popover,:scope > .cgrp');
        panel.style.left='0px';
        const box=panel.getBoundingClientRect();
        panel.style.left=Math.min(0,innerWidth-12-box.right)+'px';
      });
    });
    // Keep the two heatmaps together, above the ticker details.
    document.getElementById('seas').parentElement.previousElementSibling.querySelector('.lbl').textContent='Seasonality · Average by month';
  }
  function makeChoice(id, fallback) {
    const content = document.getElementById(id);
    if (!content) return;
    const wrapper = document.createElement('details'); wrapper.className = 'ml-choice';
    const summary = document.createElement('summary'); summary.textContent = fallback;
    wrapper.append(summary); content.before(wrapper); wrapper.append(content);
    const sync = () => {
      const label=content.querySelector('button.on')?.textContent || fallback;
      if(summary.textContent!==label)summary.textContent=label;
      summary.setAttribute('aria-label',(id==='spans'?'Timeframe: ':'Chart measure: ')+label);
    };
    wrapper.addEventListener('toggle', sync);
    content.addEventListener('click', event => {
      if (event.target.closest('button')) { sync(); wrapper.open = false; }
    });
    new MutationObserver(sync).observe(content,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
    sync();
    return wrapper;
  }
  function sideRail(title, host) {
    const rail = document.createElement('aside'); rail.className = 'ml-context-rail';
    const heading = document.createElement('h2'); heading.textContent = title;
    rail.append(heading); host.before(rail); document.body.classList.add('ml-has-context');
    return rail;
  }
  function railSection(rail, label, node) {
    const section = document.createElement('section'); section.className = 'ml-rail-section';
    const heading = document.createElement('h3'); heading.textContent = label;
    section.append(heading,node); rail.append(section);
  }
  function setupLeaders() {
    const rail = sideRail('Universe',document.querySelector('main.main'));
    const unis = document.getElementById('unis');
    rail.append(unis);
    ['sector','theme'].forEach(id => {
      const select = document.getElementById(id);
      select.setAttribute('aria-label', id === 'sector' ? 'Sector filter' : 'Theme filter');
      railSection(rail,id === 'sector' ? 'Sectors' : 'Themes',select);
    });
    rail.append(document.getElementById('clearwrap'));
    // Keep all existing universes and ranks. Only their placement changes.
    document.getElementById('views').classList.add('ml-segmented');
  }
  function setupReviews() {
    const rail = sideRail('Reviews',document.querySelector('.page'));
    const nav = document.createElement('nav'); nav.setAttribute('aria-label','Review sections');
    nav.innerHTML = [['Latest review','.mast'],['Weekly editions','#weeklyedition'],['Risk appetite','#risk'],['Participation','#participation'],['Indexes','#indexes'],['Themes','#themes'],['Volume','#volume'],['High tight flags','#flags']]
      .map(([name,selector]) => `<button type="button" data-scroll="${selector}">${name}</button>`).join('');
    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-scroll]'); if (!button) return;
      document.querySelector(button.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});
      document.body.classList.remove('ml-sidebar-open');
    });
    rail.append(nav);
    const archive = document.createElement('a'); archive.href='#weeklyedition'; archive.textContent='Saved editions';
    railSection(rail,'History',archive);
    // Use the existing edition picker and its validated archive, not invented preview dates.
    const picker = document.getElementById('editionselect');
    rail.lastElementChild.append(picker);
  }
  function setupResearch() {
    const host = document.querySelector('.wrap');
    const top = host.querySelector('.top .meta');
    if (top) [...top.childNodes].forEach(node => { if (node.nodeType===3 || node.tagName==='A') node.remove(); });
    if(page==='studies') {
      // The bar's second row lists the research tools, so this page needs no side rail.
      host.querySelector('h1').textContent='Historical studies';
      document.body.classList.add('ml-has-context','ml-no-rail');
    }
    if(page==='drawdowns') {
      const rail = sideRail('Drawdowns',host);
      const tabs=document.getElementById('tabs'); railSection(rail,'Index',tabs);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
