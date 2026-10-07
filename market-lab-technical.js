/* One published calculation for the scan and its matching technical chart. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(v,d=2)=>Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:d}):'—';
  let indexPromise;const files=new Map(),periods=new Map();
  const getIndex=()=>indexPromise||(indexPromise=fetch('cube/technical-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Technical readings are unavailable.');return r.json();}).catch(e=>{indexPromise=null;throw e;}));
  window.MarketLabDailyEdition={get:getIndex};
  async function load(id){
    const index=await getIndex(),normalized=String(id).replace(/^\^/,'').toLowerCase(),key=Object.keys(index.rows).find(k=>k.toLowerCase()===normalized)||index.aliases?.[normalized];
    if(!key)throw Error('Technical readings are available for individual stocks, ETFs and supported indexes.');
    const item=index.rows[key];
    if(!files.has(item.file)){if(files.size>=12)files.delete(files.keys().next().value);files.set(item.file,MarketLabData.json('cube/'+item.file).catch(e=>{files.delete(item.file);throw e;}));}
    const data=await files.get(item.file);
    if(data.update_id!==item.update_id||data.as_of!==index.updated)throw Error('These readings are from a different update. Reload to refresh.');
    return {key,data,fresh:item.fresh};
  }
  const rules=[
    ['rvol','Higher trading activity','rvol','Latest volume ÷ prior 20-session average ≥ 1.5'],
    ['maFan','Moving averages aligned',null,'10-day EMA > 21-day EMA > 50-day EMA'],
    ['atrSqueeze','Daily moves tightening','atrContraction','ATR as a share of price ≤ 80% of its prior 50-session average'],
    ['closeHigh','Close near the session high','closeLocation','(Close − low) ÷ (high − low) ≥ 0.75'],
    ['high252','New 52-week closing high',null,'Close strictly above the previous 252 closes'],
    ['vdu','Volume drying up','vdu','Last 5-session average volume ÷ preceding 20-session average ≤ 0.6'],
    ['hhhl','Higher swing highs and lows',null,'The two latest confirmed swing highs and lows are both rising'],
    ['weeklyEMA','Weekly averages aligned',null,'Completed-week 10-period EMA > 21-period EMA'],
    ['obv','Volume balance rising','obvChange20','On-balance volume higher than 20 sessions ago'],
    ['nr7','Narrow 7-session range',null,'High − low is strictly smaller than each of the prior six ranges'],
    ['upDownVolume','More volume on rising days','upDownVolume','Up-day volume ÷ down-day volume over 20 sessions ≥ 1.2'],
    ['squeeze','Bollinger / Keltner squeeze',null,'Bollinger bands fit inside the Keltner channel'],
    ['spring','Recent support recovery',null,'A dip below prior 20-session support recovered within three sessions']
  ];
  async function mount(host,id){
    host.className='technical-view';host.onclick=e=>e.stopPropagation();host.ondblclick=e=>e.stopPropagation();
    host.textContent='Loading technical readings…';
    try{
      const {key,data,fresh}=await load(id);
      if(!host.isConnected)return;
      function paint(){
        if(!host.isConnected)return;
        const period=periods.get(key)||'daily',p=data[period],q=p?.latest,values=q?.values||{},unit=period==='daily'?'session':period==='weekly'?'week':'month',lastValid=p.close.findLastIndex(Number.isFinite),lastDate=lastValid>=0?p.dates[lastValid]:'unavailable';
        host.innerHTML=`<div class="technical-toolbar"><div role="group" aria-label="Technical timeframe">${['daily','weekly','monthly'].map(v=>`<button type="button" data-timeframe="${v}" aria-pressed="${period===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><span>updated ${esc(q?.updated||lastDate)}${period==='daily'&&!fresh?' · '+esc(data.as_of)+' reading unavailable':''}</span></div>${period!=='daily'?`<p class="technical-note">The current ${unit} is left out, even on its final trading day. These are the latest confirmed periods.</p>`:''}`;
        if(!q){host.insertAdjacentHTML('beforeend','<p>No complete price readings at this endpoint. Short histories and gaps can leave indicators unavailable.</p>');bind();return;}
        const trend=q.strong?'Strong uptrend':q.trending?q.grace?'Uptrend · brief pullback':'Uptrend':q.setup?'Setting up':'No upward setup';
        host.insertAdjacentHTML('beforeend',`<div class="technical-status"><strong>${trend}</strong><span>${esc(q.reasons?.map(s=>s.replaceAll('-day','-period')).join(' · ')||'The current close does not meet the upward-trend or tightening-range rules.')}</span></div><div class="technical-metrics">${[['RSI 14',values.rsi14],['Williams %R 14',values.williams14],['Stochastic %K',values.stochK],['Stochastic %D',values.stochD],['MACD',values.macd],['MACD signal',values.macdSignal],['MACD histogram',values.macdHistogram],['ATR %',values.atrPercent],['Relative volume',values.rvol],['Up/down volume',values.upDownVolume]].map(([k,v])=>`<span>${k}<b>${number(v)}</b></span>`).join('')}</div><div class="technical-table"><table><thead><tr><th>EMA (${unit}s)</th><th>Level</th><th>Price vs EMA</th><th>Last touch</th><th>Last rebound</th></tr></thead><tbody>${[10,21,50,100,200].map(n=>`<tr><th>${n}</th><td>${number(values['ema'+n])}</td><td>${q.ema?.[n]==null?'—':number(q.ema[n])+'%'}</td><td>${esc(q.touches?.[n]?.lastTouch||'—')}</td><td>${esc(q.touches?.[n]?.lastRebound||'—')}</td></tr>`).join('')}</tbody></table></div><p class="technical-note">50/200 EMA upward cross: ${esc(q.crosses?.golden||'—')} · downward cross: ${esc(q.crosses?.death||'—')}. RSI / Williams context: ${esc(q.oscillatorContext||'unavailable')}.</p><article class="an-card"><header><h3>Price &amp; moving averages</h3></header><div class="an-legend">${['Close',10,21,50,100,200].map((n,j)=>`<span style="color:${['var(--ml-ink)','#4f9ce0','#e3a365','#66ad98','#af8ed0','#8f9caa'][j]}">${n==='Close'?n:n+' EMA'}</span>`).join('')}</div><div class="an-plot"></div><p class="an-readout"></p></article>${period==='daily'?`<details><summary>Scan readings &amp; thresholds</summary><div class="technical-table"><table><thead><tr><th>Condition</th><th>Now</th><th>Value</th><th>Rule</th></tr></thead><tbody>${rules.map(([k,label,value,rule])=>`<tr><td>${label}</td><td>${q.diagnostics[k]==null?'Unavailable':q.diagnostics[k]?'Yes':'No'}</td><td>${value?number(values[value]):'—'}</td><td>${rule}</td></tr>`).join('')}</tbody></table></div></details>`:''}<details><summary>How to read this</summary><p>The shorter averages follow recent direction; the longer ones show the wider trend. Strong uptrends hold above rising 10- and 21-period averages. Brief dips can keep an established uptrend intact for two periods, but a deep fall or a third interruption clears it. This is separate from the longer-term history in the Trends tab.</p><p>RSI, Williams %R and Stochastic describe where price sits within its recent moves. MACD compares the 12- and 26-period exponential averages; its signal is a 9-period average. When the measures disagree, the context says Mixed rather than forcing a single conclusion.</p><p>An average was touched when it fell inside that bar’s high–low range. A rebound is confirmed on the next bar only if the close rises and finishes above the average. Cross dates mark the 50-period EMA passing the 200-period EMA. These dates are when the event became known.</p><p>EMAs start from the first close and remain blank until their full period is available. ATR uses Wilder smoothing. Bollinger bands use a 20-period average and two population standard deviations; Keltner uses a 20-period EMA and 1.5 times ATR20. Stochastic uses 14, 3, 3 simple smoothing. RSI / Williams context is Firm when both are at or above 50 / −50, Weak when both are below, otherwise Mixed. These oscillators are not combined into a score. The Home page’s momentum checklist is separate.</p><p>Prices are the stored split-adjusted OHLC series, without dividends. Volume is provided by the price vendor; its split-adjustment history has not been independently verified. Missing prices restart calculations. These readings use ${esc(data.rule_version)} and the latest available close, not the comparison chart’s selected return window.</p></details>`);
        const structure=q.state||{},range=structure.candidate,events=[...(structure.pivots?.highs||[]).map(e=>({...e,kind:'Swing high'})),...(structure.pivots?.lows||[]).map(e=>({...e,kind:'Swing low'})),...(structure.spring?[{...structure.spring,kind:'Support recovery'}]:[])];
        host.insertAdjacentHTML('beforeend',`<details><summary>Range and turning points</summary>${range?`<p>The current range runs from ${number(range.lower)} to ${number(range.upper)}. It was established on ${esc(range.created)} and its boundaries stay fixed until a break or expiry.</p>`:'<p>No active tightening-range candidate at this close.</p>'}<div class="technical-table"><table><thead><tr><th>Event</th><th>Price</th><th>Occurred</th><th>Confirmed</th></tr></thead><tbody>${events.map(e=>`<tr><td>${e.kind}</td><td>${number(e.price)}</td><td>${esc(e.occurred)}</td><td>${esc(e.confirmed)}</td></tr>`).join('')}</tbody></table></div><p>A turning point is confirmed only after two later bars. The occurrence date is not a signal that was available that day.</p></details>`);
        if(period==='daily'&&window.MarketLabOverextension){
          const extension=document.createElement('section');
          host.querySelector('article.an-card').before(extension);
          window.MarketLabOverextension.mount(extension,key,data.as_of);
        }
        const chart=host.querySelector('article.an-card .an-plot'),ink=MarketLab.colors().ink;
        MarketLabAnalytics.plot(chart,p.dates,[{values:p.close,color:ink},...[10,21,50,100,200].map((n,j)=>({values:p.averages[n],color:['#4f9ce0','#e3a365','#66ad98','#af8ed0','#8f9caa'][j]}))],{label:'Price & moving averages',panelKey:'technical:'+key+':'+period,assetId:key,updated:data.as_of,fitY:true,height:300,measureUnit:period==='daily'?'trading sessions':period==='weekly'?'weeks':'months',format:v=>number(v),onCursor:i=>{chart.closest('article').querySelector('.an-readout').textContent=p.dates[i]+' · close '+number(p.close[i]);}});
        bind();
      }
      function bind(){host.querySelectorAll('[data-timeframe]').forEach(b=>b.onclick=()=>{periods.set(key,b.dataset.timeframe);paint();});}
      paint();
    }catch(e){if(host.isConnected){host.textContent=e.message+' ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>mount(host,id);host.append(retry);}}
  }
  window.MarketLabTechnical={mount,load};
})();
