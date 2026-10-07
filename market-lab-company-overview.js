(()=>{
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot;
  const profileUrl=sym=>`https://finance.yahoo.com/quote/${encodeURIComponent(sym)}/profile/`;
  function render(host,row,note){
    host.innerHTML=`<h3>${esc(row.name||row.symbol)}</h3><p class="overview-source">${[row.sector,row.industry,row.country].filter(Boolean).map(esc).join(' · ')}</p><p>${esc(row.summary)}</p><p class="overview-source">${esc(note)}</p><a href="${esc(profileUrl(row.symbol))}" target="_blank" rel="noopener noreferrer">Company profile ↗</a>`;
  }
  async function live(symbol){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
    try{
      const r=await fetch('/api/company-profile?symbol='+encodeURIComponent(String(symbol).toUpperCase()),{signal:ctrl.signal});
      if(!r.ok)return null;
      const row=await r.json();
      return row&&row.summary?row:null;
    }catch{return null;}finally{clearTimeout(timer);}
  }
  async function mount(host,id){
    host.className='company-overview';host.onclick=e=>e.stopPropagation();host.ondblclick=e=>e.stopPropagation();host.textContent='Loading company overview…';
    try{
      // Live first so newly added names work the same day; the baked
      // snapshot is the fallback when Yahoo rate-limits data-center traffic.
      const found=await live(id);
      if(!host.isConnected)return;
      if(found){render(host,found,'Live from Yahoo Finance');return;}
      const data=await(snapshot||(snapshot=fetch('cube/company-profiles.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).catch(e=>{snapshot=null;throw e;})));
      if(!host.isConnected)return;
      const row=data.rows?.[String(id).toUpperCase()];
      if(row){render(host,row,`Yahoo Finance snapshot · retrieved ${row.updated}`);return;}
      host.innerHTML=`<p>No published description found for ${esc(String(id).toUpperCase())}.</p><a href="${esc(profileUrl(String(id).toUpperCase()))}" target="_blank" rel="noopener noreferrer">Open the Yahoo Finance profile ↗</a>`;
    }catch(e){if(host.isConnected)host.textContent='Company overviews are unavailable.';}
  }
  window.MarketLabCompanyOverview={mount};
})();
