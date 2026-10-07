/* Reviewed company-release recaps; loaded only when a reader opens this tab. */
(()=>{
  const pilot=new Set('AMD NVDA AVGO MU DELL HPE MSFT GOOGL AMZN META CRM CRWD PANW NET UBER GEV VST ETN PWR FCX'.split(' '));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=id=>String(id||'').toUpperCase();
  const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  let pending;
  const load=()=>pending||(pending=fetch('cube/company-updates.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Quarterly Earnings recaps could not be loaded.');return r.json();}).catch(e=>{pending=null;throw e;}));
  async function mount(host,id){
    host.className='company-view';host.onclick=e=>e.stopPropagation();host.ondblclick=e=>e.stopPropagation();
    host.textContent='Loading quarterly earnings…';
    try{
      const data=await load(),row=data.rows?.[key(id)];
      if(!host.isConnected)return;
      if(!row){host.textContent='This company is not part of the 20-company pilot.';return;}
      const source=safeLink(row.url);
      if(!source)throw Error('The source link is invalid.');
      const priorSources=[...new Set((row.guidance?.changes||[]).map(c=>safeLink(c.source_url)).filter(Boolean))];
      host.innerHTML=`<h3>${esc(row.company)} · ${esc(row.period)}</h3>
        <p class="company-date">Report ${esc(row.published)} · checked ${esc(data.checked_on)}</p>
        <p data-company-growth><strong>Year-over-year growth</strong><br>${esc(row.growth?.text||'A comparable year-over-year revenue figure is not available in this recap.')}</p>
        <p>${esc(row.summary)}</p><ul>${row.developments.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
        <p data-company-guidance><strong>Guidance</strong><br>${esc(row.guidance?.text||row.outlook||'A guidance comparison is not available in this recap.')}</p>
        <p><strong>What to watch</strong><br>${esc(row.watch)}</p>
        <a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Read the official earnings release ↗</a>
        <details><summary>Sources &amp; context</summary><p>This recap uses earnings releases, not a transcript or news feed. Growth compares the same quarter a year earlier. A guidance raise compares forecasts for the same period, not the next quarter with the last quarter. What to watch is an editorial question.</p>
        ${priorSources.map(url=>`<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Earlier release used for the guidance comparison ↗</a></p>`).join('')}
        ${row.evidence.map(e=>`<p><strong>${esc(e.locator)}</strong><br>${esc(e.excerpt||e.supports)}</p>`).join('')}</details>`;
    }catch(e){if(host.isConnected){host.textContent=e.message+' ';const b=document.createElement('button');b.type='button';b.textContent='Retry';b.onclick=()=>mount(host,id);host.append(b);}}
  }
  window.MarketLabCompany={covers:id=>pilot.has(key(id)),mount};
})();
