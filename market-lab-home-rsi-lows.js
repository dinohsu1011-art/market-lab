/* Home's RSI-lows screen: stocks near the bottom of their own 1-year RSI range, strongest names first. */
(()=>{
  const host=document.getElementById('home-rsi-lows');
  if(!host)return;
  if(document.documentElement.dataset.workspace!=='home'){host.remove();return;}
  host.hidden=false;
  const stamp=(document.currentScript?.src.match(/[?&]v=([^&]+)/)||[])[1]||String(Date.now());
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(0)+'%':'—';
  const top=p=>Number.isFinite(p)?'Top '+Math.max(1,Math.round(100*(1-p)))+'%':'—';
  const DEPTH={p10:{label:'Bottom 10% of its range',test:r=>r.pos<=.10},p02:{label:'At its yearly low',test:r=>r.pos<=.02},p25:{label:'Bottom 25% of its range',test:r=>r.pos<=.25},abs30:{label:'RSI under 30',test:r=>r.rsi<30}};
  const STRONG=.70,PAGE=15;
  let data=null,depth='p10',strongOnly=true,usOnly=true,showAll=false;
  function rangeBar(r){
    const at=v=>Math.max(0,Math.min(100,v)).toFixed(1);
    const tip=`1-year RSI range ${r.lo.toFixed(0)} to ${r.hi.toFixed(0)}. Today ${r.rsi.toFixed(1)}. Lowest reading on ${r.low_date}.`;
    return `<span class="rsi-cell-in"><span class="rsi-range" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="rsi-track" style="left:${at(r.lo)}%;right:${at(100-r.hi)}%"></span><span class="rsi-thirty" style="left:30%"></span><span class="rsi-now" style="left:${at(r.rsi)}%"></span></span><b>${r.rsi.toFixed(0)}</b></span>`;
  }
  function render(){
    const rows=data.rows.filter(r=>DEPTH[depth].test(r)&&(!strongOnly||r.strength>=STRONG)&&(!usOnly||r.us));
    const shown=showAll?rows:rows.slice(0,PAGE);
    const opt=(o,v)=>Object.entries(o).map(([k,c])=>`<option value="${k}" ${k===v?'selected':''}>${esc(c.label||c)}</option>`).join('');
    host.innerHTML=`<header><h2>RSI near its yearly low</h2><span class="records-caption">updated ${esc(data.updated)}</span></header>
<div class="home-momentum-controls"><label>How low <select id="rsi-lows-depth">${opt(DEPTH,depth)}</select></label><label>Names <select id="rsi-lows-strength">${opt({strong:'Strong names & themes',all:'All names'},strongOnly?'strong':'all')}</select></label><label>Market <select id="rsi-lows-market">${opt({us:'US-listed',all:'All markets'},usOnly?'us':'all')}</select></label><span class="records-caption" role="status">${rows.length} ${rows.length===1?'stock':'stocks'}, strongest first</span></div>
<div class="records-scroll"><table><thead><tr><th>Stock</th><th title="The stock's strongest industry or theme, ranked by its members' 12-month trend">Group</th><th title="Ranks the stock's 12-month trend and its group's trend together">Strength</th><th title="Grey bar is the stock's own 1-year RSI range. The dot is today. The tick marks 30.">RSI 14</th><th title="12-month return, leaving out the latest month">12-mo trend</th><th>Past month</th><th>Off high</th></tr></thead><tbody>${shown.map(r=>`<tr><td><a href="market-lab-themes.html#${encodeURIComponent(r.id)}">${esc(r.id)}</a><span>${esc(r.name)}</span></td><td class="rsi-group">${r.theme?`${esc(r.theme.label)}<small>${top(r.theme.pct)}</small>`:'<small>No group</small>'}</td><td>${top(r.strength)}</td><td class="rsi-cell">${rangeBar(r)}</td><td>${pct(r.mom)}</td><td>${pct(r.r1m)}</td><td>${pct(r.off52)}</td></tr>`).join('')}</tbody></table>
${rows.length?'':'<p class="home-momentum-empty">No stocks match. Try a wider range or all names.</p>'}</div>
${rows.length>PAGE?`<button type="button" class="rsi-lows-more" data-rsi-more>${showAll?'Show top '+PAGE:'Show all '+rows.length}</button>`:''}
<details class="home-momentum-method"><summary>How this screen works</summary><p>Every stock swings in its own band. A calm utility may never reach an RSI of 30, while a fast-moving chip stock gets there every few months. So each stock is measured against itself: where today's 14-day RSI sits between its lowest and highest reading over the past year. "At its yearly low" means today is within 2% of the bottom of that band.</p><p>Names are sorted by strength, so pullbacks in leaders come first. Strength blends two ranks. The first is the stock's 12-month return, leaving out the latest month so the current drop doesn't erase the trend before it. The second is how its strongest industry or theme ranks, using the median of its members. A stock with no group counts as middling on the second rank. "Strong names &amp; themes" keeps the top 30% on that blend.</p><p>Stocks trading under $5 million a day are left out. A low RSI says where a stock sits, not that it will bounce. On this database, oversold bounces over the next week are close to a coin flip.</p></details>`;
    const bind=(id,fn)=>host.querySelector(id).onchange=e=>{fn(e.target.value);showAll=false;render();host.querySelector(id).focus({preventScroll:true});};
    bind('#rsi-lows-depth',v=>depth=v);
    bind('#rsi-lows-strength',v=>strongOnly=v==='strong');
    bind('#rsi-lows-market',v=>usOnly=v==='us');
    host.querySelector('[data-rsi-more]')?.addEventListener('click',()=>{showAll=!showAll;render();host.querySelector('[data-rsi-more]')?.focus({preventScroll:true});});
  }
  async function load(){
    host.innerHTML='<header><h2>RSI near its yearly low</h2></header><p role="status">Loading…</p>';
    try{data=await window.MarketLabData.json('cube/rsi-lows.json?v='+encodeURIComponent(stamp));render();}
    catch(e){host.innerHTML=`<header><h2>RSI near its yearly low</h2></header><p role="status">The RSI screen could not be loaded. Reload to try again.</p>`;}
  }
  load();
})();
