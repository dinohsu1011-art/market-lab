/* Basket-level dollar-volume acceleration, from the daily pipeline export. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v==null?'—':Number(v).toFixed(2)+'×';
  function row(r,max){
    const w=r.accel5d==null?0:Math.min(100,r.accel5d/max*100);
    const drivers=(r.drivers||[]).map(d=>`${esc(d.symbol)} ${Math.round(d.share*100)}%`).join(' · ');
    return `<tr><td>${esc(r.label)}</td>`+
      `<td><span class="bv-bar"><i style="width:${w.toFixed(0)}%"></i></span> ${fmt(r.accel5d)}</td>`+
      `<td>${fmt(r.spike1d)}</td>`+
      `<td class="bv-drivers">${esc(drivers)||'—'}</td></tr>`;
  }
  async function show(visible){
    const panel=document.getElementById('basket-volume-panel');
    if(!panel)return;
    panel.hidden=!visible;
    if(!visible||panel.dataset.loaded)return;
    panel.textContent='Loading basket volume…';
    try{
      const response=await fetch('cube/basket-volume.json',{cache:'no-cache'});
      if(!response.ok)throw Error('Basket volume is unavailable.');
      const data=await response.json(),rows=data.rows||[];
      if(!rows.length)throw Error('No basket volume this run.');
      panel.dataset.loaded='true';
      const ranked=rows.filter(r=>r.accel5d!=null);
      const max=Math.max(1,...ranked.map(r=>r.accel5d));
      const top=ranked.slice(0,12),rest=ranked.slice(12);
      panel.innerHTML=`<header><h2>Basket volume acceleration</h2><span>updated ${esc(data.as_of)}</span></header>`+
        `<p>Past-5-session dollar volume against each basket's own prior-year pace. Above 1 means heavier trading than usual.</p>`+
        `<table><thead><tr><th>Basket</th><th>5-day pace</th><th>Latest day</th><th>Driven by</th></tr></thead>`+
        `<tbody>${top.map(r=>row(r,max)).join('')}</tbody></table>`+
        (rest.length?`<details><summary>All ${ranked.length} baskets</summary><table><tbody>${rest.map(r=>row(r,max)).join('')}</tbody></table></details>`:'')+
        `<p class="bv-note">Sums member buying and selling in US dollars. A basket with missing prices is left out rather than guessed.</p>`;
    }catch(e){panel.textContent=e.message;}
  }
  window.MarketLabBasketVolume={show};
})();
