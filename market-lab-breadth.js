(() => {
  let payload=null, pending=null, period=21, range='1Y';
  function draw(){
    const panel=document.getElementById('breadth-panel');
    if(!panel || panel.hidden || !payload)return;
    const palette=MarketLab.colors(), last=payload.as_of, date=new Date(last+'T00:00:00Z');
    if(range!=='MAX') date.setUTCFullYear(date.getUTCFullYear()-(range==='3Y'?3:1));
    const cutoff=range==='MAX'?'0000':date.toISOString().slice(0,10);
    panel.innerHTML=`<div class="ml-breadth-head"><h2>Stocks above their moving average</h2><div class="ml-breadth-controls" aria-label="Moving average length">${payload.windows.map(w=>`<button type="button" data-ma="${w}" aria-pressed="${period===w}">${w}D</button>`).join('')}</div><div class="ml-breadth-controls" aria-label="Breadth chart history">${['1Y','3Y','MAX'].map(r=>`<button type="button" data-breadth-range="${r}" aria-pressed="${range===r}">${r}</button>`).join('')}</div></div><div class="ml-breadth-grid"></div><details class="ml-breadth-method"><summary>Coverage & method · ${last}</summary><p>${payload.methodology.calculation} ${payload.methodology.membership}</p><p>Nasdaq: common stocks and depositary receipts from the <a href="${payload.methodology.nasdaq_source}" target="_blank" rel="noopener">Nasdaq directory</a>, snapshot ${payload.methodology.nasdaq_snapshot}. Not a market-cap-weighted index.</p></details>`;
    payload.universes.forEach((universe,index)=>{
      const data=universe.windows[String(period)], value=data.pct.at(-1), eligible=data.eligible.at(-1);
      const card=document.createElement('article');card.className='ml-breadth-card';
      card.innerHTML=`<header><h3>${universe.label}</h3><b>${value==null?'—':value.toFixed(1)+'%'}</b></header><p>Above the ${period}-day moving average</p><div class="ml-breadth-plot"></div>`;
      panel.querySelector('.ml-breadth-grid').append(card);
      const indices=payload.dates.map((date,i)=>date>=cutoff?i:-1).filter(i=>i>=0), dates=indices.map(i=>payload.dates[i]);
      const benchmark=universe.benchmark, priceColor=palette.ink, breadthColor=index?palette.accent:palette.down;
      const series=[{color:breadthColor,area:true,values:indices.map(i=>data.pct[i])}];
      if(benchmark)series.push({right:true,color:priceColor,values:indices.map(i=>benchmark.close[i])});
      const legend=document.createElement('p');legend.className='ml-breadth-legend';
      legend.innerHTML=`<span style="color:${breadthColor}">— Breadth % · left</span>`;
      card.querySelector('.ml-breadth-plot').before(legend);
      MarketLabAnalytics.plot(card.querySelector('.ml-breadth-plot'),dates,series,
        {label:`${universe.label}: breadth on left axis; ${benchmark?.label||'index'} closing price on right axis`,panelKey:'breadth:'+index+':'+period,defaultOverlay:index?'nasdaq':'sp500',domain:[0,100],height:280,format:v=>v.toFixed(0)+'%',rightFormat:v=>v.toLocaleString(undefined,{maximumFractionDigits:0}),
         onCursor:j=>{const i=indices[j],v=data.pct[i];card.querySelector('header b').textContent=Number.isFinite(v)?v.toFixed(1)+'%':'—';card.querySelector('p').textContent=`${payload.dates[i]} · above the ${period}-day moving average`;}});
    });
    panel.querySelectorAll('[data-ma]').forEach(b=>b.onclick=()=>{period=+b.dataset.ma;draw();});
    panel.querySelectorAll('[data-breadth-range]').forEach(b=>b.onclick=()=>{range=b.dataset.breadthRange;draw();});
  }
  async function show(visible){
    const panel=document.getElementById('breadth-panel'); if(!panel)return;
    panel.hidden=!visible;if(!visible)return;
    if(!pending){pending=fetch('cube/market-breadth.json').then(r=>{if(!r.ok)throw new Error('Breadth data unavailable');return r.json();}).then(data=>{payload=data;});}
    try{await pending;draw();}catch(error){pending=null;panel.textContent='Breadth histories are being prepared. Please reload when the backfill finishes.';}
  }
  window.MarketLabBreadth={show};
  window.addEventListener('ml:themechange',draw);
  let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(draw,150);});
})();
