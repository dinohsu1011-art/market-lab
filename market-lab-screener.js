/* A lazy, local filter over the published stock snapshot. */
(() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value=(r,key)=>key.split('.').reduce((v,k)=>v?.[k],r);
  function matches(r,f,baskets){
    if(!r.fresh)return false;
    if(f.country&&r.country!==f.country||f.sector&&r.sector!==f.sector)return false;
    if(f.theme&&!r.themes.includes(f.theme))return false;
    if(f.basket&&!baskets.find(b=>String(b.id)===f.basket)?.members.some(id=>id.toLowerCase()===r.id.toLowerCase()))return false;
    if(f.record==='high'&&!r.newHigh||f.record==='low'&&!r.newLow)return false;
    if(f.downside&&r.extension?.downside!==true)return false;
    for(const [key,bounds]of Object.entries(f.bounds||{})){
      const v=value(r,key);
      if(bounds.min!==''&&bounds.min!=null&&(!Number.isFinite(v)||v<Number(bounds.min)))return false;
      if(bounds.max!==''&&bounds.max!=null&&(!Number.isFinite(v)||v>Number(bounds.max)))return false;
    }
    for(const [n,side]of Object.entries(f.ema||{}))if(side&&(!Number.isFinite(r.ema[n])||(side==='above'?r.ema[n]<=0:r.ema[n]>=0)))return false;
    return true;
  }
  const dailyRow=r=>({...r,ema:r.daily?.ema||{},rsi:r.daily?.values?.rsi14??null,rvol:r.daily?.values?.rvol??null,newHigh:r.daily?.values?.high252??null,newLow:r.daily?.values?.low252??null});
  window.MarketLabScreener={matches,dailyRow};
  const host=document.getElementById('stock-screener');
  if(!host||document.documentElement.dataset.workspace==='home'){if(host)host.remove();return;}
  let data,filters={},sort='r.1Y',direction=-1,limit=50,chosen=new Set(),loading=false,scanMode='custom',benchmark='SPY',expanded=null;
  const pending=new Map();
  const diagnosticLabels={rvol:'Higher trading activity',maFan:'Moving averages aligned',atrSqueeze:'Daily moves tightening',closeHigh:'Close near the session high',high252:'New 52-week closing high',vdu:'Volume drying up',hhhl:'Higher swing highs and lows',weeklyEMA:'Weekly averages aligned',obv:'Volume balance rising',nr7:'Smallest daily range in 7 sessions',upDownVolume:'More volume on rising days',squeeze:'Bollinger / Keltner squeeze',spring:'Recent support recovery'};
  const signalDetails=r=>`<div class="screen-diagnostics"><strong>${esc(r.id)} · Daily readings</strong><dl>${Object.entries(r.daily?.diagnostics||{}).map(([k,v])=>`<div><dt>${esc(diagnosticLabels[k]||k)}</dt><dd>${v==null?'Unavailable':v?'Yes':'No'}</dd></div>`).join('')}</dl><p>${(r.daily?.reasons||[]).map(esc).join(' · ')||'No momentum setup qualifies at this close.'}</p><p>Open Technical in the ticker summary for values, the matching chart and calculation details.</p></div>`;
  const metrics=[['r.1W','1W return %'],['r.1M','1M return %'],['r.3M','3M return %'],['r.6M','6M return %'],['r.1Y','1Y return %'],['dd.current','Drawdown from ATH %'],['ath.since','Sessions since ATH'],['rsi','RSI 14'],['extension.score','Extension score'],['turnoverUSD.1D','Daily USD volume'],['advUSD','63D avg USD volume (millions)'],['rvol','Relative volume'],['dd.average','Avg completed drawdown %'],['dd.average_length','Avg recovery sessions']];
  const cloud=()=>window.MarketLabCloud?.state;
  const opts=(xs,current)=>'<option value="">Any</option>'+xs.map(([v,l])=>`<option value="${esc(v)}" ${current===String(v)?'selected':''}>${esc(l)}</option>`).join('');
  function controls(){
    const body=host.querySelector('.screen-body');
    body.innerHTML=`<div class="screen-modes" role="group" aria-label="Scan mode">${[['custom','Custom'],['trending','Trending'],['setup','Setting up']].map(([id,label])=>`<button type="button" data-mode="${id}" aria-pressed="${scanMode===id}">${label}</button>`).join('')}<label>Compare with <select id="screen-benchmark">${['SPY','QQQ','SMH','IGV','GLD','SLV'].map(b=>`<option ${b===benchmark?'selected':''}>${b}</option>`).join('')}</select></label></div><p class="screen-scan-note">${scanMode==='custom'?'All stored stock markets.':scanMode==='trending'?'US-listed stocks holding an upward trend, ranked by 50-session return relative to the selected benchmark.':'US-listed stocks with a tightening range after an earlier rise, ranked by range contraction.'}</p><div class="screen-controls"><label>Preset<select id="screen-preset"><option value="">Custom</option><option value="high">New highs</option><option value="low">New lows</option><option value="cool">Strong momentum cooling off</option><option value="oversold">Deeply oversold</option></select></label>${['country','sector','theme','basket'].map(k=>`<label>${({country:'Country / listing',sector:'Sector',theme:'Theme',basket:'My basket'})[k]}<select data-screen="${k}"></select></label>`).join('')}<button id="screen-reset" type="button">Reset filters</button></div><details><summary>Price, trend &amp; trading activity</summary><div class="screen-controls"><label>52-week record<select data-screen="record"><option value="">Any</option><option value="high">New high</option><option value="low">New low</option></select></label>${[10,21,50,100,200].map(n=>`<label>${n}-day EMA<select data-ema="${n}"><option value="">Any</option><option value="above">Above</option><option value="below">Below</option></select></label>`).join('')}<label><input type="checkbox" id="screen-downside"> Downside extension only</label></div><div class="screen-ranges">${metrics.map(([key,label])=>`<label>${label}<span><input type="number" step="any" data-metric="${key}" data-bound="min" placeholder="Min" aria-label="${label} minimum"><input type="number" step="any" data-metric="${key}" data-bound="max" placeholder="Max" aria-label="${label} maximum"></span></label>`).join('')}</div></details><div class="screen-status"><span id="screen-count" role="status"></span><button type="button" id="screen-basket">Create basket from selected</button></div><p id="screen-message" role="status"></p><div class="screen-scroll"><table id="screen-table"></table></div><button type="button" id="screen-more">Show 50 more</button><details class="screen-method"><summary>How these filters work</summary><p>Trending means the close is above a rising 21-day EMA. An established trend can keep its label through two brief interruptions, unless the close falls more than two ATR below that average. A third interruption clears the label. A strong trend also holds above a rising 10-day EMA. The 100- and 200-day averages are context, not entry requirements.</p><p>Setting up looks for earlier strength followed by a contracting range with little net progress. Boundaries come from confirmed price swings and stay fixed for up to 20 sessions. A break outside ends the candidate. It is a deliberately narrow scan, not a label for every sideways pattern.</p><p>Relative return compares the growth of the stock and benchmark over the same 50 sessions. Setup ranking compares the latest 20-session range with the preceding 50-session range, each scaled by its closing price. Lower means tighter. These readings describe the current price pattern rather than forecasting a return.</p><p>Returns use closing prices in each stock’s trading currency. Volume is converted to USD; relative volume uses the prior 20 sessions. Volume adjustment comes from the price provider. Missing readings do not pass a filter. No 200-day restriction is applied unless you choose one. Completed drawdown averages exclude still-open declines.</p></details>`;
    body.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{scanMode=b.dataset.mode;sort=scanMode==='trending'?'_rs':scanMode==='setup'?'daily.values.contraction':'r.1Y';direction=scanMode==='setup'?1:-1;limit=50;controls();results();});
    body.querySelector('#screen-benchmark').onchange=e=>{benchmark=e.target.value;limit=50;results();};
    for(const k of ['country','sector','theme','basket']){
      const choices=k==='theme'?data.themes.map(g=>[g.id,g.label]):k==='basket'?(cloud()?.available?cloud().baskets:[]).map(b=>[String(b.id),b.name]):[...new Set(data.rows.map(r=>r[k]))].sort().map(v=>[v,v]);
      body.querySelector(`[data-screen="${k}"]`).innerHTML=opts(choices,filters[k]);
    }
    body.querySelectorAll('[data-screen]').forEach(el=>{el.value=filters[el.dataset.screen]||'';el.onchange=()=>{filters[el.dataset.screen]=el.value;limit=50;results();};});
    body.querySelectorAll('[data-ema]').forEach(el=>{el.value=filters.ema?.[el.dataset.ema]||'';el.onchange=()=>{(filters.ema||={})[el.dataset.ema]=el.value;results();};});
    body.querySelectorAll('[data-metric]').forEach(el=>{el.value=filters.bounds?.[el.dataset.metric]?.[el.dataset.bound]??'';el.oninput=()=>{((filters.bounds||={})[el.dataset.metric]||={})[el.dataset.bound]=el.value;results();};});
    body.querySelector('#screen-downside').checked=!!filters.downside;
    body.querySelector('#screen-downside').onchange=e=>{filters.downside=e.target.checked;results();};
    body.querySelector('#screen-reset').onclick=()=>{filters={};limit=50;controls();results();};
    body.querySelector('#screen-preset').onchange=e=>{const p=e.target.value;filters={};scanMode='custom';limit=50;sort='r.1Y';direction=-1;if(p==='high'||p==='low')filters.record=p;if(p==='cool')filters.bounds={'r.1Y':{min:30},'r.1M':{max:0}};if(p==='oversold'){filters.downside=true;filters.bounds={'extension.score':{min:80}};sort='extension.score';}controls();body.querySelector('#screen-preset').value=p;results();};
    body.querySelector('#screen-basket').onclick=()=>{if(chosen.size<2||chosen.size>50){body.querySelector('#screen-message').textContent='Select between 2 and 50 stocks to create a basket.';return;}window.dispatchEvent(new CustomEvent('ml:screener-basket',{detail:{ids:[...chosen]}}));};
    body.querySelector('#screen-more').onclick=()=>{limit+=50;results();};
  }
  function results(){
    chosen=new Set(window.MarketLabSelection?.get()||[]);
    for(const r of data.rows)r._rs=r.daily?.rs?.[benchmark]?.['50']??null;
    const rows=data.rows.map(dailyRow).filter(r=>matches(r,filters,cloud()?.available?cloud().baskets:[])&&(scanMode==='custom'||r.daily?.comparable&&r.daily.group===scanMode&&(scanMode!=='trending'||Number.isFinite(r._rs))));
    rows.sort((a,b)=>{const x=value(a,sort),y=value(b,sort);if(x==null)return y==null?a.id.localeCompare(b.id):1;if(y==null)return -1;return (typeof x==='string'?direction*x.localeCompare(y):direction*(x-y))||a.id.localeCompare(b.id);});
    const columns=[['id','Stock'],['country','Country'],['sector','Sector'],['turnoverUSD.1D','USD volume'],...(scanMode==='custom'?[]:[['_rs','50D vs '+benchmark+' %'],['daily.values.contraction','Range ratio'],['daily.values.atrPercent','ATR %']]),['r.1W','1W %'],['r.1M','1M %'],['r.1Y','1Y %'],['rsi','RSI'],['extension.score','Extension'],['dd.current','ATH drawdown %'],['ath.since','Since ATH'],['dd.average','Avg drawdown %'],['dd.average_length','Avg recovery'],['rvol','RVol'],['_detail','Readings']];
    const fmt=(v,k)=>v==null?'—':typeof v==='string'?esc(v):k==='turnoverUSD.1D'?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(v):Number(v).toFixed(1);
    host.querySelector('#screen-count').textContent=`${rows.length.toLocaleString()} matches · ${chosen.size} charted${pending.size?' · '+pending.size+' loading':''} · updated ${data.updated}`;
    host.querySelector('#screen-table').innerHTML='<thead><tr>'+columns.map(([k,l])=>`<th>${k==='_detail'?l:`<button type="button" data-sort="${k}">${l}${sort===k?(direction===-1?' ↓':' ↑'):''}</button>`}</th>`).join('')+'</tr></thead><tbody>'+rows.slice(0,limit).map(r=>`<tr data-pick="${esc(r.id)}" tabindex="0" aria-selected="${chosen.has(r.id)}" aria-busy="${pending.has(r.id)}">`+columns.map(([k])=>`<td>${k==='id'?`<button type="button" data-row-toggle="${esc(r.id)}" aria-pressed="${chosen.has(r.id)}">${esc(r.id)}</button><small>${esc(r.name)}</small>`:k==='_detail'?`<button type="button" data-detail="${esc(r.id)}" aria-expanded="${expanded===r.id}">Details</button>`:fmt(value(r,k),k)}</td>`).join('')+'</tr>'+(expanded===r.id?`<tr><td colspan="${columns.length}">${signalDetails(r)}</td></tr>`:'')).join('')+(rows.length?'':`<tr><td colspan="${columns.length}" class="screen-empty">No stocks match these conditions. Try fewer filters.</td></tr>`)+'</tbody>';
    host.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:-1;sort=b.dataset.sort;results();});
    host.querySelectorAll('[data-pick]').forEach(b=>{
      b.onclick=()=>selectRow(b.dataset.pick);
      b.onkeydown=e=>{if(e.target!==b||!['Enter',' '].includes(e.key))return;e.preventDefault();selectRow(b.dataset.pick);};
    });
    host.querySelectorAll('[data-detail]').forEach(b=>b.onclick=e=>{e.stopPropagation();expanded=expanded===b.dataset.detail?null:b.dataset.detail;results();});
    host.querySelector('#screen-more').hidden=rows.length<=limit;
  }
  async function selectRow(id){
    const bridge=window.MarketLabSelection,message=host.querySelector('#screen-message');
    if(!bridge){message.textContent='Charts are still loading. Please try again.';return;}
    const target=!(pending.has(id)?pending.get(id).selected:chosen.has(id)),ticket={selected:target};pending.set(id,ticket);message.textContent='';results();
    try{await bridge.select(id,target);}catch(e){if(pending.get(id)===ticket)message.textContent='Could not load '+id+'. '+e.message+' Tap the row to retry.';}
    finally{if(pending.get(id)===ticket)pending.delete(id);results();}
  }
  host.ontoggle=async()=>{if(!host.open||data||loading)return;loading=true;try{const edition=await MarketLabDailyEdition.get();if(!edition.screener_file)throw Error('The daily scan is being prepared. Close and reopen to retry.');const snapshot=await MarketLabData.json('cube/'+edition.screener_file);if(snapshot.update_id!==edition.update_id)throw Error('The scan edition does not match. Reload to refresh.');data=snapshot;controls();results();}catch(e){host.querySelector('.screen-body').textContent=e.message;}finally{loading=false;}};
  window.addEventListener('ml:cloudchange',()=>{if(data){controls();results();}});
  window.addEventListener('ml:selection-change',()=>{if(data)results();});
})();
