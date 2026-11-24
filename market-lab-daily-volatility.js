/* Observed daily price returns in the selected chart window, not annualized risk. */
(()=>{
  const quantile=(sorted,p)=>{if(!sorted.length)return null;const x=(sorted.length-1)*p,a=Math.floor(x),b=Math.ceil(x);return sorted[a]+(sorted[b]-sorted[a])*(x-a);};
  function calculate(levels,dates,offset,from,to){
    const observations=[];
    for(let i=Math.max(from,offset+1);i<=Math.min(to,offset+levels.length-1);i++){
      const a=levels[i-offset-1],b=levels[i-offset];
      if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)continue;
      observations.push({date:dates[i],value:(b/a-1)*100});
    }
    const sorted=observations.map(r=>r.value).sort((a,b)=>a-b),up=sorted.filter(v=>v>0),down=sorted.filter(v=>v<0);
    const latest=observations.at(-1)||null;
    const result={count:sorted.length,upCount:up.length,downCount:down.length,flatCount:sorted.filter(v=>v===0).length,
      typicalUp:quantile(up,.5),typicalDown:quantile(down,.5),normalLow:quantile(sorted,.1),normalHigh:quantile(sorted,.9),
      outlierLow:quantile(sorted,.05),outlierHigh:quantile(sorted,.95),latest,short:sorted.length<30};
    if(latest){
      latest.percentile=100*(sorted.filter(v=>v<latest.value).length+.5*sorted.filter(v=>v===latest.value).length)/sorted.length;
      latest.label=latest.value<result.outlierLow||latest.value>result.outlierHigh?'Outlier':latest.value<result.normalLow||latest.value>result.normalHigh?'Outside normal range':'Within normal range';
    }
    return result;
  }
  const pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(2)+'%':'—';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(s,from,to){
    const metric=(label,value,note)=>`<div><dt>${label}</dt><dd>${value}</dd><small>${note}</small></div>`;
    return `<div class="daily-volatility" data-sample-count="${s.count}" data-from="${esc(from)}" data-to="${esc(to)}"><h3>Normal daily movement</h3><p class="daily-volatility-window">${esc(from)} → ${esc(to)} · ${s.count} daily returns</p>${!s.count?'<p>No consecutive daily closes in this period.</p>':`<dl>${metric('Typical up day',pct(s.typicalUp),`Median of ${s.upCount} up days`)}${metric('Typical down day',pct(s.typicalDown),`Median of ${s.downCount} down days`)}${metric('Normal daily range',`${pct(s.normalLow)} to ${pct(s.normalHigh)}`,'10th–90th percentiles · middle 80%')}${metric('Outlier thresholds',`${pct(s.outlierLow)} / ${pct(s.outlierHigh)}`,'Below / above · outer 5% on each side')}</dl><p class="daily-volatility-latest">Latest in this window: <strong>${pct(s.latest.value)}</strong> · ${esc(s.latest.date)}<br>${s.latest.label} · daily-return percentile rank ${s.latest.percentile.toFixed(0)}/100.</p>${s.short?'<p class="daily-volatility-warning" role="status">Short history: fewer than 30 daily returns. These ranges are provisional.</p>':''}<details><summary>How this is measured</summary><p>Each move compares a daily close with the previous session’s close, including the close just before your selected start date when available. Missing or invalid prices are skipped, never joined into a multi-day move. Up and down medians exclude flat days; the ranges include all valid days, including ${s.flatCount} flat days. Percentiles are interpolated from the observed returns. The latest day is included in its comparison; tied returns share a rank. Historical ranges are not limits on future moves.</p></details>`}</div>`;
  }
  let indexPromise;const cache=new Map();
  async function mount(host,id,from,to,updated){
    host.onclick=e=>e.stopPropagation();host.ondblclick=e=>e.stopPropagation();
    host.textContent='Loading daily movement…';
    try{
      if(!indexPromise)indexPromise=MarketLabData.json('cube/trend-index.json').catch(e=>{indexPromise=null;throw e;});
      const index=await indexPromise;
      if(index.updated!==updated)throw Error('Daily movement is waiting for the matching price update.');
      const key=String(id).toLowerCase(),row=index.series.find(r=>String(r.id).toLowerCase()===key||r.stem.toLowerCase()===key);
      if(!row)throw Error('Daily movement is available for individual assets with stored daily closes.');
      if(!cache.has(row.file)){if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(row.file,MarketLabData.json('cube/'+row.file).then(MarketLabTrendMath.decode).catch(e=>{cache.delete(row.file);throw e;}));}
      const data=await cache.get(row.file);if(!host.isConnected)return;
      const first=data.dates.findIndex(d=>d>=from),last=data.dates.findLastIndex(d=>d<=to);
      const s=first<0?calculate([],[],0,0,0):calculate(data.close,data.dates,0,first,last);
      host.innerHTML=render(s,from,to);
    }catch(e){if(host.isConnected)host.textContent=e.message;}
  }
  window.MarketLabDailyVolatility={calculate,render,mount};
})();
