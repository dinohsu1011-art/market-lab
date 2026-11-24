/* Daily, dated observations exported by the existing research pipeline. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=d=>new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'});
  function tmtChart(t){
    if(!t||!t.history||t.history.length<2)return '';
    const pts=t.history,W=800,H=200,L=4,R=748,T=10,B=176,vals=pts.map(p=>p[1]),lo=Math.min(-60,Math.floor(Math.min(...vals)/20)*20);
    const t0=Date.parse(pts[0][0]),t1=Date.parse(pts.at(-1)[0]),x=d=>L+(Date.parse(d)-t0)/(t1-t0)*(R-L),y=v=>T+(0-v)/(0-lo)*(B-T);
    const grid=[];for(let v=0;v>=lo;v-=20)grid.push(`<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity="${v?.18:.4}"${v?' stroke-dasharray="3 4"':''}/><text x="${R+8}" y="${y(v)+4}" fill="currentColor" font-size="12">${v}%</text>`);
    const years=[];for(let yr=Math.ceil(new Date(pts[0][0]).getFullYear()/5)*5;yr<=new Date(pts.at(-1)[0]).getFullYear();yr+=5)if(x(yr+'-01-01')>=20)years.push(`<text x="${x(yr+'-01-01')}" y="${H-4}" fill="currentColor" font-size="12" text-anchor="middle" opacity=".7">${yr}</text>`);
    const last=pts.at(-1);
    return `<div class="tmt-momentum"><div class="market-watch-heading"><h3>Tech momentum</h3><strong data-tmt-readout>${last[1].toFixed(1)}% <small>from 12-month high</small></strong></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="TMT momentum, percent below its 12-month high, ${esc(pts[0][0])} to ${esc(last[0])}">${grid.join('')}${years.join('')}<polyline fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" points="${pts.map(p=>`${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')}"/><circle cx="${x(last[0])}" cy="${y(last[1])}" r="3.5" fill="currentColor"/><line data-tmt-cursor x1="0" x2="0" y1="${T}" y2="${B}" stroke="currentColor" opacity="0"/></svg><p>Last year's winners minus last year's losers among ${t.names} US tech and telecom stocks. Lowest: ${t.low.value.toFixed(1)}% (${esc(fmtDate(t.low.date))}).</p></div>`;
  }
  function wireTmt(host,t){
    const svg=host.querySelector('.tmt-momentum svg'),out=host.querySelector('[data-tmt-readout]'),cur=host.querySelector('[data-tmt-cursor]');if(!svg)return;
    const pts=t.history,last=pts.at(-1),base=out.innerHTML,t0=Date.parse(pts[0][0]),t1=Date.parse(last[0]);
    svg.addEventListener('mousemove',e=>{const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*800,tt=t0+(vx-4)/744*(t1-t0);let i=pts.findIndex(p=>Date.parse(p[0])>=tt);if(i<0)i=pts.length-1;const p=pts[i],px=4+(Date.parse(p[0])-t0)/(t1-t0)*744;cur.setAttribute('x1',px);cur.setAttribute('x2',px);cur.setAttribute('opacity','.5');out.innerHTML=`${p[1].toFixed(1)}% <small>${esc(fmtDate(p[0]))}</small>`;});
    svg.addEventListener('mouseleave',()=>{cur.setAttribute('opacity','0');out.innerHTML=base;});
  }
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
      host.innerHTML=`<header><h2>Market conditions</h2><span>updated ${esc(d.updated)}</span></header>${tmtChart(d.tmt_momentum)}<div class="market-watch-grid"><div><div class="market-watch-heading"><h3>Risk flags</h3><strong>${esc(d.status)} · ${d.active}/${d.known}</strong></div><table><thead><tr><th>Condition</th><th>Reading</th><th>Flag</th></tr></thead><tbody>${d.flags.map(f=>`<tr><td>${esc(f.label)}</td><td>${esc(f.reading)}</td><td>${f.active===null?'—':f.active?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div><div><div class="market-watch-heading"><h3>VIX3M / VIX</h3><strong>${ratio==null?'—':ratio.toFixed(2)} <small>${esc(zone)}</small></strong></div>${chart}<p>Below 1.0: near-term stress. Above 1.2: potential complacency.</p><p class="market-watch-date">${rows.length?`${esc(rows[0].date)} → ${esc(rows.at(-1).date)}`:'No paired history available'}</p></div></div><details><summary>How these readings work</summary><p>Tech momentum ranks liquid US tech and telecom stocks each month on their 12-month return, skipping the latest month. It tracks the top fifth minus the bottom fifth, equal weight, and charts how far that pair sits below its own 12-month high. The stock list is today's, so failed and acquired companies are missing; the dot-com years are the least reliable.</p><p>A sector is bearish after three consecutive closes below its 21-day exponential average. The count covers the 11 sector ETFs, not Gold. Bearish now: ${esc(d.sectors.filter(s=>s.bearish).map(s=>s.symbol).join(', ')||'none')}.</p><p>SPY uses its 200-session simple average. Breadth uses eligible stocks in the current S&amp;P 500 membership, each equally weighted. A missing reading stays unknown. All current readings must match the displayed date.</p><p>The summary counts these four conditions: zero means no flags; one or two means caution; three or four means elevated risk. These are display rules, not backtested probabilities. VIX and VIX3M are volatility indices, not futures prices. A ratio below 1 can remain low while stocks fall; above 1.2 does not mean a reversal is imminent.</p></details>`;
    wireTmt(host,d.tmt_momentum||{});}catch(e){host.textContent=e.message;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
