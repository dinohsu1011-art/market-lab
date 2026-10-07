/* Closing records shared by Home and Leaders. */
(() => {
  let pending;
  const load=()=>pending||(pending=fetch('cube/price-records.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('52-week lists unavailable');return window.MarketLabReadJSON(r);}));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>v==null?'—':'$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v);
  const ordered=(rows,side)=>rows.filter(r=>r.record.side===side).slice().sort((a,b)=>(b.turnoverUSD??-1)-(a.turnoverUSD??-1)||a.t.localeCompare(b.t));
  const link=side=>'market-lab-leaders.html#1D|all|'+side+'|10|0|||table|1D|0|8|div0|14';
  const chart=id=>'market-lab-themes.html#'+encodeURIComponent(id);
  async function show(visible){
    const host=document.getElementById('records-panel');if(!host)return;host.hidden=!visible;if(!visible)return;
    try{
      const data=await load();host.innerHTML='<div class="records-grid">'+['high52','low52'].map(side=>{
        const rows=ordered(data.rows,side).slice(0,10),title=side==='high52'?'New 52-week highs':'New 52-week lows';
        return `<section class="records-card"><header><h2>${title}</h2><a href="${link(side)}">View all →</a></header><p class="records-caption">US-listed · daily USD volume · updated ${esc(data.as_of)}</p><div class="records-scroll"><table><thead><tr><th>Stock</th><th>Close</th><th>1D</th><th>USD volume</th></tr></thead><tbody>${rows.map(r=>`<tr><td><a href="${chart(r.t)}">${esc(r.t)}</a><span>${esc(r.n)}</span></td><td>${money(r.px)}</td><td>${r.change>=0?'+':''}${r.change.toFixed(1)}%</td><td>${money(r.turnoverUSD)}</td></tr>`).join('')}</tbody></table>${rows.length?'':'<p>No new closing records this session.</p>'}</div></section>`;
      }).join('')+'</div>';
    }catch(e){host.textContent=e.message;}
  }
  window.MarketLabRecords={load,ordered,show,money};
})();
