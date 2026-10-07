/* Current cloud baskets, equal initial basket allocations, buy-and-hold attribution. */
((root)=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,suffix='%')=>Number.isFinite(v)?`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)}${suffix}`:'—';
  function point(series,index){
    const values=series?._pr||series?.lv;
    if(!values||!Number.isInteger(series.i0))return null;
    for(let i=Math.min(index,series.i0+values.length-1);i>=series.i0;i--){
      const value=values[i-series.i0];
      if(Number.isFinite(value)&&value>0)return {value,index:i};
    }
    return null;
  }
  function calculate(baskets,series,dates,start,end){
    const weight=baskets.length?1/baskets.length:0;
    const rows=baskets.map(b=>{
      const members=[...new Set(b.members||[])];
      const returns=[], missing=[];
      for(const id of members){
        const a=point(series[id],start),z=point(series[id],end);
        const stale=p=>p&&(Date.parse(dates[end])-Date.parse(dates[p.index]))/86400000>7;
        if(!a||!z||stale(z))missing.push(id);
        else returns.push((z.value/a.value-1)*100);
      }
      const value=members.length&&!missing.length&&end>start?returns.reduce((a,b)=>a+b,0)/members.length:null;
      return {...b,members,missing,weight,value,contribution:value==null?null:value*weight};
    }).sort((a,b)=>(b.contribution??-Infinity)-(a.contribution??-Infinity)||a.name.localeCompare(b.name));
    const complete=rows.length>0&&rows.every(r=>r.value!=null);
    return {rows,complete,total:complete?rows.reduce((sum,r)=>sum+r.contribution,0):null};
  }
  function mount({panel,dates,asOf,series,ensure,cloud}){
    if(!panel)return;
    panel.hidden=false;
    panel.classList.add('book-panel');
    panel.innerHTML=`<header><div><h2>My book</h2><span class="book-updated">updated ${esc(asOf)}</span></div><label>Period <select aria-label="Book return period"><option value="5">1 week</option><option value="21">1 month</option><option value="63">3 months</option><option value="ytd" selected>YTD</option><option value="252">1 year</option></select></label></header><div class="book-content" aria-live="polite"></div>`;
    const body=panel.querySelector('.book-content'),select=panel.querySelector('select');
    let generation=0;
    async function render(){
      const ticket=++generation;
      if(!cloud.state.available){body.innerHTML=cloud.basketNotice();return;}
      const records=cloud.state.baskets.map(b=>({...b,members:[...b.members]}));
      if(!records.length){body.textContent='Save a cloud basket to build your book.';return;}
      body.textContent='Loading basket returns…';
      const end=dates.findLastIndex(d=>d<=asOf);
      const start=select.value==='ytd'?Math.max(0,dates.findIndex(d=>d>=asOf.slice(0,4)+'-01-01')-1):Math.max(0,end-Number(select.value));
      // Load each basket independently so one missing asset doesn't hide others.
      const errors={};
      await Promise.all(records.map(async b=>{try{await ensure(b);}catch(e){errors[b.id]=e.message;}}));
      if(ticket!==generation)return;
      const result=calculate(records,series,dates,start,end);
      for(const row of result.rows)if(errors[row.id]){row.value=null;row.contribution=null;row.error=errors[row.id];}
      result.complete=result.rows.every(r=>r.value!=null);
      result.total=result.complete?result.rows.reduce((sum,r)=>sum+r.contribution,0):null;
      result.rows.sort((a,b)=>(b.contribution??-Infinity)-(a.contribution??-Infinity)||a.name.localeCompare(b.name));
      const max=Math.max(.01,...result.rows.map(r=>Math.abs(r.contribution||0)));
      body.innerHTML=`<div class="book-window">${esc(dates[start])} → ${esc(dates[end])} · ${(100/records.length).toFixed(2)}% starting weight each</div><div class="book-table"><table><thead><tr><th>Basket</th><th>Contribution to book</th><th>Basket return</th><th>Return contribution</th></tr></thead><tbody>${result.rows.map((r,i)=>{
        const negative=r.contribution<0,w=Math.abs(r.contribution||0)/max*50;
        return `<tr><th scope="row"><div class="book-name"><span class="book-rank">${String(i+1).padStart(2,'0')}</span><div><a href="market-lab-themes.html#saved:${encodeURIComponent(r.id)}">${esc(r.name)}</a><div class="book-members">${r.members.slice(0,4).map(id=>`<span class="book-ticker">${esc(id)}</span>`).join('')}<span>${r.members.length} names</span></div>${r.value==null?`<small class="book-unavailable">${esc(r.error||('Unavailable for this period'+(r.missing.length?': '+r.missing.join(', '):'')))}</small>`:''}</div></div></th><td><div class="book-track" aria-label="${esc(r.name)}: ${fmt(r.contribution,'pp')}"><span class="book-zero"></span><span class="book-bar ${negative?'negative':''}" style="left:${negative?50-w:50}%;width:${w}%"></span></div></td><td class="book-number ${r.value<0?'negative':'positive'}">${fmt(r.value)}</td><td class="book-number book-pp ${negative?'negative':'positive'}">${fmt(r.contribution,'pp')}</td></tr>`;
      }).join('')}</tbody></table></div><footer><span><strong>${fmt(result.total)}</strong> book return · ${records.length} baskets${!result.complete?' · incomplete coverage':''}</span><details><summary>Methodology &amp; detail</summary><p>Each saved cloud basket receives 1/${records.length} of the starting book. Its current members are equally weighted at the period start and held through the end. Contribution = basket return ÷ ${records.length}; contributions sum to the book return.</p><p>Current holdings are applied retrospectively. Overlapping stocks count in each basket. Price returns exclude dividends, fees and FX conversion. This is a model book, not a record of actual trades. Local-market holidays use the last available close; prices over seven calendar days old are unavailable. Missing history keeps the basket's weight reserved and the total unavailable.</p></details></footer>`;
    }
    select.addEventListener('change',render);
    window.addEventListener('ml:cloudchange',render);
    panel.addEventListener('click',e=>{if(e.target.closest('[data-cloud-retry]'))cloud.refresh();});
    render();
  }
  root.MarketLabBook={calculate,mount};
  if(typeof module!=='undefined')module.exports={calculate,point};
})(typeof window==='undefined'?globalThis:window);
