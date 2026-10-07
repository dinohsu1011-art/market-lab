/* A reversible chart preview without leaving the current Leaders filters. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:2}):'—';
  let selected=null,generation=0,trigger=null;
  const host=()=>document.getElementById('leader-chart');
  function sync(){document.querySelectorAll('[data-leader-chart]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.leaderChart===selected)));}
  function close(){generation++;selected=null;host().hidden=true;host().replaceChildren();sync();if(trigger?.isConnected)trigger.focus({preventScroll:true});}
  async function open(button){
    const id=button.dataset.leaderChart;
    if(selected===id){close();return;}
    selected=id;trigger=button;const version=++generation,container=host();sync();container.hidden=false;
    container.innerHTML=`<article class="an-card"><div class="leader-preview-heading"><h3>${esc(id)} · ${esc(button.dataset.name)}</h3><a data-open-in-charts hidden>Open in Charts ↗</a><button type="button" data-close-preview>Close chart</button></div><div class="leader-preview-content" role="status">Loading price chart…</div></article>`;
    container.querySelector('[data-close-preview]').onclick=close;
    container.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    const content=container.querySelector('.leader-preview-content');
    try{
      const {key,data,fresh}=await MarketLabTechnical.load(id);
      if(version!==generation)return;
      const link=container.querySelector('[data-open-in-charts]');link.href='market-lab-themes.html#'+encodeURIComponent(key);link.hidden=false;
      const p=data.daily,start=Math.max(0,p.dates.length-252),dates=p.dates.slice(start);
      if(!dates.length)throw Error('No price history is available for this asset.');
      const c=MarketLab.colors(),lastValid=p.close.findLastIndex(Number.isFinite),latest=lastValid>=0?p.dates[lastValid]:null;
      content.removeAttribute('role');
      content.innerHTML=`<header><span class="an-sub">Last 252 trading sessions · updated ${esc(latest||'unavailable')}${fresh?'':' · '+esc(data.as_of)+' reading unavailable'}</span></header><div class="an-legend"><span>Close</span><span style="color:#e3a365">21-day EMA</span><span style="color:#66ad98">50-day EMA</span></div><div class="an-plot"></div><p class="an-readout"></p>`;
      const read=i=>{if(version===generation)content.querySelector('.an-readout').textContent=dates[i]+' · close '+fmt(p.close[start+i]);};
      MarketLabAnalytics.plot(content.querySelector('.an-plot'),dates,[{values:p.close.slice(start),color:c.ink},{values:p.averages[21].slice(start),color:'#e3a365'},{values:p.averages[50].slice(start),color:'#66ad98'}],{label:'Price & moving averages',panelKey:'leaders:'+key,fitY:true,height:310,format:fmt,onCursor:read});
      read(Math.max(0,lastValid-start));
    }catch(error){if(version===generation){content.textContent=error.message+' ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>{selected=null;open(button);};content.append(retry);}}
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-leader-chart]');if(button){e.preventDefault();open(button);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected&&!document.querySelector('dialog[open]')){e.preventDefault();close();}});
  window.MarketLabLeaderChart={sync};
})();
