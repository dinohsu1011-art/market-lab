/* Daily, dated observations exported by the existing research pipeline. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function mount(){
    if(document.documentElement.dataset.workspace!=='home')return;
    const anchor=document.getElementById('breadth-panel');if(!anchor)return;
    const host=document.createElement('section');host.className='market-watch';host.setAttribute('aria-label','Market risk and volatility');anchor.before(host);
    host.textContent='Loading market conditions…';
    try{
      const response=await fetch('cube/market-watch.json',{cache:'no-cache'});if(!response.ok)throw Error('Market conditions are unavailable.');
      const d=await response.json(), ratio=d.ratio;
      const zone=ratio==null?'Unavailable':ratio<1?'Near-term stress':ratio>1.2?'Potential complacency':'Between thresholds';
      const rows=d.history||[],values=rows.map(r=>r.ratio);let chart='';
      if(rows.length>1){const lo=Math.min(.9,...values),hi=Math.max(1.3,...values),y=v=>80-(v-lo)/(hi-lo)*65;
        chart=`<svg viewBox="0 0 400 94" role="img" aria-label="VIX3M divided by VIX over ${rows.length} sessions"><title>${esc(rows[0].date)} to ${esc(rows.at(-1).date)}</title>${[1,1.2].map(v=>`<line x1="0" x2="365" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".35" stroke-dasharray="3 4"/><text x="372" y="${y(v)+4}" fill="currentColor" font-size="12">${v.toFixed(1)}</text>`).join('')}<polyline fill="none" stroke="currentColor" stroke-width="2" points="${values.map((v,i)=>`${i/(values.length-1)*365},${y(v)}`).join(' ')}"/></svg>`;}
      host.innerHTML=`<header><h2>Market conditions</h2><span>updated ${esc(d.updated)}</span></header><div class="market-watch-grid"><div><div class="market-watch-heading"><h3>Risk flags</h3><strong>${esc(d.status)} · ${d.active}/${d.known}</strong></div><table><thead><tr><th>Condition</th><th>Reading</th><th>Flag</th></tr></thead><tbody>${d.flags.map(f=>`<tr><td>${esc(f.label)}</td><td>${esc(f.reading)}</td><td>${f.active===null?'—':f.active?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div><div><div class="market-watch-heading"><h3>VIX3M / VIX</h3><strong>${ratio==null?'—':ratio.toFixed(2)} <small>${esc(zone)}</small></strong></div>${chart}<p>Below 1.0: near-term stress. Above 1.2: potential complacency.</p><p class="market-watch-date">${rows.length?`${esc(rows[0].date)} → ${esc(rows.at(-1).date)}`:'No paired history available'}</p></div></div><details><summary>How these readings work</summary><p>A sector is bearish after three consecutive closes below its 21-day exponential average. The count covers the 11 sector ETFs, not Gold. Bearish now: ${esc(d.sectors.filter(s=>s.bearish).map(s=>s.symbol).join(', ')||'none')}.</p><p>SPY uses its 200-session simple average. Breadth uses eligible stocks in the current S&amp;P 500 membership, each equally weighted. A missing reading stays unknown. All current readings must match the displayed date.</p><p>The summary counts these four conditions: zero means no flags; one or two means caution; three or four means elevated risk. These are display rules, not backtested probabilities. VIX and VIX3M are volatility indices, not futures prices. A ratio below 1 can remain low while stocks fall; above 1.2 does not mean a reversal is imminent.</p></details>`;
    }catch(e){host.textContent=e.message;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
