/* Daily chain observations. Trade direction and opening/closing intent are unknown. */
(()=>{
  const current=(r,p)=>r.quality==='complete'&&r.latest?.date===p.session;
  const relative=r=>Math.max(r.latest?.call_relative||0,r.latest?.put_relative||0);
  function select(p,rows,scope){
    const symbols=new Set(rows.map(r=>r.symbol));
    return p.rows.filter(r=>scope==='all'||symbols.has(r.symbol)).slice().sort((a,b)=>
      Number(current(b,p))-Number(current(a,p))||
      (current(a,p)&&current(b,p)?relative(b)-relative(a)||
        (b.latest.call_volume+b.latest.put_volume)-(a.latest.call_volume+a.latest.put_volume):0)||a.symbol.localeCompare(b.symbol));
  }
  function combined(r,p,stock,brief){
    return Boolean(current(r,p)&&relative(r)>=2&&stock?.fresh&&p.session===brief.as_of&&
      Number.isFinite(stock.extension?.score)&&
      (stock.extension.score>=brief.thresholds.top||stock.extension.score<=brief.thresholds.bottom)&&
      stock.volume?.ratio>=brief.thresholds.volume);
  }
  const api={select,current,combined};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window==='undefined')return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(v)?v.toLocaleString('en-US'):'—';
  const rx=v=>Number.isFinite(v)?v.toFixed(2)+'×':'—';
  const signed=v=>Number.isFinite(v)?(v>0?'+':'')+n(v):'—';
  let payload,context,loading=false,error=false,all=false,selected=null;
  function details(r){
    const l=r.latest;
    if(!l)return `<p class="note">${esc(r.attempt?.message||'Collection pending.')}</p>`;
    const persistence=side=>[5,20].map(w=>{const v=l[side+'_persistence_'+w];return `${w}D: ${v?.hits||0}/${v?.observed||0} eligible observations`;}).join(' · ');
    return `<p class="note">Observed ${esc(l.date)} · ${n(l.contracts)} contracts · ${esc(r.expiries.join(', '))}<br>Baseline: ${l.baseline_n} comparable prior observations (minimum 5; up to 20 sessions).<br>Calls ≥2× · ${persistence('call')}<br>Puts ≥2× · ${persistence('put')}<br>OI comparison: ${esc(l.oi_previous_date||'waiting for an adjacent session')} · ${n(l.oi_matched)} matched contracts.</p>`+
      (r.problems?.length?`<p class="note">Coverage: ${esc(r.problems.join(', '))}</p>`:'')+
      `<p class="note">Largest contracts by daily volume · share of observed volume</p><div class="table-scroll"><table><thead><tr><th>Expiry</th><th>Contract</th><th class="n">Volume</th><th class="n">Share</th></tr></thead><tbody>${r.top_contracts.map(c=>`<tr><td>${esc(c.expiry)}</td><td>${n(c.strike)} ${esc(c.side)}</td><td class="n">${n(c.volume)}</td><td class="n">${(c.share*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`+
      `<details><summary>Daily observations</summary><div class="table-scroll"><table><thead><tr><th>Date</th><th class="n">Calls</th><th class="n">Puts</th><th class="n">Call / put relative</th></tr></thead><tbody>${r.history.slice().reverse().map(h=>`<tr><td>${esc(h.date)}</td><td class="n">${n(h.call_volume)}</td><td class="n">${n(h.put_volume)}</td><td class="n">${rx(h.call_relative)} / ${rx(h.put_relative)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function render(next){
    if(next)context=next;
    const el=document.querySelector('#options-activity .body');if(!el||!context)return;
    if(!payload){
      el.innerHTML=error?'<p class="note">Options pilot unavailable. <button type="button" data-options-retry>Retry</button></p>':'<p class="note">Loading daily observations…</p>';
      if(!loading&&!error)load();return;
    }
    const {rows,scope,brief}=context,scoped=select(payload,rows,scope),shown=all?scoped:scoped.slice(0,10);
    const complete=scoped.filter(r=>current(r,payload)),eligible=complete.filter(r=>Number.isFinite(r.latest.call_relative)||Number.isFinite(r.latest.put_relative));
    const pending=complete.filter(r=>r.latest.baseline_n<5).length;
    const outside=rows.filter(r=>!payload.rows.some(p=>p.symbol===r.symbol)).length;
    const state={deferred_market_open:'Collection waits until after 5 p.m. New York.',calendar_unavailable:'Calendar unavailable; observations may be stale.',provider_paused:'Provider requests paused after repeated errors. Remaining names will retry next session.',collecting:'Collection in progress.'}[payload.status];
    el.innerHTML=`<p class="note">Options close ${esc(payload.session||'pending')} · price context ${esc(brief.as_of)}<br>${complete.length}/${scoped.length} complete in this scope · ${eligible.length} with relative-volume readings${pending?' · '+pending+' building baseline':''}${outside?' · '+outside+' scope stocks outside this fixed pilot':''}</p>`+
      (state?`<p class="note">${esc(state)}</p>`:'')+
      (payload.session!==brief.as_of?'<p class="note">Price and options dates differ. Combined extreme + volume alerts are waiting for matching dates.</p>':'')+
      (!eligible.length?'<p class="note">Relative readings need five comparable prior days and a positive baseline. Ranked by observed contract volume during warm-up.</p>':'<p class="note">Ranked by the larger call or put relative-volume reading; then daily contract volume.</p>')+
      (scoped.length?`<div class="table-scroll"><table><thead><tr><th>Stock</th><th class="n">Call volume</th><th class="n">Put volume</th><th class="n">Call / put relative</th><th class="n">Matched OI Δ</th></tr></thead><tbody>${shown.map(r=>{
        const l=r.latest,ok=current(r,payload),stock=rows.find(s=>s.symbol===r.symbol);
        const label=ok?(l.baseline_n<5?'Baseline '+l.baseline_n+'/5 prior days':'Baseline '+l.baseline_n+' days'):l?(l.date!==payload.session?'Stale · '+l.date:'Partial coverage'):(r.attempt?.status==='no_monthly_chain'?'No eligible chain':'Unavailable / pending');
        return `<tr><td><a href="${esc(window.MarketLabBriefModel.chartUrl(stock?.id||r.symbol))}">${esc(r.symbol)}</a> <button type="button" data-options-detail="${esc(r.symbol)}" aria-label="${esc(r.symbol)} option details" aria-expanded="${selected===r.symbol}" style="border:0;padding:0 5px;background:transparent">···</button><small>${esc(label)}${combined(r,payload,stock,brief)?'<br>Extreme + stock volume + options activity':''}</small></td><td class="n">${ok?n(l.call_volume):'—'}</td><td class="n">${ok?n(l.put_volume):'—'}</td><td class="n">${ok?rx(l.call_relative)+' / '+rx(l.put_relative):'—'}</td><td class="n">${ok?signed(l.oi_change):'—'}</td></tr>`;
      }).join('')}</tbody></table></div>${scoped.length>10?`<button type="button" data-options-all>${all?'Show top 10':'Show all '+scoped.length}</button>`:''}`:'<p class="note">No pilot stocks in this scope. Choose another scope to view the fixed pilot.</p>')+
      (selected&&scoped.some(r=>r.symbol===selected)?`<div data-options-panel><h3>${esc(selected)} · option details</h3>${details(scoped.find(r=>r.symbol===selected))}</div>`:'')+
      `<details><summary>Coverage &amp; calculation</summary><p class="note">${payload.rows.length} fixed US-listed stocks. Three nearest standard monthly expirations at least seven days away; weekly and 0DTE contracts are excluded. Coverage names are prioritized, then liquid theme members. Your basket filter uses current saved membership within this pilot.</p><p class="note">Relative volume divides today’s call or put contracts by their mean over up to 20 prior market sessions with the same expirations; at least five complete observations are required. ≥2× is an activity flag. Expiry changes restart the comparable baseline. Inactive contracts’ carried-over volume is set to zero. Missing data stays unavailable.</p><p class="note">Open interest can lag. OI Δ compares matched contracts between adjacent collected sessions and does not establish opening trades. Calls and puts may be bought, sold, hedged or part of spreads. Bid/ask trade classification is unavailable.</p><p class="note">Yahoo Finance via yfinance · unofficial personal-use data, potentially delayed or incomplete. A snapshot is collected after the close during your normal update run, at most once per session. Historical observations accumulate from this pilot’s start.</p></details>`;
  }
  async function load(){
    loading=true;error=false;
    try{const r=await fetch('cube/options-activity.json',{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();payload=await r.json();if(payload.schema!==1||!Array.isArray(payload.rows))throw Error();}
    catch(_){payload=null;error=true;}
    finally{loading=false;render();}
  }
  document.addEventListener('click',e=>{
    const detail=e.target.closest('[data-options-detail]');
    if(detail){selected=selected===detail.dataset.optionsDetail?null:detail.dataset.optionsDetail;render();}
    if(e.target.closest('[data-options-all]')){all=!all;render();}
    if(e.target.closest('[data-options-retry]'))load();
  });
  window.MarketLabOptionsActivity={...api,render};
})();
