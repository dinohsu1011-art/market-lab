/* Home's compact daily momentum ranking; reuses the screener's published edition. */
(()=>{
  const host=document.getElementById('home-momentum');
  if(!host)return;
  if(document.documentElement.dataset.workspace!=='home'){host.remove();return;}
  host.hidden=false;
  const M=window.MarketLabMomentum,O=window.MarketLabOverextension;
  const GROUPS={...M.PHASE_GROUPS,extension_up:{label:'Upside overextension',description:'Most unusually stretched above the 200-day average, using your Pine indicator. Ranked by extension score.'},extension_down:{label:'Downside overextension',description:'Most unusually stretched below the 200-day average, using your Pine indicator. Ranked by extension score.'}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number.isFinite(v)?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(v):'—';
  const pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(1)+'%':'—';
  let rows=[],source=[],themes=[],updated='',expanded=null,group='strongest',stretchedOnly=false,phaseVersion=null,extensionData=null,extensionError='',themeFilter='',basketFilter='';
  const cloud=()=>window.MarketLabCloud?.state;
  const savedBaskets=()=>cloud()?.available?(cloud().baskets||[]):[];
  const ALL_BASKETS='__all_baskets__';
  function filteredSource(){
    const baskets=savedBaskets().filter(b=>basketFilter===ALL_BASKETS||String(b.id)===basketFilter);
    const members=new Set(baskets.flatMap(b=>b.members||[]).map(id=>String(id).toLowerCase()));
    return source.filter(r=>(!themeFilter||(r.themes||[]).includes(themeFilter))&&(!basketFilter||members.has(r.id.toLowerCase())));
  }
  function filterControls(){
    const options=groups=>groups.slice().sort((a,b)=>a.label.localeCompare(b.label)).map(g=>`<option value="${esc(g.id)}" ${g.id===themeFilter?'selected':''}>${esc(g.label)}</option>`).join('');
    const baskets=savedBaskets().slice().sort((a,b)=>a.name.localeCompare(b.name));
    return `<label>Industry / theme <select id="home-momentum-theme"><option value="">All industries &amp; themes</option><optgroup label="Industries">${options(themes.filter(g=>g.id.startsWith('industry_')))}</optgroup><optgroup label="Themes">${options(themes.filter(g=>!g.id.startsWith('industry_')))}</optgroup></select></label><label>My basket <select id="home-momentum-basket"><option value="" ${!basketFilter?'selected':''}>All stocks</option><option value="${ALL_BASKETS}" ${basketFilter===ALL_BASKETS?'selected':''}>All baskets</option>${baskets.map(b=>`<option value="${esc(b.id)}" ${String(b.id)===basketFilter?'selected':''}>${esc(b.name)}</option>`).join('')}${basketFilter&&basketFilter!==ALL_BASKETS&&!baskets.some(b=>String(b.id)===basketFilter)?`<option value="${esc(basketFilter)}" selected>Selected basket unavailable</option>`:''}</select></label>${themeFilter||basketFilter?'<button type="button" data-momentum-reset>Clear filters</button>':''}`;
  }
  const signed=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(2)+'×':'—';
  function flags(r){const p=r.momentum_phase;if(p?.version!==M.PHASE_VERSION||p.updated!==updated)return '';return [p.stretched?'Stretched '+p.stretch_side+' the 21-day average':'',p.weaker_high?'New high, weaker momentum':'',p.stronger_low?'New low, improving momentum':''].filter(Boolean).map(s=>`<small class="home-momentum-flag">${esc(s)}</small>`).join('');}
  function phaseDetail(r){
    const p=r.momentum_phase,turn=p.turns?.[group==='turning_up'?'up':'down'];
    return `<div class="home-momentum-detail"><header><strong>${esc(r.id)} · ${esc(GROUPS[group].label)}</strong><button type="button" data-momentum-close>Close</button></header><p>${esc(GROUPS[group].description)}</p><dl class="home-phase-readings"><div><dt>10 / 21-day average gap</dt><dd>${signed(p.level)}</dd></div><div><dt>Change over 3 sessions</dt><dd>${signed(p.change)}</dd></div><div><dt>Price vs 21-day average</dt><dd>${signed(p.extension)}</dd></div><div><dt>${group.startsWith('turning_')?'Turn confirmed':'Sessions in this phase'}</dt><dd>${group.startsWith('turning_')?esc(turn?.date||'—'):p.sessions}</dd></div></dl><p>Values are measured in normal daily ranges (21-day ATR), so a high-priced or volatile stock does not automatically rank first.</p><p>${p.stretched?`Price is unusually far ${p.stretch_side} its 21-day average. This can continue; it is not confirmation of a reversal.`:p.stretched===false?'Price does not meet the stretched threshold.':'Not enough history to assess whether this move is unusually stretched.'}</p>${p.weaker_high?'<p>Price made a new 20-session closing high, but momentum is weaker than it was at the previous high.</p>':''}${p.stronger_low?'<p>Price made a new 20-session closing low, but momentum is stronger than it was at the previous low.</p>':''}<p>Price versus longer averages: ${[50,100,200].map(n=>n+'-day '+pct(p.context?.[n])).join(' · ')}.</p></div>`;
  }
  function breakdown(r){
    const m=r.momentum;
    return `<div class="home-momentum-detail"><header><strong>${esc(r.id)} · ${m.points}/12</strong><button type="button" data-momentum-close>Close</button></header><div class="home-momentum-checks">${m.groups.map(g=>`<section><h3>${esc(g.label)} <span>${g.points}/3</span></h3><ul>${g.checks.map(c=>`<li><span aria-label="${c.pass===true?'Met':c.pass===false?'Not met':'Unavailable'}">${c.pass===true?'✓':c.pass===false?'−':'?'}</span><div>${esc(c.label)}<small>${esc(c.rule)}</small></div></li>`).join('')}</ul></section>`).join('')}</div>${m.note?`<p>${esc(m.note)}</p>`:''}</div>`;
  }
  function extensionDetail(r){return '<div class="home-momentum-detail"><header><strong>'+esc(r.id)+' · '+esc(GROUPS[group].label)+'</strong><button type="button" data-momentum-close>Close</button></header>'+O.readings(r.overextension)+'<p><a href="market-lab-themes.html#'+encodeURIComponent(r.id)+'">Open chart</a> · choose Technical for the historical indicator.</p></div>';}
  function render(){
    const isExtension=group.startsWith('extension_');
    rows=isExtension?O.top(filteredSource(),extensionData,group==='extension_up'?'upside':'downside',updated):M.phaseTop(source,group,updated,{stretchedOnly});
    const isStrength=group==='strongest';
    const reading=r=>isStrength?r.momentum.points+'/12':isExtension?(r.overextension.signed>0?'+':'')+r.overextension.signed.toFixed(1):signed(r.momentum_phase.change);
    host.innerHTML=`<header><h2>Top 10 momentum &amp; extension</h2><span class="records-caption">updated ${esc(updated)}</span></header><div class="home-momentum-controls"><label>Group <select id="home-momentum-group">${Object.entries(GROUPS).map(([key,c])=>`<option value="${key}" ${key===group?'selected':''}>${c.label}</option>`).join('')}</select></label><label ${isExtension?'hidden':''}><input type="checkbox" id="home-momentum-stretched" ${stretchedOnly?'checked':''}> Stretched only</label><span class="records-caption">US-listed stocks</span></div><p class="records-caption" role="status">${GROUPS[group].description}${!isStrength&&!isExtension?' Changes are in normal daily ranges.':''}</p><div class="records-scroll"><table><thead><tr><th>Stock</th><th>${isStrength?'Score':isExtension?'Extension score':'3-session change'}</th>${isExtension?'<th>Extreme sessions</th>':''}<th>50D vs SPY</th><th>USD volume</th></tr></thead><tbody>${rows.map(r=>`<tr data-momentum-stock="${esc(r.id)}"><td><a href="market-lab-themes.html#${encodeURIComponent(r.id)}">${esc(r.id)}</a><span>${esc(r.name)}</span>${isExtension?`<small class="home-momentum-flag">${r.overextension.zone==='none'?'Not at extreme':r.overextension.zone==='upside'?'Upside extreme':'Downside extreme'}</small>`:flags(r)}</td><td><button type="button" data-momentum-score="${esc(r.id)}" aria-expanded="${expanded===r.id}" aria-label="${esc(r.id)} ${isExtension?'extension score '+reading(r):isStrength?'momentum score '+r.momentum.points+' of 12':'momentum change '+signed(r.momentum_phase.change)}, show breakdown">${reading(r)}</button>${isStrength&&r.momentum.missing?`<small>${r.momentum.missing} unknown</small>`:''}</td>${isExtension?`<td data-extreme-streak>${O.streakCell(r.overextension,group==='extension_up'?'upside':'downside')}</td>`:''}<td>${pct(r.relative)}</td><td>${money(r.turnoverUSD?.['1D'])}</td></tr>${expanded===r.id?`<tr><td colspan="${isExtension?5:4}">${isStrength?breakdown(r):isExtension?extensionDetail(r):phaseDetail(r)}</td></tr>`:''}`).join('')}</tbody></table>${rows.length?'':`<p class="home-momentum-empty">${isExtension?esc(extensionError||'No stocks qualify for this side.'):phaseVersion!==M.PHASE_VERSION&&(group!=='strongest'||stretchedOnly)?'Momentum groups are being prepared for this daily update.':'No stocks qualify for this group'+(stretchedOnly?' with the stretched filter.':'.')}</p>`}</div><details class="home-momentum-method"><summary>How these groups work</summary><p>Upside and downside overextension use your Pine script, independently of the momentum groups. EMA20, EMA50, EMA200 and Bollinger extension contribute 10%, 15%, 50% and 25%. Ranks use 500 readings, and the sign comes from price versus EMA200. The lists show the most stretched names on each side, even when none reaches your +99 / −97 extreme thresholds. Those threshold states are labeled separately.</p><p>Extreme sessions counts consecutive closes at +99 or higher for upside, or −97 or lower for downside. Average and median use this stock’s completed streaks on the same side, across its full available indicator history. The current streak and incomplete streaks are excluded. A dash means no completed history is available; ≥ means we only know a minimum length.</p><p>The strength score counts 12 confirmations. The other groups measure how momentum is changing, independently of that bullish score. Stocks are ranked within each group; fewer than ten are shown when fewer qualify. A quiet session is not padded with unrelated names.</p><p>We take the gap between the 10- and 21-day EMAs, smooth it over three sessions, and divide it by the 21-day average true range (ATR). That is the stock’s typical daily price range, including overnight gaps. The change compares this smoothed gap with three sessions earlier, using today’s ATR for both readings.</p><p>A gap of at least +0.10 ranges is positive; at most −0.10 is negative. A change of at least +0.05 means improving, and at most −0.05 means deteriorating. Smaller readings are left out of these groups. Turning upward or downward requires a move from one side of the neutral band to the other within the last three sessions, while momentum still moves in that direction.</p><p>Stretched means price is at least two normal ranges from its 21-day EMA and farther away than 90% of its prior readings. We use up to 252 prior sessions and require at least 126. This is separate from direction: a fast rise can be stretched without being a confirmed top. A new high with weaker momentum, or a new low with stronger momentum, compares today’s close with the preceding 20 sessions and the momentum at that earlier extreme.</p><p>The daily update recalculates these groups from stored prices. Refresh this page to load the latest published edition. They do not change with the heatmap’s date range. Thresholds are starting definitions, not backtested probabilities. Missing or stale data never qualifies.</p></details>`;
    host.querySelector('#home-momentum-group').onchange=e=>{group=e.target.value;expanded=null;render();host.querySelector('#home-momentum-group').focus({preventScroll:true});};
    if(isExtension){
      host.querySelector('.home-momentum-controls .records-caption').insertAdjacentHTML('beforebegin',filterControls());
      for(const key of ['theme','basket'])host.querySelector('#home-momentum-'+key).onchange=e=>{
        if(key==='theme')themeFilter=e.target.value;else basketFilter=e.target.value;
        expanded=null;render();host.querySelector('#home-momentum-'+key).focus({preventScroll:true});
      };
      host.querySelector('[data-momentum-reset]')?.addEventListener('click',()=>{themeFilter='';basketFilter='';expanded=null;render();host.querySelector('#home-momentum-theme').focus({preventScroll:true});});
      const empty=host.querySelector('.home-momentum-empty');
      if(empty&&!extensionError)empty.textContent=!extensionData?'Loading overextension readings…':basketFilter&&!cloud()?.available?'Saved baskets are unavailable. Reconnect or clear the basket filter.':basketFilter===ALL_BASKETS&&!savedBaskets().length?'No saved baskets yet. Save a basket in Charts or choose All stocks.':themeFilter||basketFilter?'No '+(group==='extension_down'?'downside':'upside')+' overextension names match these filters.':'No stocks qualify for this side.';
    }
    host.querySelector('#home-momentum-stretched').onchange=e=>{stretchedOnly=e.target.checked;expanded=null;render();host.querySelector('#home-momentum-stretched').focus({preventScroll:true});};
    host.querySelectorAll('[data-momentum-score]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.momentumScore;expanded=expanded===id?null:id;render();
      if(expanded)host.querySelector('.home-momentum-detail header')?.scrollIntoView({block:'nearest',inline:'nearest'});
      else focusScore(id);
    });
    host.querySelector('[data-momentum-close]')?.addEventListener('click',()=>{const id=expanded;expanded=null;render();focusScore(id);});
  }
  function focusScore(id){[...host.querySelectorAll('[data-momentum-score]')].find(b=>b.dataset.momentumScore===id)?.focus({preventScroll:true});}
  async function load(){
    host.innerHTML='<header><h2>Top 10 momentum &amp; extension</h2></header><p role="status">Loading daily scores…</p>';
    try{
      const edition=await window.MarketLabDailyEdition.get();
      if(!edition.screener_file)throw Error('The daily scores are not available yet.');
      const snapshot=await window.MarketLabData.json('cube/'+edition.screener_file);
      if(snapshot.update_id!==edition.update_id||snapshot.updated!==edition.updated)throw Error('The daily scores are updating. Reload to try again.');
      source=snapshot.rows;themes=snapshot.themes||[];updated=snapshot.updated;phaseVersion=snapshot.momentum_phase_version;render();
      try{extensionData=await O.get(updated);}catch(e){extensionError=e.message;}render();
    }catch(error){host.innerHTML=`<header><h2>Top 10 momentum &amp; extension</h2></header><p role="status">${esc(error.message)}</p><button type="button" data-momentum-reload>Reload</button>`;host.querySelector('[data-momentum-reload]').onclick=()=>location.reload();}
  }
  window.addEventListener('ml:cloudchange',()=>{
    if(!updated||!group.startsWith('extension_'))return;
    const focus=document.activeElement?.id;
    expanded=null;render();
    if(focus?.startsWith('home-momentum-'))document.getElementById(focus)?.focus({preventScroll:true});
  });
  load();
})();
