/* Shared presentation only. Calculations and data loading belong to each page. */
window.MarketLabReadJSON = async function(response){const bytes=new Uint8Array(await response.arrayBuffer());return JSON.parse(bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes));};
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'market-lab.appearance.v1';
  let appearance = 'dark';
  try { appearance = localStorage.getItem(key) || appearance; } catch (_) {}
  root.dataset.theme = appearance === 'light' ? 'light' : 'dark';
  // Sites canonicalizes static pages to extensionless URLs; local previews
  // retain .html. Both must choose the same CSS scope and page initializer.
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const route = pathname.match(/(?:^|\/)market-lab(?:-([\w-]+))?(?:\.html)?$/);
  const aliases = {'/macro':'macro','/macro.html':'macro','/theme-returns':'themes','/theme-returns.html':'themes'};
  const page = route ? (route[1] || 'studies') : (aliases[pathname] || 'themes');
  const home = page === 'home' || root.dataset.workspace === 'home';
  root.dataset.page = home ? 'themes' : page;
  root.dataset.workspace = home ? 'home' : 'charts';
  if (page === 'themes' && /^#(?:sectors:|baskets:)/.test(location.hash)) location.replace('market-lab-home.html'+location.hash);
  if (home && location.hash.includes('|')) location.replace('market-lab-themes.html'+location.hash);
  const colors = () => {
    const css = getComputedStyle(root);
    return Object.fromEntries(['bg','surface','raised','ink','muted','faint','border','accent','up','down']
      .map(name => [name, css.getPropertyValue('--ml-' + name).trim()]));
  };
  function setTheme(value) {
    root.dataset.theme = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    const button = document.getElementById('ml-appearance');
    if (button) {
      button.setAttribute('aria-pressed', String(value === 'dark'));
      button.setAttribute('aria-label', 'Dark mode');
      button.title = value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
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

  const links = [
    ['home','Home','market-lab-home.html'],
    ['brief','Brief','market-lab-brief.html'],
    ['themes','Charts','market-lab-themes.html'],
    ['leaders','Leaders','market-lab-leaders.html'],
    ['analytics','Analytics','market-lab-analytics.html'],
    ['macro','Macro','market-lab-macro.html'],
    ['weekend','Reviews','market-lab-weekend.html'],
  ];
  const more = [
    ['capacity','Data center capacity','market-lab-capacity.html'],
    ['baskets','Baskets','market-lab-baskets.html'],
    ['heatmaps','Heatmaps','market-lab-heatmaps.html'],
    ['drawdowns','Drawdowns','market-lab-drawdowns.html'],
    ['hatedm7','Most-hated Mag 7','market-lab-hatedm7.html'],
    ['rates','QQQ vs 10-yr yield','market-lab-rates.html'],
    ['studies','Historical studies','market-lab.html'],
  ];
  const navLink = ([id,label,href]) => `<a href="${href}"${page === id ? ' aria-current="page"' : ''}>${label}</a>`;
  function start() {
    document.body.classList.add('ml-app');
    const header = document.createElement('header');
    header.className = 'ml-header';
    header.innerHTML = `<a class="ml-brand" href="market-lab-home.html">Equinox${['127.0.0.1','localhost'].includes(location.hostname)?'<span class="ml-fork-mark" title="Independent redesign preview">preview</span>':''}</a>
      <nav class="ml-nav" aria-label="Main navigation">${links.map(navLink).join('')}
        <details class="ml-more"><summary${more.some(([id]) => id === page) ? ' class="ml-current"' : ''}>More <span>⌄</span></summary><div>${more.map(navLink).join('')}</div></details>
      </nav>
      <div class="ml-header-actions"><button type="button" id="ml-sidebar-toggle" aria-label="Toggle sidebar" aria-expanded="false">☰</button>
        <span class="ml-mode-label">Light</span><button type="button" id="ml-appearance" class="ml-switch" aria-label="Dark mode"><span></span></button><span class="ml-mode-label">Dark</span>
      </div>`;
    document.body.prepend(header);
    document.getElementById('ml-appearance').onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    const toggle = document.getElementById('ml-sidebar-toggle');
    const railKey='market-lab.sidebar.'+page;
    try { document.body.classList.toggle('ml-sidebar-collapsed',localStorage.getItem(railKey)==='closed'); } catch (_) {}
    toggle.onclick = () => {
      const mobile=matchMedia('(max-width:800px)').matches;
      const open = mobile ? document.body.classList.toggle('ml-sidebar-open') : !document.body.classList.toggle('ml-sidebar-collapsed');
      if(!mobile)try{localStorage.setItem(railKey,open?'open':'closed');}catch(_){}
      toggle.setAttribute('aria-expanded', String(open));
      window.dispatchEvent(new Event('resize'));
    };
    const shade = document.createElement('button');
    shade.type = 'button'; shade.className = 'ml-sidebar-shade'; shade.setAttribute('aria-label','Close sidebar');
    shade.onclick = () => { document.body.classList.remove('ml-sidebar-open'); toggle.setAttribute('aria-expanded','false'); };
    document.body.append(shade);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.ml-more[open], .ml-choice[open]').forEach(el => {
          if(el.contains(document.activeElement))el.querySelector('summary')?.focus();
          el.removeAttribute('open');
        });
        shade.click();
      }
    });
    document.addEventListener('click', event => {
      document.querySelectorAll('.ml-more[open], .ml-choice[open]').forEach(el => {
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
    if (['baskets','drawdowns','studies'].includes(page)) setupResearch();
    toggle.hidden=home||!document.querySelector('.rail,#rail,.ml-context-rail');
    toggle.textContent=page==='themes'?'Assets':'Filters';
    toggle.setAttribute('aria-label',page==='themes'?'Show or hide assets':'Show or hide filters');
    toggle.setAttribute('aria-expanded',String(!matchMedia('(max-width:800px)').matches&&!document.body.classList.contains('ml-sidebar-collapsed')));
    setTheme(root.dataset.theme);
    window.dispatchEvent(new Event('resize'));
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
    const reset=document.getElementById('stock-chart-reset'),overlay=document.getElementById('stock-chart-overlays'),readout=document.getElementById('readout');
    toolbar.replaceChildren(...[period,measure,overlay,options,document.getElementById('stock-chart-measure'),reset,detail,actions,readout].filter(Boolean));
    document.querySelector('.mast').after(toolbar);
    controlRows.forEach(row=>row.remove());
    document.getElementById('anchor').setAttribute('aria-label','Price anchor');
    document.getElementById('bench').setAttribute('aria-label','Comparison benchmark');
    [detail,actions].forEach(wrapper=>wrapper.addEventListener('click',e=>{if(e.target.closest('button'))wrapper.open=false;}));
    document.getElementById('anchor').addEventListener('change',()=>{clearDateErrors();period.open=false;});
    [period,measure,options,detail,actions].forEach(wrapper=>{
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
    const titles = {baskets:'Baskets',drawdowns:'Drawdowns',studies:'Research'};
    const rail = sideRail(titles[page],host);
    const nav = document.createElement('nav'); nav.setAttribute('aria-label','Research tools');
    nav.innerHTML = more.map(navLink).join(''); rail.append(nav);
    const top = host.querySelector('.top .meta');
    if (top) [...top.childNodes].forEach(node => { if (node.nodeType===3 || node.tagName==='A') node.remove(); });
    if(page==='studies') {
      host.querySelector('h1').textContent='Historical studies';
      const help = document.createElement('p'); help.className='ml-rail-note';
      help.textContent='Choose an asset, a condition and a holding period. Compare what happened next.';
      rail.append(help);
    }
    if(page==='drawdowns') {
      const tabs=document.getElementById('tabs'); railSection(rail,'Index',tabs);
    }
    if(page==='baskets') {
      rail.id='ml-basket-rail';
      const cloud=document.createElement('a'); cloud.className='ml-cloud-link';
      cloud.href='market-lab-themes.html';
      cloud.textContent='My cloud baskets'; rail.append(cloud);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
