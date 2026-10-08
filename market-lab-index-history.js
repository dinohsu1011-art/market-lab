/* Home: how the S&P 500 and Nasdaq-100 have changed shape since 2010.
   One chart of the ten-largest share (both indexes on one axis), then the
   sector mix of each index as stacked bands. Hover any chart to read a date. */
(()=>{
  const host=document.getElementById('index-history');
  if(!host)return;
  if(document.documentElement.dataset.workspace!=='home'){host.remove();return;}
  const D=window.QUANT_INDEX_HISTORY;
  if(!D||!D.dates||!D.indexes)return;
  host.hidden=false;
  const NS='http://www.w3.org/2000/svg';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const p0=w=>Math.round(w*100)+'%',p1=w=>(w*100).toFixed(1)+'%';
  const T=D.dates.map(s=>new Date(s+'T12:00:00').getTime());
  const fmtQ=i=>{const d=new Date(T[i]);return i===T.length-1?d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):d.toLocaleDateString(undefined,{month:'short',year:'numeric'});};
  const KEYS=['spx','ndx'].filter(k=>D.indexes[k]);
  const SHORT={'Information Technology':'Tech','Communication Services':'Comm. services','Consumer Discretionary':'Consumer disc.','Consumer Staples':'Staples','Health Care':'Health care','Real Estate':'Real estate'};
  const sname=s=>SHORT[s]||s;
  // one band order for both charts: largest S&P sector today at the bottom
  const order=(()=>{const seen=new Map();for(const k of KEYS)for(const [s,v] of Object.entries(D.indexes[k].sectors)){seen.set(s,Math.max(seen.get(s)||0,v[v.length-1]+(k==='spx'?1:0)));}
    return [...seen].sort((a,b)=>b[1]-a[1]).map(([s])=>s).filter(s=>s!=='Other').concat(seen.has('Other')?['Other']:[]);})();
  // the three that moved the most get color; the rest are shades of ink
  const tint=s=>{const i=order.indexOf(s);
    if(i===0)return{f:'var(--ml-accent)',o:.9};
    if(i===1)return{f:'var(--ml-accent)',o:.55};
    if(i===2)return{f:'var(--ml-accent)',o:.3};
    return{f:'var(--ml-ink)',o:[.42,.32,.24,.18,.13,.09,.06,.04][(i-3)%8]};};

  const W=640,H=250,M={l:40,r:62,t:12,b:26};
  const x=i=>M.l+(T[i]-T[0])/(T[T.length-1]-T[0])*(W-M.l-M.r);
  const el=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;};
  const years=(()=>{const out=[];const y0=new Date(T[0]).getFullYear()+1,y1=new Date(T[T.length-1]).getFullYear();for(let y=y0;y<=y1;y+=(y1-y0>12?2:1))out.push(y);return out;})();
  const xOfYear=y=>M.l+(Date.UTC(y,0,1)-T[0])/(T[T.length-1]-T[0])*(W-M.l-M.r);

  function axes(svg,y,ticks){
    const g=el('g',{class:'ih-axis'},svg);
    for(const v of ticks){el('line',{x1:M.l,x2:W-M.r,y1:y(v),y2:y(v)},g);const t=el('text',{x:M.l-6,y:y(v)+4,'text-anchor':'end'},g);t.textContent=p0(v);}
    for(const yr of years){const t=el('text',{x:xOfYear(yr),y:H-6,'text-anchor':'middle'},g);t.textContent=yr;}
  }

  // hover: nearest quarter under the pointer, a hairline, and a readout
  function scrub(svg,readout,draw){
    const rule=el('line',{class:'ih-rule',y1:M.t,y2:H-M.b,visibility:'hidden'},svg);
    const hit=el('rect',{x:M.l,y:M.t,width:W-M.l-M.r,height:H-M.t-M.b,fill:'transparent'},svg);
    const at=e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W;let best=0;for(let i=0;i<T.length;i++)if(Math.abs(x(i)-px)<Math.abs(x(best)-px))best=i;return best;};
    const show=i=>{rule.setAttribute('x1',x(i));rule.setAttribute('x2',x(i));rule.setAttribute('visibility','visible');readout.innerHTML=draw(i);};
    hit.addEventListener('pointermove',e=>show(at(e)));
    hit.addEventListener('pointerleave',()=>{rule.setAttribute('visibility','hidden');readout.innerHTML=draw(T.length-1,true);});
    readout.innerHTML=draw(T.length-1,true);
    return {hit,at};
  }

  function topChart(){
    const box=document.createElement('div');box.className='ih-top';
    const all=KEYS.flatMap(k=>D.indexes[k].top10),hi=Math.ceil(Math.max(...all)*10+.5)/10,lo=Math.max(0,Math.floor(Math.min(...all)*10-.5)/10);
    const y=v=>M.t+(hi-v)/(hi-lo)*(H-M.t-M.b);
    const ticks=[];for(let v=lo;v<=hi+1e-9;v+=.1)ticks.push(+v.toFixed(2));
    const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':KEYS.map(k=>`${D.indexes[k].label}: ten largest held ${p0(D.indexes[k].top10[0])} in ${new Date(T[0]).getFullYear()}, ${p0(D.indexes[k].top10.at(-1))} now`).join('; ')});
    axes(svg,y,ticks);
    for(const k of KEYS){
      const v=D.indexes[k].top10;
      el('path',{class:`ih-line ${k}`,d:v.map((w,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(w).toFixed(1)}`).join('')},svg);
      const t=el('text',{class:`ih-end ${k}`,x:x(v.length-1)+8,y:y(v.at(-1))+4},svg);
      t.textContent=`${D.indexes[k].label==='Nasdaq-100'?'NDX':'S&P'} ${p0(v.at(-1))}`;
    }
    const read=document.createElement('div');read.className='ih-read';
    const names=(k,i)=>D.indexes[k].tops[i].map(([t])=>esc(t)).join(', ');
    box.innerHTML=`<h3>Share held by the ten largest companies</h3>`;
    box.append(svg,read);
    scrub(svg,read,i=>`<b>${fmtQ(i)}</b>${KEYS.map(k=>`<div class="${k}"><i></i><span>${esc(D.indexes[k].label)} <strong>${p1(D.indexes[k].top10[i])}</strong></span><small>${names(k,i)}</small></div>`).join('')}`);
    return box;
  }

  function sectorChart(k){
    const ix=D.indexes[k],box=document.createElement('div');box.className='ih-sec';
    const y=v=>M.t+(1-v)*(H-M.t-M.b);
    const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':`${ix.label} sector mix since ${new Date(T[0]).getFullYear()}`});
    axes(svg,y,[0,.25,.5,.75,1]);
    const base=new Array(T.length).fill(0),g=el('g',{},svg);
    for(const s of order){
      const v=ix.sectors[s];if(!v)continue;
      const top=v.map((w,i)=>base[i]+w);
      const d=top.map((w,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(w).toFixed(1)}`).join('')+base.map((_,j)=>{const i=T.length-1-j;return`L${x(i).toFixed(1)},${y(base[i]).toFixed(1)}`;}).join('')+'Z';
      const c=tint(s);
      el('path',{d,fill:c.f,'fill-opacity':c.o,'data-s':s,class:'ih-band'},g);
      for(let i=0;i<T.length;i++)base[i]=top[i];
    }
    const read=document.createElement('div');read.className='ih-read ih-mix';
    box.innerHTML=`<h3>${esc(ix.label)}<small>sector mix</small></h3>`;
    box.append(svg,read);
    const sc=scrub(svg,read,i=>`<b>${fmtQ(i)}</b><ol>${order.filter(s=>ix.sectors[s]&&ix.sectors[s][i]>=.005).sort((a,b)=>ix.sectors[b][i]-ix.sectors[a][i]).map(s=>{const c=tint(s);return`<li data-s="${esc(s)}"><i style="background:${c.f};opacity:${c.o}"></i>${esc(sname(s))}<strong>${p0(ix.sectors[s][i])}</strong></li>`;}).join('')}</ol>`);
    // the band under the pointer
    sc.hit.addEventListener('pointermove',e=>{const i=sc.at(e),r=svg.getBoundingClientRect(),v=1-((e.clientY-r.top)/r.height*H-M.t)/(H-M.t-M.b);let acc=0,hit=null;
      for(const s of order){const w=ix.sectors[s]?ix.sectors[s][i]:0;if(v>=acc&&v<acc+w){hit=s;break;}acc+=w;}
      box.dispatchEvent(new CustomEvent('ih-sector',{bubbles:true,detail:hit}));});
    return box;
  }

  const y0=new Date(T[0]+864e5).getFullYear();
  host.innerHTML=`<header><h2>How they have changed since ${y0}</h2>
    <p class="iw-note">Rebuilt from each company's price and share count every quarter, so treat it as a close estimate. Companies that have since left the index are filled in at a typical member's size. Sectors use today's labels, so Alphabet and Meta count as Communication Services the whole way. The Nasdaq-100 before about 2015 is the roughest part.</p></header>`;
  const wrap=document.createElement('div');wrap.className='ih-grid';
  wrap.append(topChart());
  const secs=document.createElement('div');secs.className='ih-secs';
  for(const k of KEYS)secs.append(sectorChart(k));
  wrap.append(secs);host.append(wrap);
  // point at a sector, in a chart or a readout, and it lights up in both indexes
  const hl=s=>{secs.classList.toggle('hl',!!s);secs.querySelectorAll('[data-s]').forEach(e=>e.classList.toggle('on',e.dataset.s===s));};
  secs.addEventListener('pointerover',e=>{const t=e.target.closest('[data-s]');if(t)hl(t.dataset.s);});
  secs.addEventListener('ih-sector',e=>hl(e.detail));
  secs.addEventListener('pointerleave',()=>hl(null));
})();
