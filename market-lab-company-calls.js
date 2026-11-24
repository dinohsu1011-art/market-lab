/* Earnings calls on company cards, plus call markers on the price chart.
   Data: cube/calls/index.json (ticker -> company), then cube/calls/<company>.json on demand. */
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeLink=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const key=id=>String(id||'').toUpperCase();
  const NS='http://www.w3.org/2000/svg';
  const WORD={'-2':'strongly against','-1':'against','0':'neutral','1':'for','2':'strongly for'};
  const SW={'-2':'against2','-1':'against1','0':'neutral','1':'for1','2':'for2'};
  const sw=s=>`<i class="sw" style="background:var(--st-${SW[String(s)]})"></i>`;
  const signed=n=>(n>0?'+':'')+n;
  const pct=v=>v==null?'–':(v>0?'+':'')+(v*100).toFixed(1)+'%';
  const V=(s=>s.includes('?')?s.slice(s.indexOf('?')):'')(document.currentScript?.src||'');   // same cache stamp as this script
  const known=()=>new Set(window.EQUINOX_CALLS?.tickers||[]);
  let pending;
  const shards=new Map();
  const getJSON=(url,msg)=>fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(msg);return r.json();});
  const load=()=>pending||(pending=getJSON('cube/calls/index.json','Earnings call data could not be loaded.').catch(e=>{pending=null;throw e;}));
  const loadRow=e=>{
    if(!e)return Promise.resolve(null);
    if(!shards.has(e))shards.set(e,getJSON(`cube/calls/${encodeURIComponent(e)}.json`,'Earnings call data could not be loaded.').then(j=>{const m=new Map();for(const q of j.quotes||[]){if(!m.has(q.c))m.set(q.c,[]);m.get(q.c).push(q);}j.byCall=m;return j;}).catch(err=>{shards.delete(e);throw err;}));
    return shards.get(e);
  };
  const css=()=>{if(document.querySelector('link[data-calls-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='market-lab-calls.css'+V;l.dataset.callsCss='';document.head.append(l);};
  const entityFor=(data,t)=>data.tickers[key(t)];

  // ---------------------------------------------------------- one call's detail
  function detail(box,data,c,row){
    const lensRows=data.lenses.map(l=>({l,v:c.lens?.[l.id]})).filter(r=>r.v&&r.v[0]>0);
    const tone=data.topics.map(t=>({t,v:c.tone?.[t.id]})).filter(r=>r.v);
    const u=safeLink(c.url),m=c.move;
    box.innerHTML=`<div class="q-when">${esc(c.id)}<span>${esc(c.d)}${c.time?` · ${esc(c.time==='amc'?'after close':c.time==='bmo'?'before open':c.time)}`:''}</span></div>
      ${tone.length?`<ul class="tone">${tone.map(({t,v})=>`<li>${sw(v.score)}<b>${esc(t.label)}</b>: ${WORD[v.score]} (${signed(v.score)})${v.shift?`, turned from ${WORD[v.shift.from]}`:''}. ${esc(v.shift?.why||v.summary)}</li>`).join('')}</ul>`:''}
      ${m?`<h4>Stock move after the call</h4><table><thead><tr><th></th><th class="n">1 day</th><th class="n">5 days</th><th class="n">20 days</th></tr></thead><tbody>
        <tr><td>${esc(c.t)}</td><td class="n">${pct(m.r1)}</td><td class="n">${pct(m.r5)}</td><td class="n">${pct(m.r20)}</td></tr>
        <tr><td>vs S&amp;P 500</td><td class="n">${pct(m.r1_spy)}</td><td class="n">${pct(m.r5_spy)}</td><td class="n">${pct(m.r20_spy)}</td></tr>
        ${m.etf?`<tr><td>vs ${esc(m.etf)}</td><td class="n">${pct(m.r1_sector)}</td><td class="n">${pct(m.r5_sector)}</td><td class="n">${pct(m.r20_sector)}</td></tr>`:''}</tbody></table>`:''}
      ${lensRows.length?`<h4>Topic mentions</h4><table><thead><tr><th>Topic</th><th class="n">Mentions</th><th class="n">Management</th><th class="n">Analysts</th><th class="n">Per 10k words</th></tr></thead><tbody>${lensRows.map(({l,v})=>`<tr><td>${esc(l.label)}${v[4]?` <span class="calls-note">(${Object.entries(v[4]).filter(([,n])=>n).map(([k,n])=>`${esc(k)} ${n}`).join(', ')})</span>`:''}</td><td class="n">${v[0]}</td><td class="n">${v[1]}</td><td class="n">${v[2]}</td><td class="n">${v[3].toFixed(1)}</td></tr>`).join('')}</tbody></table>`:`<p class="calls-note">No topic mentions in this call.</p>`}
      <div data-q></div>
      ${u?`<p><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Read the transcript ↗</a></p>`:'<p class="calls-note">No public source link for this call, so quotes are left out.</p>'}`;
    if(!u)return;
    const qbox=box.querySelector('[data-q]');
    const rows=(row?.byCall?.get(c.id)||[]).slice(0,6);
    if(!rows.length)return;
    const label=id=>data.lenses.find(l=>l.id===id)?.label||id;
    qbox.innerHTML=`<h4>Quotes</h4>`+rows.map(q=>`<p class="calls-quote">“${esc(q.x)}”</p><p class="calls-note">${esc(q.s||'Unnamed speaker')} · ${esc(label(q.l))}</p>`).join('');
  }

  // ---------------------------------------------------------- company card section
  async function mount(host,ticker){
    css();
    host.classList.add('calls-view');host.textContent='Loading earnings calls…';
    let data,row;
    try{data=await load();row=await loadRow(entityFor(data,ticker));}catch(e){host.textContent=e.message;return;}
    if(!host.isConnected)return;
    if(!row?.calls?.length){host.remove();return;}
    const calls=row.calls,last=calls.at(-1);
    const most=data.lenses.map(l=>[l.id,calls.reduce((a,c)=>a+(c.lens?.[l.id]?.[0]||0),0)]).sort((a,b)=>b[1]-a[1])[0]?.[0];
    let lens=most||data.lenses[0].id,sel=calls.length-1;
    const turns=[];
    calls.forEach(c=>data.topics.forEach(t=>{const v=c.tone?.[t.id];if(v?.shift)turns.push({c,t,v});}));
    const latestTone=[...calls].reverse().find(c=>c.tone);
    host.innerHTML=`<h3 title="${calls.length} calls, ${esc(calls[0].d.slice(0,4))} to ${esc(last.d.slice(0,4))} · ${esc(row.tickers.join(', '))}">Earnings calls</h3>
      <div class="calls-row"><label class="calls-note" title="Mentions per 10,000 words. Each dot is one call; click a dot to open it.">Topic <select data-lens>${data.lenses.map(l=>`<option value="${l.id}">${esc(l.label)}</option>`).join('')}</select></label></div>
      <div class="mini" data-mini></div>
      <div class="calls-detail" data-detail></div>
      ${latestTone?`<h4>Latest tone · ${esc(latestTone.id)}</h4><ul class="tone">${data.topics.filter(t=>latestTone.tone[t.id]).map(t=>{const v=latestTone.tone[t.id];return `<li>${sw(v.score)}<b>${esc(t.label)}</b>: ${WORD[v.score]} (${signed(v.score)}). ${esc(v.summary)}</li>`;}).join('')}</ul>`:''}
      ${turns.length?`<h4>Latest turns</h4><ul class="tone">${turns.slice(-3).reverse().map(({c,t,v})=>`<li><b>${esc(c.id)}</b> · ${esc(t.label)}: ${sw(v.shift.from)}${WORD[v.shift.from]} → ${sw(v.score)}${WORD[v.score]}. ${esc(v.shift.why)}${v.quote&&safeLink(v.url)?` <i>“${esc(v.quote)}”</i>`:''}</li>`).join('')}</ul>`:''}`;
    const sl=host.querySelector('[data-lens]');sl.value=lens;
    sl.onchange=()=>{lens=sl.value;draw();};
    const open=i=>{sel=i;draw();detail(host.querySelector('[data-detail]'),data,calls[i],row);};
    function draw(){
      const W=640,H=150,P={l:34,r:10,t:10,b:22},c=window.MarketLab?.colors?.()||{border:'#ddd',muted:'#777',accent:'#257dc3',ink:'#222'};
      const t0=Date.parse(calls[0].d),t1=Date.parse(last.d)||t0+1,X=d=>P.l+(Date.parse(d)-t0)/Math.max(1,t1-t0)*(W-P.l-P.r);
      const vals=calls.map(k=>k.lens?.[lens]?.[3]??0),max=Math.max(1,...vals),Y=v=>P.t+(1-v/max)*(H-P.t-P.b);
      let g=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${c.border}"/><text x="${P.l-6}" y="${Y(max)+4}" text-anchor="end" font-size="11" fill="${c.muted}">${max.toFixed(0)}</text><text x="${P.l-6}" y="${Y(0)+4}" text-anchor="end" font-size="11" fill="${c.muted}">0</text>`;
      const y0=+calls[0].d.slice(0,4),y1=+last.d.slice(0,4),every=y1-y0>8?3:y1-y0>4?2:1;
      for(let y=y0+1;y<=y1;y+=every)g+=`<text x="${X(y+'-01-01')}" y="${H-5}" text-anchor="middle" font-size="11" fill="${c.muted}">${y}</text>`;
      g+=`<path d="${calls.map((k,i)=>(i?'L':'M')+X(k.d).toFixed(1)+' '+Y(vals[i]).toFixed(1)).join('')}" fill="none" stroke="${c.accent}" stroke-width="1.5" opacity=".55"/>`;
      calls.forEach((k,i)=>{g+=`<g class="dot${i===sel?' on':''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(k.id)}: ${vals[i].toFixed(1)} per 10k words"><title>${esc(k.id)} · ${vals[i].toFixed(1)}</title><circle cx="${X(k.d).toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="${i===sel?4.5:3}" fill="${i===sel?c.ink:c.accent}"/></g>`;});
      const mini=host.querySelector('[data-mini]');
      mini.innerHTML=`<svg viewBox="0 0 ${W} ${H}" aria-label="Topic mentions by call">${g}</svg>`;
      mini.querySelectorAll('.dot').forEach(d=>{d.onclick=()=>open(+d.dataset.i);d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(+d.dataset.i);}};});
    }
    open(sel);
  }

  // ---------------------------------------------------------- price-chart markers
  let pop,popData;
  function closePop(){pop?.remove();pop=null;}
  addEventListener('keydown',e=>{if(e.key==='Escape')closePop();});
  addEventListener('pointerdown',e=>{if(pop&&!pop.contains(e.target)&&!e.target.closest?.('.call-marker'))closePop();});
  function openPop(c,row,x,y){
    closePop();css();
    pop=document.createElement('div');pop.className='calls-pop calls-view';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',c.id);
    pop.innerHTML='<button type="button" class="close" aria-label="Close">×</button><div class="calls-detail"></div>';
    pop.querySelector('.close').onclick=closePop;
    document.body.append(pop);
    detail(pop.querySelector('.calls-detail'),popData,c,row);
    const w=pop.offsetWidth;pop.style.left=Math.max(12,Math.min(innerWidth-w-12,x-w/2))+'px';
    pop.style.top=Math.max(12,Math.min(innerHeight-260,y+14))+'px';
  }
  async function paint(svg,ctx){
    svg.querySelector('#call-markers')?.remove();
    const items=(ctx?.items||[]).filter(i=>known().has(key(i.id)));
    const g=ctx?.geom;
    if(!items.length||items.length>4||!g?.px||typeof g.X!=='function'||!ctx.dates?.length)return;
    let data,rows;
    try{data=popData=await load();rows=await Promise.all(items.map(it=>loadRow(entityFor(data,it.id)).catch(()=>null)));}catch{return;}
    if(!svg.isConnected)return;
    svg.querySelector('#call-markers')?.remove();
    const {dates,from,to}=ctx,px=g.px,lo=dates[from],hi=dates[to];
    const idx=d=>{let a=from,b=to;while(a<b){const m=(a+b)>>1;dates[m]<d?a=m+1:b=m;}return a;};
    const layer=document.createElementNS(NS,'g');layer.id='call-markers';
    const c=window.MarketLab?.colors?.()||{ink:'#222',surface:'#fff'};
    items.forEach((it,k)=>{
      const row=rows[k];if(!row)return;
      row.calls.filter(cl=>key(cl.t)===key(it.id)&&cl.d>=lo&&cl.d<=hi).forEach(cl=>{
        const x=g.X(idx(cl.d)),y=px.y1-7-k*11;
        const m=document.createElementNS(NS,'g');m.setAttribute('class','call-marker');m.setAttribute('tabindex','0');m.setAttribute('role','button');
        m.setAttribute('aria-label',`${cl.id} earnings call`);
        m.innerHTML=`<title>${esc(cl.id)} earnings call</title><rect x="${(x-7).toFixed(1)}" y="${y-7}" width="14" height="14" fill="transparent"/><path d="M${x.toFixed(1)} ${y-4.5} l4.5 4.5 l-4.5 4.5 l-4.5 -4.5 z" fill="${c.ink}" stroke="${c.surface}" stroke-width="1" opacity=".8"/>`;
        const go=e=>{e.stopPropagation();e.preventDefault?.();const r=m.getBoundingClientRect();openPop(cl,row,r.left+r.width/2,r.bottom);};
        m.addEventListener('pointerdown',e=>e.stopPropagation());
        m.addEventListener('mousedown',e=>e.stopPropagation());
        m.addEventListener('click',go);
        m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e);});
        layer.append(m);
      });
    });
    if(layer.childNodes.length)svg.append(layer);
  }

  window.MarketLabCompanyCalls={covers:t=>known().has(key(t)),mount,paint};
})();
