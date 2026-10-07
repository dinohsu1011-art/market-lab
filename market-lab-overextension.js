/* Shared Pine-based readings: Home rankings and the selected ticker's indicator. */
(()=>{
  const VERSION='overextension-v2',cache=new Map(),histories=new Map();let indexPromise;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value=(v,suffix='')=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(1)+suffix:'—';
  const plain=v=>Number.isFinite(v)?v.toFixed(1):'—';
  const normalize=s=>String(s||'').replace(/^\^/,'').toLowerCase();
  async function get(updated){
    if(!indexPromise)indexPromise=fetch('cube/overextension.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Overextension readings are unavailable.');return window.MarketLabReadJSON(r);}).catch(e=>{indexPromise=null;throw e;});
    const data=await indexPromise;
    if(data.version!==VERSION||data.as_of!==updated){indexPromise=null;throw Error('Overextension readings are waiting for the matching daily update.');}
    return data;
  }
  async function history(id,updated){
    const data=await get(updated),q=lookup(data,id);
    if(!q)throw Error('Overextension is unavailable for this asset at this update.');
    if(!/^overextension\/[a-f0-9]{20}\.json\.gz$/.test(q.chart_file))throw Error('Overextension history is unavailable.');
    if(!cache.has(q.chart_file)){
      if(cache.size>=12)cache.delete(cache.keys().next().value);
      cache.set(q.chart_file,MarketLabData.json('cube/'+q.chart_file).catch(e=>{cache.delete(q.chart_file);throw e;}));
    }
    const h=await cache.get(q.chart_file);
    if(h.version!==VERSION||h.updated!==updated||normalize(h.id)!==normalize(q.id))throw Error('Overextension history belongs to another update.');
    return h;
  }
  function align(h,dates){
    const lookup=new Map(h.dates.map((d,i)=>[d,h.signed[i]]));
    return dates.map(d=>Number.isFinite(lookup.get(d))?lookup.get(d):null);
  }
  function barColor(v){
    const muted=window.MarketLab?.colors?.().muted||'#8f9caa';
    return v<0?(v<=-96?'#45a796':v<=-85?'rgba(69,167,150,.85)':v<=-75?'rgba(69,167,150,.65)':v<=-65?'rgba(69,167,150,.45)':v<=-50?'rgba(69,167,150,.25)':muted)
      :v>=96?'#cf5b69':v>=85?'rgba(207,91,105,.75)':v>=75?'rgba(207,91,105,.5)':v>=65?'rgba(207,91,105,.3)':muted;
  }
  function overlaySeries(values){return {key:'overextension',values,colors:values.map(barColor),type:'bars',right:true,opacity:.3};}
  function lookup(data,id){return Object.values(data?.rows||{}).find(q=>normalize(q.id)===normalize(id))||data?.rows?.[id]||null;}
  function top(rows,data,side,updated){
    if(data?.version!==VERSION||data.as_of!==updated)return [];
    const indexed=new Map(Object.values(data.rows).map(q=>[normalize(q.id),q]));
    return rows.map(r=>({...r,overextension:indexed.get(normalize(r.id)),relative:r.daily?.rs?.SPY?.['50']??null}))
      .filter(r=>r.fresh===true&&r.daily?.comparable===true&&r.overextension?.version===VERSION&&r.overextension.updated===updated&&Number.isFinite(r.overextension.signed)&&(side==='downside'?r.overextension.signed<0:r.overextension.signed>=0))
      .sort((a,b)=>b.overextension.score-a.overextension.score||(b.turnoverUSD?.['1D']??0)-(a.turnoverUSD?.['1D']??0)||a.id.localeCompare(b.id)).slice(0,10);
  }
  function streakStats(q,side=q.zone==='none'?(q.signed<0?'downside':'upside'):q.zone){
    const h=q.streak_history?.[side],active=q.zone===side;
    return {side,current:active?q.zone_sessions:0,startKnown:!active||q.zone_start_known!==false,
      average:Number.isFinite(h?.average)?h.average:null,median:Number.isFinite(h?.median)?h.median:null,
      completed:Number.isInteger(h?.completed)?h.completed:null,from:q.streak_history?.from,through:q.streak_history?.through};
  }
  const duration=v=>Number.isFinite(v)?String(Number(v.toFixed(1))):'—';
  function streakCell(q,side){
    const s=streakStats(q,side);
    return `<span>${s.startKnown?'':'≥'}${duration(s.current)}</span><small>Avg ${duration(s.average)} · median ${duration(s.median)}</small>`;
  }
  function streakReading(q){
    const s=streakStats(q),side=s.side==='upside'?'upside':'downside';
    if(s.completed===null)return '<p>Historical streak comparison is unavailable for this reading.</p>';
    const current=s.current>0?`This ${side} extreme has lasted ${s.startKnown?'':'at least '}${s.current} trading session${s.current===1?'':'s'}.`:'This stock is not at an extreme reading, so its current streak is 0 trading sessions.';
    const past=s.completed?`Its ${s.completed} completed ${side} streak${s.completed===1?'':'s'} averaged ${duration(s.average)} trading sessions, with a median of ${duration(s.median)}.`:`There are no completed ${side} extreme streaks to compare with yet.`;
    const dates=s.from&&s.through?` from ${esc(s.from)} to ${esc(s.through)}`:'';
    return `<p data-extreme-history>${current} ${past} We use this stock’s full available indicator history${dates}, not just the chart’s selected window. The open streak and any streak interrupted by missing data are left out of the average and median.${s.startKnown?'':' The current streak began before continuous readings were available, so its length is a minimum.'}</p>`;
  }
  function status(q){return q.zone==='none'?'Below the script’s extreme threshold':(q.zone==='upside'?'Upside':'Downside')+' threshold · '+(q.zone_start_known===false?'at least ':'')+q.zone_sessions+' trading session'+(q.zone_sessions===1?'':'s');}
  function readings(q){
    const names=['20-day EMA','50-day EMA','200-day EMA','Bollinger bands'],weights=[10,15,50,25],dist=[q.ema20,q.ema50,q.ema200,q.bb_extension];
    return `<p>${esc(status(q))}.${q.top_cross?' A new upside threshold crossing occurred at this close.':q.bottom_cross?' A new downside threshold crossing occurred at this close.':''}</p>${streakReading(q)}<p>The sign tells you which side of the 200-day average price is on. A larger absolute score means its combination of distances is more unusual for this stock—not that a reversal is more likely by that percentage.</p><div class="technical-table"><table><thead><tr><th>Measure</th><th>Distance</th><th>Historical rank</th><th>Weight</th></tr></thead><tbody>${names.map((name,i)=>`<tr><th>${name}</th><td>${value(dist[i],'%')}</td><td>${plain(q.components?.[i])}</td><td>${weights[i]}%</td></tr>`).join('')}</tbody></table></div><p>EMA distances are percentages of each average. Bollinger distance is measured outside the bands, as a percentage of their full width; it is zero inside. Each historical rank compares that distance with the last 500 readings. Tied readings count too.</p>`;
  }
  function historicalContext(h,current=h.signed?.at(-1)){
    const s=h.historical_context;
    if(!s)return '<p class="oe-history-empty">Historical bottom statistics are not available for this update.</p>';
    const range=(a,b)=>value(a)+' to '+value(b);
    const extreme=e=>e?`<strong>${e.score>0?'+':''}${e.score.toFixed(2)}</strong><small>${esc(e.date)}</small>`:'<strong>—</strong><small>No readings on this side</small>';
    const bin=Number.isFinite(current)?s.bins.find((b,i)=>current>=b.lo&&(current<b.hi||(i===s.bins.length-1&&current===b.hi))):null;
    const matching=bin?s.events.filter(e=>e.score>=bin.lo&&(e.score<bin.hi||(bin.hi===100&&e.score===100))):[];
    const rows=s.bins.filter(b=>b.count>0||b===bin).map(b=>`<tr${b===bin?' class="oe-current-band"':''}><th scope="row">${range(b.lo,b.hi)}${b===bin?' · current band':''}</th><td>${b.count}</td><td>${s.bottom_count?(100*b.count/s.bottom_count).toFixed(1)+'%':'—'}</td></tr>`).join('');
    return `<section class="oe-history" aria-label="${esc(h.id)} overextension history"><div class="oe-history-heading"><strong>${esc(h.id)} · Historical context</strong><span>${esc(s.from||'No valid readings')} → ${esc(s.through)} · full stored indicator history</span></div><div class="oe-history-metrics"><div><span>Highest upside score</span>${extreme(s.upside_max)}</div><div><span>Deepest downside score</span>${extreme(s.downside_max)}</div><div><span>Usual score at major lows</span><strong>${s.bottom_count?value(s.bottom_average):'—'}</strong><small>Average of ${s.bottom_count} confirmed major lows</small></div><div><span>Major lows in the current score band</span><strong>${bin?bin.count:'—'}</strong><small>${bin?range(bin.lo,bin.hi):'No current score'}</small></div></div><details><summary>Bottom scores &amp; dates</summary><p>A major low closes below the previous ${s.lookback_days} calendar days, then stays untouched for the next ${s.confirmation_days} calendar days. Any equal or lower close during that time rules it out. Recent lows are excluded until the full 90 days have passed; missing prices invalidate the window. The average uses the overextension score on each qualifying low’s date, counted once.</p><p>${s.bottom_count?`Across ${s.bottom_count} confirmed major lows, the average score was ${value(s.bottom_average)} and the median was ${value(s.bottom_median)}. The middle half ranged from ${range(s.bottom_q25,s.bottom_q75)}; the full range was ${range(s.bottom_min,s.bottom_max)}.`:'There are no confirmed price lows with valid scores in this history.'} A price bottom can have a positive score during an uptrend. These counts describe past lows; they are not the probability that the current reading will turn into a bottom.</p><div class="technical-table"><table><thead><tr><th>Score range</th><th>Major lows</th><th>Share of major lows</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No confirmed lows</td></tr>'}</tbody></table></div><p>Each band includes its lower endpoint and excludes its upper endpoint, except +100 is included in the last band. History excludes indicator warm-up and missing readings. Changing chart dates does not change these totals.</p><h4>Major lows in the current score band${bin?' · '+range(bin.lo,bin.hi):''}</h4>${matching.length?`<div class="technical-table oe-bottom-events"><table><thead><tr><th>Bottom date</th><th>Score</th><th>Confirmed</th></tr></thead><tbody>${matching.slice().reverse().map(e=>`<tr><td>${esc(e.date)}</td><td>${value(e.score)}</td><td>${esc(e.confirmed)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No confirmed major lows in this score band.</p>'}</details></section>`;
  }
  async function mount(host,id,updated){
    host.className='overextension-indicator';host.textContent='Loading overextension…';
    try{
      const data=await get(updated),q=lookup(data,id);
      if(!host.isConnected)return;
      if(!q){host.innerHTML='<h3>Overextension</h3><p>No current reading. This indicator needs 699 uninterrupted daily closes; short or incomplete histories are left blank.</p>';return;}
      if(!/^overextension\/[a-f0-9]{20}\.json\.gz$/.test(q.chart_file))throw Error('Overextension history is unavailable.');
      if(!cache.has(q.chart_file)){if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(q.chart_file,MarketLabData.json('cube/'+q.chart_file).catch(e=>{cache.delete(q.chart_file);throw e;}));}
      const h=await cache.get(q.chart_file);
      if(h.version!==VERSION||h.updated!==updated||h.id!==q.id)throw Error('Overextension history belongs to another update.');
      if(!host.isConnected)return;
      let limit=histories.get(q.id)||252;
      function paint(){
        host.innerHTML=`<article class="an-card"><header><h3>Overextension</h3><strong>${value(q.signed)}</strong></header><div class="an-legend"><span>Daily · your Pine rules</span><label>History <select aria-label="Overextension history"><option value="252">1 year</option><option value="756">3 years</option><option value="1260">5 years</option></select></label><span>Thresholds +99 / −97</span></div><div class="an-plot"></div><p class="an-readout"></p></article><details><summary>Current reading &amp; how it works</summary>${readings(q)}<p>${esc(data.methodology)}</p></details>`;
        const select=host.querySelector('select');select.value=String(limit);select.onchange=()=>{limit=Number(select.value);histories.set(q.id,limit);paint();host.querySelector('select').focus({preventScroll:true});};
        host.querySelector('article').insertAdjacentHTML('afterend',historicalContext(h,q.signed));
        const dates=h.dates.slice(-limit),scores=h.signed.slice(-limit),topCross=h.top_cross.slice(-limit),bottomCross=h.bottom_cross.slice(-limit);
        const c=MarketLab.colors(),palette=[c.muted,'rgba(69,167,150,.25)','rgba(69,167,150,.45)','rgba(69,167,150,.65)','rgba(69,167,150,.85)','#45a796','rgba(207,91,105,.3)','rgba(207,91,105,.5)','rgba(207,91,105,.75)','#cf5b69'];
        const tier=v=>v<0?(Math.abs(v)>=96?5:Math.abs(v)>=85?4:Math.abs(v)>=75?3:Math.abs(v)>=65?2:Math.abs(v)>=50?1:0):(v>=96?9:v>=85?8:v>=75?7:v>=65?6:0);
        MarketLabAnalytics.plot(host.querySelector('.an-plot'),dates,palette.map((color,j)=>({color,type:'bars',values:scores.map(v=>Number.isFinite(v)&&tier(v)===j?v:null)})),{
          label:'Overextension',panelKey:'overextension:'+q.id,domain:[-105,105],height:280,format:v=>v.toFixed(0),
          referenceLines:[{value:99,label:'+99'},{value:-97,label:'−97'},{value:-50},{value:-80}],
          onCursor:i=>{host.querySelector('.an-readout').textContent=dates[i]+' · '+value(scores[i])+(topCross[i]===1?' · New upside threshold crossing':bottomCross[i]===1?' · New downside threshold crossing':'');}
        });
      }
      paint();
    }catch(e){if(host.isConnected){host.textContent=e.message+' ';const b=document.createElement('button');b.type='button';b.textContent='Retry';b.onclick=()=>mount(host,id,updated);host.append(b);}}
  }
  window.MarketLabOverextension={VERSION,get,history,align,barColor,overlaySeries,lookup,top,readings,status,streakStats,streakCell,historicalContext,mount};
})();
