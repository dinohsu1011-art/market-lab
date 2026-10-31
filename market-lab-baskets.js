/* Basket browsing uses the same precomputed series as Theme Returns. */
document.addEventListener('DOMContentLoaded', () => {
  const baskets = window.QUANT_BASKETS?.baskets;
  const prices = window.QUANT_THEMES;
  if (!baskets?.length || !prices) return;
  const rail = document.getElementById('ml-basket-rail');
  const list = document.createElement('div'); list.className='ml-basket-list';
  const search = document.createElement('input'); search.type='search';
  search.placeholder='Search baskets…'; search.setAttribute('aria-label','Search baskets');
  // The page's own picker sits first, under the rail heading; the saved cloud
  // baskets (links that leave for Theme Returns) follow, collapsed.
  const heading=rail.querySelector('h2');
  if(heading)heading.after(search,list);else rail.prepend(search,list);
  const saved=document.createElement('details');saved.className='ml-basket-list ml-saved-baskets';rail.append(saved);
  function renderCloud(){
    const title=document.createElement('summary');title.textContent=`My baskets (${MarketLabCloud.state.baskets.length})`;
    saved.replaceChildren(title);
    if(!MarketLabCloud.state.available){const note=document.createElement('div');note.innerHTML=MarketLabCloud.basketNotice();saved.append(note);if(!MarketLabCloud.state.baskets.length)return;}
    const query=search.value.trim().toLowerCase();
    let shown=0;
    for(const basket of MarketLabCloud.state.baskets){
      if(query&&!`${basket.name} ${basket.members.join(' ')}`.toLowerCase().includes(query))continue;
      shown++;
      const link=document.createElement('a');link.className='ml-cloud-link';
      link.href='market-lab-themes.html#saved:'+encodeURIComponent(basket.id);
      link.textContent=basket.name;link.title=basket.members.join(', ');saved.append(link);
    }
    if(!MarketLabCloud.state.baskets.length){const note=document.createElement('p');note.className='ml-rail-empty';note.textContent='Save a chart to create a basket.';saved.append(note);}
    if(query)saved.open=shown>0;
  }
  MarketLabCloud.ready.then(renderCloud);window.addEventListener('ml:cloudchange',renderCloud);
  const cards=[...document.querySelectorAll('[data-basket]')];
  const chartPanel=document.createElement('section'); chartPanel.className='card ml-basket-chart';
  chartPanel.innerHTML='<div class="ml-basket-charthead"><h3>Price return</h3><div class="ml-basket-windows" aria-label="Basket chart window"></div></div><div id="ml-basket-plot"></div><div class="ml-basket-key"></div>';
  document.getElementById('grid').after(chartPanel);
  const methodology=document.createElement('details'); methodology.className='card ml-basket-method';
  methodology.innerHTML='<summary>Methodology</summary>';
  document.getElementById('foot').before(methodology);
  methodology.append(document.querySelector('.lede'),document.getElementById('foot'));
  const rangeGroup=chartPanel.querySelector('.ml-basket-windows');
  let chosen=baskets.find(b=>b.id===decodeURIComponent(location.hash.slice(1)))?.id || baskets[0].id;
  let range='1Y';
  ['1M','3M','6M','YTD','1Y','3Y','5Y','Max'].forEach(value=>{
    const button=document.createElement('button'); button.type='button'; button.textContent=value;
    button.onclick=()=>{range=value;draw();}; rangeGroup.append(button);
  });
  function draw(){
    const theme=MarketLab.colors();
    cards.forEach(card=>card.hidden=card.dataset.basket!==chosen);
    list.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===chosen)));
    rangeGroup.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.textContent===range)));
    const dates=prices.dates || prices.meta.dates;
    const end=dates.at(-1), cutoff=new Date(end+'T00:00:00Z');
    if(range==='YTD') cutoff.setUTCMonth(0,1);
    else if(range==='Max') cutoff.setUTCFullYear(1900);
    else if(range.endsWith('M')) cutoff.setUTCMonth(cutoff.getUTCMonth()-parseInt(range));
    else cutoff.setUTCFullYear(cutoff.getUTCFullYear()-parseInt(range));
    let start=cutoff.toISOString().slice(0,10);
    // YTD is measured from the prior year's last close, so the first session counts.
    if(range==='YTD')start=dates.findLast(d=>d<start)||start;
    const series=[chosen,'spy'].map((id,j)=>{
      const s=prices.series.find(s=>s.id===id); if(!s?.lv)return null;
      let base;
      const points=[];
      s.lv.forEach((value,i)=>{
        const date=dates[i+(s.i0||0)];
        if(!date || date<start || !Number.isFinite(value) || value<=0)return;
        if(base===undefined)base=value;
        points.push({date,value:(value/base-1)*100});
      });
      return {title:s.label,points,color:j===0?theme.accent:'#a584db'};
    }).filter(Boolean);
    MarketLabChart.chart(document.getElementById('ml-basket-plot'),series,{height:340,label:'Basket price return versus S&P 500',floor:-100,format:v=>v.toFixed(0)+'%'});
    const key=chartPanel.querySelector('.ml-basket-key'); key.replaceChildren();
    series.forEach(s=>{const item=document.createElement('span');item.style.color=s.color;item.textContent=`${s.title}  ${s.points.at(-1)?.value.toFixed(1) ?? '—'}%`;key.append(item);});
  }
  // The chart runs on the theme-returns calendar (from 2000), which can start
  // later than a basket's member history; say so on the card.
  const calendar=prices.dates || prices.meta.dates;
  cards.forEach(card=>{
    const s=prices.series.find(s=>s.id===card.dataset.basket),b=baskets.find(b=>b.id===card.dataset.basket);
    const first=s?.lv?calendar[(s.i0||0)+s.lv.findIndex(v=>Number.isFinite(v)&&v>0)]:null;
    const hist=card.querySelector('.hist');
    if(hist&&b&&first&&first>b.inception)hist.textContent=`history from ${b.inception}, chart from ${first}`;
  });
  baskets.forEach(b=>{
    const button=document.createElement('button');button.type='button';button.dataset.id=b.id;
    const label=document.createElement('span');label.textContent=b.label;
    const count=document.createElement('small');count.textContent=b.n;
    button.append(label,count);button.onclick=()=>{
      chosen=b.id; history.replaceState(null,'','#'+encodeURIComponent(chosen)); draw();
      document.body.classList.remove('ml-sidebar-open');
    };
    list.append(button);
  });
  search.oninput=()=>{
    renderCloud();
    const q=search.value.trim().toLowerCase();
    [...list.children].forEach((button,i)=>button.hidden=!(`${baskets[i].label} ${baskets[i].members.map(m=>m.t+' '+m.name).join(' ')}`).toLowerCase().includes(q));
  };
  window.addEventListener('ml:themechange',draw);
  let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(draw,120);});
  draw();
});
