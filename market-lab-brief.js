(()=>{
  const M=window.MarketLabBriefModel;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
  const signed=(n,d=1)=>{if(!Number.isFinite(n))return '—';const rounded=Number(n.toFixed(d));return (rounded>0?'+':'')+rounded.toFixed(d);};
  const pct=n=>Number.isFinite(n)?signed(n)+'%':'—';
  const delta=(n,p,suffix='')=>Number.isFinite(n)&&Number.isFinite(p)?signed(n-p)+suffix:'—';
  const set=(id,html)=>{document.querySelector('#'+id+' .body').innerHTML=html;};
  const link=(id,text)=>`<a href="${esc(M.chartUrl(id))}">${esc(text||id)}</a>`;
  const note=text=>`<p class="note">${esc(text)}</p>`;
  let brief,signals,scope='mycoverage',showAll=false;
  try{scope=localStorage.getItem('ml-brief-scope')||scope;}catch(_){}
  if(!['all','baskets','mycoverage','fredcoverage'].includes(scope))scope='mycoverage';
  async function get(name){const r=await fetch('cube/'+name,{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(name);return window.MarketLabReadJSON(r);}
  function risk(){
    const r=brief.risk;
    const state=v=>v==null?'Unavailable':v?'On':'Off';
    set('risk',`<p class="big">${esc(r.status)} · ${r.active}/${r.known} flags</p><div class="table-scroll"><table><tbody>${r.flags.map(f=>`<tr><td>${esc(f.label)}</td><td>${esc(f.reading)}</td><td class="n">${f.active?'<b class="dn">On</b>':state(f.active)}</td></tr>`).join('')}</tbody></table></div>`+
      `<p class="note">VIX3M/VIX ${num(r.ratio,2)} (${esc(r.zone)}) · total-market correlation ${num(r.corr_total,3)} · ${num(r.above50_sp)}% of S&amp;P above the 50-day.${r.known<4?' '+(4-r.known)+' risk readings unavailable.':''}</p>`+
      `<details><summary>Changes &amp; index trends</summary><div class="risk-strip"><span><b>${num(r.above50_sp)}%</b> above 50D<small>${delta(r.above50_sp,r.previous_above50,' pp')} vs prior close</small></span><span><b>${num(r.ratio,2)}</b> VIX3M / VIX<small>Previous ${num(r.previous_ratio,2)}</small></span><span><b>${num(r.corr_total,3)}</b> market correlation<small>Previous ${num(r.previous_corr,3)}</small></span></div>`+
      `<div class="brief-trends">${r.trends.map(t=>`<span>${link(t.symbol)} <b>${esc(t.state)}</b><small>${t.previous!==t.state?'Was '+esc(t.previous):'Unchanged'} · ${signed(t.distance)}% vs 21 EMA</small></span>`).join('')}</div>`+
      `<p class="note">Previous close ${esc(brief.previous_date)}</p><div class="table-scroll"><table><thead><tr><th>Measure</th><th>Now</th><th>Previous</th><th>Reading</th></tr></thead><tbody>${r.flags.map(f=>`<tr><td>${esc(f.label)}</td><td>${state(f.active)}</td><td>${state(f.previous?.active)}</td><td>${esc(f.reading)}<small>Previous: ${esc(f.previous?.reading||'Unavailable')}</small></td></tr>`).join('')}</tbody></table></div></details>`);
  }
  function relevant(t,rows){
    if(t.kind==='regime'||t.kind==='zone')return true;
    const symbols=new Set(rows.map(r=>r.symbol));
    if(t.kind==='basket')return brief.groups.find(g=>g.id===t.key)?.members.some(s=>symbols.has(s));
    return symbols.has(t.key);
  }
  function eventText(t){return t.kind==='basket'?(brief.groups.find(g=>g.id===t.key)?.label||t.key)+' · '+t.text.replace(t.key+' ',''):t.text;}
  function eventItem(t,rows){const r=rows.find(r=>r.symbol===t.key);return `<li>${r?link(r.id,t.key)+' · ':''}${esc(r?t.text.replace(t.key+' ',''):eventText(t))}</li>`;}
  function render(){
    if(!brief)return;
    const cloud=window.MarketLabCloud?.state,rows=M.scopeRows(brief,scope,cloud);
    window.MarketLabOptionsActivity?.render({brief,rows,scope});
    document.getElementById('brief-scope').value=scope;
    document.getElementById('scope-status').textContent=`${rows.length.toLocaleString()} stocks · ${rows.filter(r=>!r.fresh).length} stale / closed market`;
    document.getElementById('basket-notice').innerHTML=scope==='baskets'&&!cloud?.available?MarketLabCloud.basketNotice():scope==='baskets'&&!cloud.baskets.length?note('No saved baskets yet. Create one in Charts.') : '';
    risk();
    const records=side=>rows.filter(r=>r.record===side).length,priorRecords=side=>rows.filter(r=>r.previous_record===side).length;
    document.getElementById('records-summary').textContent=`52W highs ${records('high52')} (${signed(records('high52')-priorRecords('high52'),0)}) · lows ${records('low52')} (${signed(records('low52')-priorRecords('low52'),0)}) vs previous close`;
    const picks=['up','down'].flatMap(side=>M.attention(rows,signals,side,brief.thresholds));
    set('opp',`<div class="table-scroll"><table><thead><tr><th>Stock</th><th>Extreme</th><th class="n">Score / change</th><th class="n">5D volume</th><th class="n">Extreme sessions</th><th></th></tr></thead><tbody>${picks.map(r=>{
      const e=r.extension,v=r.volume;
      return `<tr><td>${link(r.id,r.symbol)}<small>${esc(r.name)}</small></td><td>${e.side==='up'?'Upside':'Downside'}<small>${r.new?'Newly triggered':esc(e.phase)}</small></td><td class="n">${signed(e.score)}<small>${signed(e.change)} points</small></td><td class="n">${num(v.ratio,2)}×<small>${signed(v.change,2)}× vs prior</small></td><td class="n">${e.start_known?'':'≥'}${num(e.sessions,0)}<small>median ${num(e.median)} · avg ${num(e.average)} · n=${e.completed}</small></td><td><button type="button" data-journal-symbol="${esc(r.symbol)}">Journal</button></td></tr>`;
    }).join('')}</tbody></table></div>`+['up','down'].filter(side=>!picks.some(r=>r.extension.side===side)).map(side=>note(`No qualifying ${side==='up'?'upside':'downside'} extremes in this scope.`)).join(''));
    const groups=M.groups(brief,rows,scope,cloud).slice(0,5);
    set('groups',groups.length?`<div class="table-scroll"><table><thead><tr><th>${scope==='baskets'?'My basket':'Theme / basket'}</th><th class="n">5D pace</th><th class="n">Accelerating</th><th>Largest contributor</th><th class="n">Coverage</th></tr></thead><tbody>${groups.map(g=>{const v=g.volume;return `<tr><td>${esc(g.label)}</td><td class="n">${num(v.ratio,2)}×<small>${signed(v.change,2)}× vs prior</small></td><td class="n">${v.accelerating}/${v.eligible}</td><td>${link(rows.find(r=>r.symbol===v.driver)?.id||v.driver,v.driver)}<small>${num(v.driver_share*100,0)}% of recent USD volume</small></td><td class="n">${v.eligible}/${v.total}</td></tr>`;}).join('')}</tbody></table></div>`:note('No groups have enough fresh volume data in this scope.'));
    const news=(signals?.new||[]).filter(t=>relevant(t,rows));
    set('fresh',signals?news.length?`<ul class="clean">${news.slice(0,6).map(t=>eventItem(t,rows)).join('')}</ul>${news.length>6?`<details><summary>${news.length-6} more changes</summary><ul class="clean">${news.slice(6).map(t=>eventItem(t,rows)).join('')}</ul></details>`:''}`:note('No new triggers this session.'):note('Trigger feed unavailable; daily readings remain available.'));
    const episodes=(signals?.episodes||[]).filter(t=>relevant(t,rows)).sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key)),shown=showAll?episodes:episodes.slice(0,8);
    set('follow',shown.length?`<div class="table-scroll"><table><thead><tr><th>Observed</th><th>Stock / trigger</th><th>State</th><th class="n">Sessions</th><th class="n">Since</th><th class="n">Best close</th><th class="n">Worst close</th><th></th></tr></thead><tbody>${shown.map(e=>{const row=rows.find(r=>r.symbol===e.key),o=e.outcome;return `<tr><td>${esc(e.date)}${e.baseline?'<small>First observed</small>':''}</td><td>${link(row?.id||e.key,e.key)}<small>${e.kind==='ext'?(e.direction==='up'?'Upside':'Downside')+' extreme + volume':e.direction==='high52'?'52W high':'52W low'}</small></td><td>${esc(e.status)}</td><td class="n">${o?.sessions??'—'}</td><td class="n">${pct(o?.return)}</td><td class="n">${pct(o?.best)}</td><td class="n">${pct(o?.worst)}</td><td><button type="button" data-journal-event="${esc(e.id)}">Journal</button></td></tr>`;}).join('')}</tbody></table></div>${episodes.length>8?`<button type="button" id="show-follow">${showAll?'Show less':'Show all '+episodes.length}</button>`:''}`:note('No tracked triggers in this scope yet. Tracking starts with this release.'));
    document.getElementById('show-follow')?.addEventListener('click',()=>{showAll=!showAll;render();});
    const earnings=brief.earnings.filter(e=>rows.some(r=>r.symbol===e.symbol));
    document.getElementById('earn-count').textContent=earnings.length;
    set('earn',earnings.length?`<table><tbody>${earnings.map(e=>`<tr><td>${esc(e.date)}</td><td>${link(rows.find(r=>r.symbol===e.symbol)?.id||e.symbol,e.symbol)} · ${esc(e.name)}</td></tr>`).join('')}</tbody></table>`:note('No stored upcoming earnings in this scope for the next two weeks.'));
    const bookRows=brief.books.filter(b=>scope==='all'||scope==='baskets'||b.book===scope);
    set('books',`<table><thead><tr><th>Coverage</th><th class="n">Day</th><th>Open names</th></tr></thead><tbody>${bookRows.map(b=>`<tr><td>${b.book==='mycoverage'?'Mine':b.book==='fredcoverage'?'Fred':esc(b.book)}</td><td class="n">${pct(b.day_pct)}</td><td>${b.open.map(t=>link(brief.stocks.find(r=>r.symbol===t)?.id||t,t)).join(' · ')}</td></tr>`).join('')}</tbody></table>`);
    const history=(signals?.history||[]).slice().reverse().map(day=>({date:day.date,triggers:day.triggers.filter(t=>(t.kind!=='ext'||day.rule_version===2)&&relevant(t,rows))})).filter(day=>day.triggers.length);
    set('hist',history.length?history.map(day=>`<h3>${esc(day.date)}</h3><ul class="clean">${day.triggers.map(t=>eventItem(t,rows)).join('')}</ul>`).join(''):note('No trigger history for this scope.'));
  }
  document.getElementById('brief-scope').onchange=event=>{scope=event.target.value;try{localStorage.setItem('ml-brief-scope',scope);}catch(_){}render();};
  window.addEventListener('ml:cloudchange',render);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-journal-symbol],[data-journal-event]');if(!button||!brief)return;
    const episode=signals?.episodes?.find(e=>e.id===button.dataset.journalEvent),symbol=episode?.key||button.dataset.journalSymbol,row=brief.stocks.find(r=>r.symbol===symbol);
    const thesis=episode?`${episode.date} · ${episode.text}`:`${brief.as_of} · ${symbol} · ${row.extension.side==='up'?'Upside':'Downside'} extreme ${signed(row.extension.score)} · 5D volume ${num(row.volume.ratio,2)}×`;
    window.MarketLabJournal?.openDraft({date:brief.as_of,book:['mycoverage','fredcoverage'].includes(scope)?scope:'',tickers:[symbol],thesis});
  });
  async function load(){
    try{
      brief=await get('brief.json');if(brief.schema!==2)throw Error('Edition mismatch');
      document.getElementById('asof').textContent='updated '+brief.as_of;
      render();window.MarketLabJournal?.init(brief.books);
      try{signals=await get('signals.json');if(signals.schema!==2||signals.as_of!==brief.as_of)signals=null;}catch(_){signals=null;}
      render();
    }catch(_){document.getElementById('load-error').hidden=false;}
  }
  document.getElementById('brief-retry').onclick=()=>{document.getElementById('load-error').hidden=true;load();};
  load();
})();
