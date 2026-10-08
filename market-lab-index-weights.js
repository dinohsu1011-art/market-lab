/* Home: what the S&P 500 and Nasdaq-100 are made of, top 15 + the rest, or by sector. */
(()=>{
  const host=document.getElementById('index-weights');
  if(!host)return;
  if(document.documentElement.dataset.workspace!=='home'){host.remove();return;}
  const D=window.QUANT_INDEX_WEIGHTS;
  if(!D)return;
  host.hidden=false;
  const TOP=15,KEY='market-lab.index-weights.mode';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const p1=w=>(w*100).toFixed(1)+'%';
  const day=s=>new Date(s+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  let mode='co';
  try{mode=localStorage.getItem(KEY)==='sec'?'sec':'co';}catch(_){}

  function lines(ix){
    if(mode==='co'){
      const top=ix.rows.slice(0,TOP).map(r=>({k:r.t,label:`<b>${esc(r.t)}</b><span>${esc(r.n)}</span>`,w:r.w}));
      const rest=ix.rows.slice(TOP);
      return {top,rest:{label:`Other ${rest.length} companies`,w:rest.reduce((a,r)=>a+r.w,0)}};
    }
    const by=new Map();
    for(const r of ix.rows){const s=by.get(r.s)||{w:0,n:0};s.w+=r.w;s.n++;by.set(r.s,s);}
    const top=[...by].sort((a,b)=>b[1].w-a[1].w).map(([s,v])=>({k:s,label:`<b>${esc(s)}</b><span>${v.n} cos</span>`,w:v.w}));
    return {top,rest:null};
  }

  function col(ix){
    const {top,rest}=lines(ix),max=Math.max(...top.map(l=>l.w));
    const head=mode==='co'
      ?`<b>${p1(top.reduce((a,l)=>a+l.w,0))}</b><span>of the index sits in its<br>${TOP} largest companies</span>`
      :`<b>${p1(top[0].w)}</b><span>in ${esc(top[0].k)},<br>the largest sector</span>`;
    const row=(l,i)=>`<tr data-k="${esc(l.k)}"><td class="rk">${i+1}</td><td class="nm">${l.label}</td><td class="bar"><i style="width:${(l.w/max*100).toFixed(1)}%"></i></td><td class="pc">${p1(l.w)}</td></tr>`;
    return `<div class="iw-col"><h3>${esc(ix.label)}<small>${ix.rows.length} companies</small></h3>
      <div class="iw-big">${head}</div>
      <div class="iw-strip" aria-hidden="true">${top.map(l=>`<i data-k="${esc(l.k)}" style="flex:${l.w}" title="${esc(l.k)} ${p1(l.w)}"></i>`).join('')}${rest?`<i class="rest" style="flex:${rest.w}" title="${esc(rest.label)} ${p1(rest.w)}"></i>`:''}</div>
      <table class="iw-list"><tbody>${top.map(row).join('')}${rest?`<tr class="rest"><td class="rk"></td><td class="nm">${esc(rest.label)}</td><td class="bar"><i style="width:${Math.min(100,rest.w/max*100).toFixed(1)}%"></i></td><td class="pc">${p1(rest.w)}</td></tr>`:''}</tbody></table></div>`;
  }

  function render(){
    host.innerHTML=`<header><div><h2>What the indexes are made of</h2>
      <p class="iw-note">Estimated weights as of ${day(D.as_of)}, from each company's market value. The S&amp;P 500 officially counts only freely traded shares, and the Nasdaq-100 trims its biggest names each quarter (that rule is applied here), so official weights can differ by about a point. Share classes like GOOGL and GOOG are shown as one company.</p></div>
      <div class="iw-toggle" role="group" aria-label="Group by"><button type="button" data-m="co" aria-pressed="${mode==='co'}">Top ${TOP} companies</button><button type="button" data-m="sec" aria-pressed="${mode==='sec'}">By sector</button></div></header>
      <div class="iw-cols">${['spx','ndx'].map(k=>D.indexes[k]?col(D.indexes[k]):'').join('')}</div>`;
    host.querySelectorAll('.iw-toggle button').forEach(b=>b.onclick=()=>{
      mode=b.dataset.m;try{localStorage.setItem(KEY,mode);}catch(_){}
      render();host.querySelector(`.iw-toggle [data-m="${mode}"]`).focus({preventScroll:true});
    });
    // point at a name or sector and it lights up in both indexes
    const cols=host.querySelector('.iw-cols');
    const hl=k=>{cols.classList.toggle('hl',!!k);cols.querySelectorAll('[data-k]').forEach(e=>e.classList.toggle('on',e.dataset.k===k));};
    cols.addEventListener('pointerover',e=>{const t=e.target.closest('[data-k]');hl(t?t.dataset.k:null);});
    cols.addEventListener('pointerleave',()=>hl(null));
  }
  render();
})();
