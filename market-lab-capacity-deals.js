(() => {
  let filter = 'all';
  let view = 'bars';
  const groups = {compute:'GPU / accelerator compute',cloud:'Cloud services / mixed compute',tokens:'Tokens / model services',leases:'Data center space, power & cooling',internal:'Internal use · no external sale'};
  const colors = {compute:'var(--amazon)',cloud:'var(--reflection)',tokens:'var(--oracle)',leases:'var(--microsoft)',internal:'#959da2'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let timelineUnit = 'annual';
  let timelinePoints = [];
  const units = {annual:'Annualized $/W/year', lifetime:'Full-term $/W', total:'Total contract value ($B)'};
  const timeline = rows => {
    const dated = rows.filter(r=>r.date).map(r=>({...r,time:Date.parse(r.date.length===7?r.date+'-15':r.date)})).filter(r=>Number.isFinite(r.time)).sort((a,b)=>a.time-b.time);
    const valueFor = r => timelineUnit==='annual' && r.monthly && r.mw ? r.monthly*12/r.mw/1e6 : timelineUnit==='total' ? r.usd/1e9 : timelineUnit==='lifetime' ? (r.mw ? r.usd/r.mw/1e6 : null) : (r.mw && r.years ? r.usd/r.mw/1e6/r.years : null);
    const plotted = dated.map(r=>({...r,price:valueFor(r)})).filter(r=>Number.isFinite(r.price)&&r.price>0);
    const omitted = dated.filter(r=>!Number.isFinite(valueFor(r)) || valueFor(r)<=0);
    const toolbar = `<div class="deal-filters" aria-label="Timeline price units">${Object.entries(units).map(([id,label])=>`<button type="button" data-timeline-unit="${id}" aria-pressed="${timelineUnit===id}">${label}</button>`).join('')}</div><p class="compact-footnote">${plotted.length} plotted / ${dated.length} dated announcements in this category. ${omitted.length} lack inputs for this unit (${timelineUnit==='annual'?'annual payment or term/MW':timelineUnit==='total'?'total contract value':'total value or MW'}). Total contract value includes deals without those inputs.</p>`;
    timelinePoints = plotted;
    if (!plotted.length) return toolbar+'<p>No comparable prices in this unit. Select total contract value to see announcements without MW or term.</p>';
    const start=Date.UTC(new Date(Math.min(...dated.map(r=>r.time))).getUTCFullYear(),0,1), end=Date.UTC(new Date(Math.max(...dated.map(r=>r.time))).getUTCFullYear()+1,0,1);
    const rawMax=Math.max(...plotted.map(r=>r.price)); const step=Math.pow(10,Math.floor(Math.log10(rawMax)))/2; const ceiling=Math.ceil(rawMax/step)*step;
    const x=t=>65+(t-start)/(end-start)*940, y=v=>300-v/ceiling*255;
    timelinePoints.forEach(r=>{r.px=x(r.time);r.py=y(r.price);});
    return toolbar+`<div class="deal-timeline"><svg viewBox="0 0 1040 355" aria-label="Contract prices by announcement date"><text x="65" y="19" font-size="12">${units[timelineUnit]}</text>${Array.from({length:6},(_,i)=>{const v=ceiling*i/5;return `<line x1="65" x2="1005" y1="${y(v)}" y2="${y(v)}" stroke="#deded9"/><text x="55" y="${y(v)+4}" text-anchor="end" font-size="11">$${Number(v.toFixed(2))}</text>`;}).join('')}${Array.from({length:7},(_,i)=>{const t=start+(end-start)*i/6;return `<text x="${x(t)}" y="322" text-anchor="middle" font-size="11">${new Date(t).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})}</text>`;}).join('')}${plotted.map((r,i)=>`<a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer"><circle data-deal-point="${i}" aria-label="${esc(r.label)}: $${r.price.toFixed(2)}" cx="${r.px}" cy="${r.py}" r="5" fill="${r.proxy?'white':colors[r.group]}" stroke="${colors[r.group]}" stroke-width="2" tabindex="0"></circle></a>`).join('')}<text x="535" y="348" text-anchor="middle" font-size="11">Contract announcement date</text></svg></div><p class="compact-footnote">Hover or focus a point for details, including nearby overlapping deals. Click for source. Hollow = spending proxy or modeled MW. Facility-power denominators are identified in popups. Each point is a separate announcement, not a repricing series; values must not be summed. Undated benchmarks excluded.</p><details class="deal-details"><summary>All dated announcements (${dated.length}) · including missing inputs</summary><div class="deal-table-wrap"><table><thead><tr><th>Date</th><th>Deal</th><th>Value ($B)</th><th>MW</th><th>Years</th></tr></thead><tbody>${dated.map(r=>`<tr><td>${esc(r.date)}</td><td><a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a></td><td>${r.usd?(r.usd/1e9).toFixed(2):'Undisclosed'}</td><td>${r.mw||'Undisclosed'}</td><td>${r.years||'Undisclosed'}</td></tr>`).join('')}</tbody></table></div></details>`;
  };
  const bindDealPopups = host => {
    document.querySelector('#dealPointPopup')?.remove();
    const popup=document.createElement('div'); popup.id='dealPointPopup';popup.className='deal-point-popup';popup.setAttribute('role','tooltip');popup.hidden=true;document.body.appendChild(popup);
    const hide=()=>{popup.hidden=true;};
    host.querySelectorAll('[data-deal-point]').forEach(point=>{
      const show=event=>{
        const r=timelinePoints[Number(point.dataset.dealPoint)];
        const nearby=timelinePoints.filter(o=>o===r || Math.hypot(o.px-r.px,o.py-r.py)<11);
        popup.innerHTML=nearby.map(o=>`<div class="deal-popup-entry"><strong>${esc(o.label)}</strong><div>${esc(o.date)} · ${esc(groups[o.group])}</div><b>$${o.price.toFixed(2)} ${timelineUnit==='total'?'billion':timelineUnit==='lifetime'?'/ W · full term':'/ W / year'}</b><div>${o.monthly?'Monthly: $'+(o.monthly/1e6).toFixed(0)+'M · ':''}Contract: ${o.usd?'$'+(o.usd/1e9).toFixed(2)+'B':'total undisclosed'} · ${o.mw||'Undisclosed'} MW · ${o.years||'Undisclosed'} years</div><div>Basis: ${esc(o.basis||'Contracted IT capacity')}${o.proxy?' · spending proxy':''}</div><div>${esc(o.status)}</div><div class="deal-popup-note">${esc(o.note)}</div><div>Source: ${esc(new URL(o.source).hostname)} · click point to open</div></div>`).join('');
        popup.hidden=false;
        const box=point.getBoundingClientRect();const px=event.clientX??box.right,py=event.clientY??box.top;
        popup.style.left=Math.max(8,Math.min(px+14,window.innerWidth-popup.offsetWidth-12))+'px';
        popup.style.top=Math.max(8,Math.min(py+14,window.innerHeight-popup.offsetHeight-12))+'px';
      };
      point.addEventListener('pointerenter',show);point.addEventListener('pointermove',show);point.addEventListener('pointerleave',hide);point.addEventListener('focus',show);point.addEventListener('blur',hide);point.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
    });
  };
  window.renderDealChart = rates => {
    const legacy = rates.map(r => ({...r,group:r.label==='Internal Use'?'internal':r.label==='Token Vendor'?'tokens':['Public Cloud','Anthropic Blended'].includes(r.label)?'cloud':'compute',prefix:'≈',status:'Workbook benchmark; not independently verified',note:['Google Blackwell','Reflection','Anthropic Blended'].includes(r.label) ? 'Arithmetic matches the rounded monthly payment and MW in the workbook. Underlying agreement not independently verified.' : 'Existing workbook assumption; no supporting deal-level source established in this pass.'}));
    const data = [...legacy,...window.dealRates.map(r=>({...r,proxy:r.group==='proxies',group:r.group==='proxies'?'cloud':r.group}))];
    const max = Math.ceil(Math.max(...data.map(r=>Number(r.value)))/10)*10;
    const host = document.querySelector('#rentalChart');
    const rows = data.filter(r=>filter==='all'||r.group===filter).sort((a,b)=>b.value-a.value);
    host.innerHTML = `<div class="deal-filters" aria-label="Chart view"><button type="button" data-deal-view="bars" aria-pressed="${view==='bars'}">Price comparison</button><button type="button" data-deal-view="timeline" aria-pressed="${view==='timeline'}">Contracted price over time</button></div><div class="deal-filters compact-legend" role="group" aria-label="Products sold">${Object.entries({all:'All',...groups}).map(([id,name]) => `<button type="button" data-deal-filter="${id}" aria-pressed="${filter===id}"><span style="background:${colors[id]||'#333'}"></span>${name}</button>`).join('')}</div><div class="compact-deal-plot"><div class="compact-axis-head"><span>Metric / deal</span><span>Price · USD / W / year</span><span></span></div>${rows.map(r=>`<div class="rental-row"><div class="rental-label" title="${esc(groups[r.group]+': '+r.note)}">${esc(r.label)}${!r.source?' <sup title="Workbook benchmark">B</sup>':r.proxy?' <sup title="Spending proxy">P</sup>':''}</div><div class="rental-track"><div class="rental-bar" style="width:${100*Number(r.value)/max}%;--bar-color:${colors[r.group]}" title="${esc(r.note)}"></div></div><div class="rental-value">${r.prefix||'≈'}$${Number(r.value).toFixed(2)}</div></div>`).join('')}<div class="deal-shared-axis rental-axis"><div></div><div class="axis-scale">${Array.from({length:7},(_,i)=>`<span>${Number((max*i/6).toFixed(2))}</span>`).join('')}</div><div></div></div></div><p class="compact-footnote">B = workbook benchmark · P = spending proxy · Annualized value = contract revenue ÷ years ÷ IT watts; service scope varies.</p><details class="deal-details"><summary>Calculation inputs, sources & verification (${data.length} entries)</summary><p>≈ rounded estimate; ≲ approximate ceiling; ≳ approximate floor. Broad spending proxies do not establish a matching price for a fixed delivered capacity. Workbook benchmarks are labeled within their product category.</p><div class="deal-table-wrap"><table><thead><tr><th>Entry</th><th>Total value</th><th>IT MW</th><th>Years</th><th>Verification / source</th><th>Notes</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.usd?'$'+(r.usd/1e9).toFixed(2)+'B':'—'}</td><td>${r.mw||'—'}</td><td>${r.years||'—'}</td><td>${r.source?`<a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(r.status)}</a>`:esc(r.status)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div><p>Source: local DC-deals canonical CSV, audited September 11, 2026. Original tracker preserved. Unannualizable deals, power PPAs, acquisition values and duplicate announcements are excluded. Local Citi Data Center GAINs (September 3, 2026, p.18) was also reviewed; portfolio totals are not treated as individual lease values.</p></details>`;
    if (view === 'timeline') {
      host.querySelector('.compact-deal-plot').outerHTML = timeline([...data.filter(r=>r.source),...(window.timelineExtraDeals||[])].filter(r=>filter==='all'||r.group===filter));
    }
    bindDealPopups(host);
    host.querySelectorAll('[data-timeline-unit]').forEach(button=>button.addEventListener('click',()=>{timelineUnit=button.dataset.timelineUnit;window.renderDealChart(rates);}));
    host.querySelectorAll('[data-deal-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.dealView;window.renderDealChart(rates);}));
    host.querySelectorAll('[data-deal-filter]').forEach(button => button.addEventListener('click',()=>{filter=button.dataset.dealFilter;window.renderDealChart(rates);}));
  };
})();
