/* Earnings calls page: lens trends, phrase search over saved quotes, stance heatmap, recent turns. */
(()=>{
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeLink=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const NS='http://www.w3.org/2000/svg';
  const PALETTE=['#3d8fd1','#e0784f','#4fae7f','#c9a227','#9a73d1','#d45f8c','#3fb2b4','#8f9aa3','#b5793a','#6a8a3a'];
  const STANCE={'-2':['against2','Strongly against'],'-1':['against1','Against'],'0':['neutral','Neutral'],'1':['for1','For'],'2':['for2','Strongly for']};
  const stColor=s=>`var(--st-${STANCE[String(s)][0]})`;
  const stWord=s=>STANCE[String(s)][1];
  const signed=n=>(n>0?'+':'')+n;
  const pct=v=>v==null?'':(v>0?'+':'')+(v*100).toFixed(1)+'%';
  const store={get(k,d){try{return localStorage.getItem(k)??d;}catch{return d;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
  const KEY='equinox.calls.view.v1';
  let D,Q=null,quotesPending=null;
  const saved=(()=>{try{return JSON.parse(store.get(KEY,'{}'))||{};}catch{return {};}})();
  const st={lens:saved.lens||'theater',mode:saved.mode||'company',who:saved.who||'all',measure:saved.measure||'p10k',smooth:saved.smooth||'4',topic:saved.topic||'theater',cos:Array.isArray(saved.cos)?saved.cos:null,on:{},hidden:new Set(),cell:null,allTurns:false};
  // st.on holds the lines switched on in sector and basket mode. No saved list means the starting set.
  if(saved.on&&typeof saved.on==='object')for(const m of ['sector','basket'])if(Array.isArray(saved.on[m]))st.on[m]=saved.on[m].filter(x=>typeof x==='string');
  const START={basket:6};
  const shown=m=>{const all=(D.groups[m]||[]).map(g=>g.id);if(st.on[m]){const s=new Set(st.on[m]);return all.filter(e=>s.has(e));}return START[m]?all.slice(0,START[m]):all;};
  const syncHidden=()=>{st.hidden.clear();if(st.mode==='company')return;const s=new Set(shown(st.mode));for(const g of D.groups[st.mode]||[])if(!s.has(g.id))st.hidden.add(g.id);};
  const persist=()=>{store.set(KEY,JSON.stringify({lens:st.lens,mode:st.mode,who:st.who,measure:st.measure,smooth:st.smooth,topic:st.topic,cos:st.cos,on:st.on}));writeHash();};

  // ------------------------------------------------ link to a view
  // #lens=theater&mode=basket&who=all&measure=p10k&smooth=4&topic=theater&on=basket:mag7,basket:gpu
  const HASH_SELECTS=['lens','mode','who','measure','smooth'];
  const enc=v=>encodeURIComponent(v).replace(/%3A/gi,':');
  // On the Industry page the view rides behind the industry's own name: #live-entertainment&lens=theater...
  const LIVE=document.getElementById('live');
  function writeHash(){
    if(!D||(LIVE&&LIVE.hidden))return;
    const on=st.mode==='company'?st.cos||[]:(D.groups[st.mode]||[]).map(g=>g.id).filter(e=>!st.hidden.has(e));
    const h=[...HASH_SELECTS,'topic'].map(k=>k+'='+enc(st[k])).join('&')+'&on='+on.map(enc).join(',');
    try{history.replaceState(history.state,'',location.pathname+location.search+'#'+(LIVE?'live-entertainment&':'')+h);}catch{}
  }
  function readHash(){
    const h=location.hash.slice(1);if(!h.includes('='))return null;
    const o={};
    for(const part of h.split('&')){const i=part.indexOf('=');if(i>0)o[part.slice(0,i)]=part.slice(i+1);}
    return o;
  }
  const dec=v=>{try{return decodeURIComponent(v);}catch{return '';}};
  // Takes what it recognises and leaves the rest of the view alone. Returns true when the hash carried a view.
  function applyHash(){
    const o=readHash();if(!o)return false;
    for(const id of HASH_SELECTS){
      if(!Object.hasOwn(o,id))continue;
      const v=dec(o[id]);
      if([...$(id).options].some(x=>x.value===v)&&(id!=='mode'||D.groups[v]?.length))st[id]=v;
    }
    if(Object.hasOwn(o,'topic')){const v=dec(o.topic);if(v!==st.topic&&D.stance.topics.some(t=>t.id===v)){st.topic=v;st.cell=null;}}
    if(Object.hasOwn(o,'on')){
      const m=st.mode,known=new Set((D.groups[m]||[]).map(g=>g.id));
      const ids=[...new Set(o.on.split(',').map(dec).map(v=>known.has(v)?v:known.has(m+':'+v)?m+':'+v:null).filter(Boolean))];
      if(ids.length){if(m==='company')st.cos=ids;else st.on[m]=ids;}
    }
    return true;
  }

  // ------------------------------------------------ per-company files, loaded on demand
  const shards=new Map();
  const shard=e=>{
    if(!shards.has(e))shards.set(e,fetch(`cube/calls/${encodeURIComponent(e)}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Company call data could not be loaded.');return r.json();}).catch(err=>{shards.delete(e);throw err;}));
    return shards.get(e);
  };
  const loaded=new Map();
  const ensure=ids=>Promise.all(ids.map(e=>shard(e).then(j=>{loaded.set(e,j);}).catch(()=>{})));

  const entLabel=e=>D.groups.company.find(g=>g.id===e)?.label||e;
  const lensLabel=id=>D.lenses.find(l=>l.id===id)?.label||id;
  const qLabel=i=>{const q=D.quarters[i]||'';return q.slice(4)+' '+q.slice(0,4);};

  // ------------------------------------------------ trend chart
  function series(){
    const company=st.mode==='company';
    const groups=company?st.cos.map(e=>D.groups.company.find(g=>g.id===e)).filter(Boolean):(D.groups[st.mode]||[]);
    const k=+st.smooth;
    return groups.map((g,gi)=>{
      const pts=((company?loaded.get(g.id)?.trends:D.trends[g.id])||{})[st.lens]||[];
      const byQ=new Map(pts.map(p=>[p[0],p]));
      const vals=D.quarters.map((_,q)=>{
        if(!byQ.has(q))return null;
        let calls=0,men=0,den=0;
        for(let j=q-k+1;j<=q;j++){
          const p=byQ.get(j);if(!p)continue;
          const [,c,w,tot,mg,an,mw,aw]=p;
          calls+=c;
          men+=st.who==='mgmt'?mg:st.who==='analyst'?an:tot;
          den+=st.who==='mgmt'?(mw||w):st.who==='analyst'?(aw||w):w;
        }
        if(!calls)return null;
        return st.measure==='call'?men/calls:(den?men/den*1e4:null);
      });
      return {id:g.id,label:g.label,color:PALETTE[gi%PALETTE.length],vals,n:g.members?.length};
    });
  }
  function drawTrend(){
    const host=$('chart'),all=series(),vis=all.filter(s=>!st.hidden.has(s.id));
    const W=Math.max(560,host.clientWidth||900),H=380,P={l:44,r:150,t:34,b:30};
    const nQ=D.quarters.length,X=i=>P.l+i/(nQ-1)*(W-P.l-P.r);
    let max=0;vis.forEach(s=>s.vals.forEach(v=>{if(v!=null&&v>max)max=v;}));
    const step=niceStep(max||1),top=Math.max(step,Math.ceil((max||1)/step)*step);
    const Y=v=>P.t+(1-v/top)*(H-P.t-P.b);
    const c=MarketLab.colors();
    let g='';
    for(let v=0;v<=top+1e-9;v+=step)g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c.border}"/><text x="${P.l-8}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="${c.muted}">${fmt(v)}</text>`;
    D.quarters.forEach((q,i)=>{if(q.endsWith('Q1')&&(+q.slice(0,4))%2===0)g+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle" font-size="12" fill="${c.muted}">${q.slice(0,4)}</text><line x1="${X(i)}" x2="${X(i)}" y1="${H-P.b}" y2="${H-P.b+5}" stroke="${c.border}"/>`;});
    g+=`<text x="0" y="13" font-size="12.5" fill="${c.muted}">${st.measure==='call'?'Mentions per call':'Mentions per 10,000 words'}${st.smooth==='4'?', 4-quarter average':''}</text>`;
    const ends=[];
    vis.forEach(s=>{
      let d='',pen=false;
      s.vals.forEach((v,i)=>{if(v==null){pen=false;return;}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);pen=true;});
      g+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" data-s="${esc(s.id)}"/>`;
      const li=s.vals.findLastIndex(v=>v!=null);
      if(li>=0)ends.push({s,y:Y(s.vals[li]),x:X(li)});
    });
    ends.sort((a,b)=>a.y-b.y);
    for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<15)ends[i].y=ends[i-1].y+15;
    const over=ends.length?ends.at(-1).y-(H-P.b):0;
    if(over>0)ends.forEach(e=>e.y-=over);
    ends.forEach(e=>{g+=`<text x="${W-P.r+8}" y="${(e.y+4).toFixed(1)}" font-size="12.5" fill="${e.s.color}" font-weight="600">${esc(trim(e.s.label,20))}</text>`;});
    g+=`<line id="xhair" y1="${P.t}" y2="${H-P.b}" stroke="${c.muted}" stroke-dasharray="3 3" opacity="0"/><rect x="${P.l}" y="${P.t}" width="${W-P.l-P.r}" height="${H-P.t-P.b}" fill="transparent" id="hit"/>`;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lensLabel(st.lens))} mentions by quarter">${g}</svg><div class="tip" id="tip"></div>`;
    if(!vis.length)host.querySelector('svg').insertAdjacentHTML('beforeend',`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="${c.muted}">Nothing selected</text>`);
    const svg=host.querySelector('svg'),tip=$('tip'),xh=svg.querySelector('#xhair');
    svg.querySelector('#hit').addEventListener('mousemove',e=>{
      const r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)*W/r.width;
      const i=Math.max(0,Math.min(nQ-1,Math.round((sx-P.l)/(W-P.l-P.r)*(nQ-1))));
      const rows=vis.map(s=>({s,v:s.vals[i]})).filter(r=>r.v!=null).sort((a,b)=>b.v-a.v);
      xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('opacity',rows.length?1:0);
      if(!rows.length){tip.classList.remove('on');return;}
      tip.innerHTML=`<b>${esc(qLabel(i))}</b>`+rows.map(r=>`<div><i style="background:${r.s.color}"></i>${esc(trim(r.s.label,22))}<span>${fmt(r.v)}</span></div>`).join('');
      const px=X(i)*r.width/W;tip.style.left=(px>r.width*.6?px-tip.offsetWidth-12:px+12)+'px';tip.style.top='12px';tip.classList.add('on');
    });
    svg.querySelector('#hit').addEventListener('mouseleave',()=>{tip.classList.remove('on');xh.setAttribute('opacity',0);});
    const company=st.mode==='company';
    $('key').innerHTML=all.map(s=>company?`<button type="button" class="chip" data-k="${esc(s.id)}" title="Remove ${esc(s.label)}"><i style="background:${s.color}"></i>${esc(s.label)}<span aria-hidden="true">×</span></button>`:
      `<button type="button" data-k="${esc(s.id)}" aria-pressed="${!st.hidden.has(s.id)}" title="${st.hidden.has(s.id)?'Show':'Hide'} ${esc(s.label)}"><i style="background:${s.color}"></i>${esc(s.label)}${s.n?` · ${s.n}`:''}</button>`).join('');
    $('key').querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=b.dataset.k;
      if(company)st.cos=st.cos.filter(e=>e!==k);
      else{st.hidden.has(k)?st.hidden.delete(k):st.hidden.add(k);st.on[st.mode]=all.map(s=>s.id).filter(e=>!st.hidden.has(e));}
      persist();drawTrend();});
  }
  const niceStep=m=>{const raw=m/5,p=10**Math.floor(Math.log10(raw)),f=raw/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;};
  const fmt=v=>v>=10?v.toFixed(0):v>=1?v.toFixed(1):v.toFixed(2);
  const trim=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;

  // ------------------------------------------------ phrase search
  // One company: search its own file. Any company: the sector quote files, fetched once on first search.
  const loadQuotes=()=>quotesPending||(quotesPending=Promise.all(D.search.map(s=>fetch('cube/'+s.file,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Quotes could not be loaded.');return r.json();}))).then(js=>Q=js.flatMap(j=>j.rows)).catch(e=>{quotesPending=null;throw e;}));
  let searchTimer,searchRun=0;
  async function search(){
    const out=$('search-out'),q=$('q').value.trim(),lens=$('qlens').value,ent=$('qent').value,run=++searchRun;
    if(q.length<2&&!lens&&!ent){out.innerHTML='';return;}
    out.textContent='Searching…';
    let rows;
    try{rows=Q&&!ent?Q:ent?(await shard(ent)).quotes:await loadQuotes();}catch(e){if(run===searchRun)out.textContent=e.message;return;}
    if(run!==searchRun)return;
    const needle=q.toLowerCase();
    const hits=rows.filter(r=>(!lens||r.l===lens)&&(!ent||r.e===ent)&&(needle.length<2||r.x.toLowerCase().includes(needle))).sort((a,b)=>b.d.localeCompare(a.d));
    const calls=new Set(hits.map(h=>h.c)).size,show=hits.slice(0,60);
    const mark=s=>{if(needle.length<2)return esc(s);const i=s.toLowerCase().indexOf(needle);return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+needle.length))+'</mark>'+esc(s.slice(i+needle.length));};
    out.innerHTML=`<p class="search-sum">${hits.length.toLocaleString()} quote${hits.length===1?'':'s'} from ${calls} call${calls===1?'':'s'}${hits.length>show.length?` · newest ${show.length} shown`:''}</p>`+
      (show.length?`<ul class="qlist">${show.map(r=>{const u=safeLink(r.url);return `<li><div class="qmeta"><b>${esc(entLabel(r.e))}</b><span>${esc(r.c)} · ${esc(r.d)}</span><span>${esc(r.s||'Unnamed speaker')} · ${r.r==='management'?'management':r.r==='analyst'?'analyst':'speaker'}</span><span>${esc(lensLabel(r.l))}</span>${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</div><p class="qtext">${mark(r.x)}</p></li>`;}).join('')}</ul>`:'');
  }

  // ------------------------------------------------ stance heatmap
  function drawStance(){
    const rows=D.stance.rows.filter(r=>r.topic===st.topic);
    $('topic').innerHTML=D.stance.topics.map(t=>`<button type="button" data-t="${t.id}" aria-pressed="${t.id===st.topic}">${esc(t.label)}</button>`).join('');
    $('topic').querySelectorAll('button').forEach(b=>b.onclick=()=>{st.topic=b.dataset.t;st.cell=null;persist();drawStance();});
    $('stance-legend').innerHTML=[-2,-1,0,1,2].map(s=>`<span><i class="sw" style="background:${stColor(s)}"></i>${stWord(s)}</span>`).join('')+`<span>▲▼ changed stance</span>`;
    if(!rows.length){$('heat').innerHTML='<p class="calls-note">No stance scores yet.</p>';$('stance-quote').innerHTML='';return;}
    const ents=[...new Set(D.stance.rows.map(r=>r.e))].sort((a,b)=>entLabel(a).localeCompare(entLabel(b)));
    const q0=Math.min(...D.stance.rows.map(r=>r.q)),q1=Math.max(...D.stance.rows.map(r=>r.q)),nq=q1-q0+1;
    const LW=170,cw=Math.max(9,Math.min(16,(Math.max(760,$('heat').clientWidth)-LW-10)/nq)),ch=24,gap=6,T=4;
    const W=LW+nq*cw+10,H=T+ents.length*(ch+gap)+26,c=MarketLab.colors();
    const by=new Map(rows.map(r=>[r.e+'|'+r.q,r]));
    let g='';
    ents.forEach((e,ri)=>{
      const y=T+ri*(ch+gap);
      g+=`<text x="${LW-10}" y="${y+ch/2+4}" text-anchor="end" font-size="13" fill="${c.ink}">${esc(trim(entLabel(e),24))}</text>`;
      for(let q=q0;q<=q1;q++){
        const x=LW+(q-q0)*cw,r=by.get(e+'|'+q);
        if(!r){g+=`<circle cx="${x+cw/2}" cy="${y+ch/2}" r="1.4" fill="${c.faint}" opacity=".5"/>`;continue;}
        const idx=D.stance.rows.indexOf(r),on=st.cell===idx;
        const mark=r.shift?`<text x="${x+cw/2}" y="${y+ch/2+3.5}" text-anchor="middle" font-size="9" style="fill:var(--st-mark)" pointer-events="none">${r.shift.to>r.shift.from?'▲':'▼'}</text>`:'';
        g+=`<g class="cell${on?' on':''}" tabindex="0" role="button" data-i="${idx}" aria-label="${esc(entLabel(e))} ${esc(r.call)}: ${stWord(r.score)}"><title>${esc(entLabel(e))} · ${esc(r.call)}: ${stWord(r.score)}${r.shift?', changed from '+stWord(r.shift.from).toLowerCase():''}</title><rect x="${x+.5}" y="${y}" width="${cw-1}" height="${ch}" rx="2" style="fill:${stColor(r.score)}"/>${mark}</g>`;
      }
    });
    for(let q=q0;q<=q1;q++){const s=D.quarters[q];if(s.endsWith('Q1')&&(+s.slice(0,4))%2===0)g+=`<text x="${LW+(q-q0)*cw}" y="${H-8}" font-size="12" fill="${c.muted}">${s.slice(0,4)}</text>`;}
    $('heat').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Stance on ${esc(st.topic)} by call">${g}</svg>`;
    $('heat').querySelectorAll('.cell').forEach(el=>{
      const open=()=>{st.cell=+el.dataset.i;$('heat').querySelectorAll('.cell.on').forEach(x=>x.classList.remove('on'));el.classList.add('on');showQuote(D.stance.rows[st.cell]);};
      el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
    });
    if(st.cell==null||D.stance.rows[st.cell]?.topic!==st.topic){
      const latest=rows.filter(r=>r.shift).sort((a,b)=>b.d.localeCompare(a.d))[0]||rows.at(-1);
      st.cell=D.stance.rows.indexOf(latest);
      $('heat').querySelector(`.cell[data-i="${st.cell}"]`)?.classList.add('on');
    }
    showQuote(D.stance.rows[st.cell],false);
  }
  function showQuote(r,animate=true){
    const box=$('stance-quote');if(!r){box.innerHTML='';return;}
    const u=safeLink(r.url),topic=D.stance.topics.find(t=>t.id===r.topic)?.label||r.topic;
    const [who,...role]=(r.speaker||'').split(',');
    box.innerHTML=`<div class="q-when">${esc(entLabel(r.e))} · ${esc(r.call)}<span>${esc(r.d)}</span></div>
      <div class="q-score"><i class="sw" style="background:${stColor(r.score)}"></i>${esc(topic)}: ${stWord(r.score)} (${signed(r.score)})${r.shift?` · changed from ${stWord(r.shift.from).toLowerCase()} (${signed(r.shift.from)})`:''}</div>
      ${r.quote?`<p class="calls-quote">“${esc(r.quote)}”</p>`:''}
      ${who?`<div class="calls-who">${esc(who)}${role.length?`<span>, ${esc(role.join(',').trim())}</span>`:''}</div>`:''}
      <p class="calls-why">${esc(r.shift?.why||r.summary)}</p>
      ${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Read the transcript ↗</a>`:'<p class="calls-note">No public source link for this call, so the quote is left out.</p>'}`;
    if(animate){box.classList.remove('enter');void box.offsetWidth;box.classList.add('enter');}
  }

  // ------------------------------------------------ turns feed
  function drawTurns(){
    const list=st.allTurns?D.turns:D.turns.slice(0,10);
    $('turn-list').innerHTML=list.map((t,i)=>{
      const topic=D.stance.topics.find(x=>x.id===t.topic)?.label||t.topic;
      return `<li><button type="button" class="turn" data-i="${i}"><span class="when"><b>${esc(entLabel(t.e))}</b>${esc(t.d)}</span>
        <span class="what"><span>${esc(topic)}</span><span class="move"><i class="sw" style="background:${stColor(t.from)}"></i>${stWord(t.from)} → <i class="sw" style="background:${stColor(t.to)}"></i>${stWord(t.to)}</span><span class="calls-note">${esc(t.call)}</span></span>
        <p class="why">${esc(t.why)}</p>${t.quote&&safeLink(t.url)?`<p class="tq">“${esc(t.quote)}” ${esc((t.speaker||'').split(',')[0])}</p>`:''}</button></li>`;
    }).join('');
    $('more-turns').hidden=st.allTurns||D.turns.length<=10;
    $('turn-list').querySelectorAll('.turn').forEach(b=>b.onclick=()=>{
      const t=list[+b.dataset.i];
      st.topic=t.topic;st.cell=D.stance.rows.findIndex(r=>r.call===t.call&&r.topic===t.topic);persist();drawStance();
      $('stance').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    });
  }

  // ------------------------------------------------ methodology
  function drawMethod(){
    const n=D.totals.calls,linked=D.totals.linked;
    $('method-body').innerHTML=`<p>The database holds ${n} earnings calls from ${esc(qLabel(0))} to ${esc(qLabel(D.quarters.length-1))}. Calls are grouped by calendar quarter of the call date. When a business changed hands or tickers, its calls stay on one line (for example Time Warner, then AT&amp;T's WarnerMedia, then Warner Bros. Discovery).</p>
      <h3>Topics</h3><p>A topic is a saved list of words and phrases, plus exclusions. A match inside an exclusion is dropped (for example "Home Box Office" is not box office, and Disney's legal disclaimer about theatrical releases is not counted).</p>
      <table><thead><tr><th>Topic</th><th class="n">Phrases</th><th class="n">Exclusions</th><th>Notes</th></tr></thead><tbody>${D.lenses.map(l=>`<tr><td>${esc(l.label)}</td><td class="n">${l.terms}</td><td class="n">${l.exclude}</td><td>${esc(l.note||(l.groups?'Split into '+l.groups.join(', '):''))}</td></tr>`).join('')}</tbody></table>
      <h3>Counting</h3><p>Mentions per 10,000 words is the number of matches divided by the words spoken, times 10,000. This keeps long and short calls comparable. "Management" counts executives; "Analysts" counts the people asking questions; the operator is left out. With a speaker picked, the words are that group's words only. The 4-quarter average adds up four quarters of mentions and words before dividing. Mentions per call divides by the number of calls in the quarter.</p>
      <h3>Stance</h3><p>Each call is scored from −2 (strongly against) to +2 (strongly for) on theatrical releases and on the company's own streaming business. ${D.stance_source==='pilot'?'Scores come from the cinema pilot, which read every call by hand.':'Scores are read from the call by a model and checked against the quote.'} A turn is a call where the score changed from the last call, with the reason it changed.</p>
      <h3>Quotes</h3><p>Quotes are word for word, one or two sentences, and at most 300 characters. A long sentence is cut around the matched phrase and the cut is marked with "…". Each quote links to its source. ${n-linked} of ${n} calls have no public source link, so they show counts and scores but no quotes. Full transcripts stay off the site. Search looks through the saved quotes only.</p>`;
  }

  // ------------------------------------------------ wiring
  function fillControls(){
    $('lens').innerHTML=D.lenses.map(l=>`<option value="${l.id}">${esc(l.label)}</option>`).join('');
    $('qlens').innerHTML='<option value="">Any</option>'+D.lenses.map(l=>`<option value="${l.id}">${esc(l.label)}</option>`).join('');
    $('qent').innerHTML='<option value="">Any</option>'+D.groups.company.map(g=>`<option value="${g.id}">${esc(g.label)}</option>`).join('');
    applyHash();
    if(!D.lenses.some(l=>l.id===st.lens))st.lens=D.lenses[0].id;
    if(!D.groups[st.mode]?.length)st.mode='company';
    const ids=new Set(D.groups.company.map(g=>g.id));
    st.cos=(st.cos||D.featured||[]).filter(e=>ids.has(e));
    syncHidden();
    for(const id of ['lens','mode','who','measure','smooth']){
      const el=$(id);el.value=st[id];
      el.onchange=()=>{st[id]=el.value;if(id==='mode')syncHidden();persist();fillCos();fit();redraw();};
    }
    $('add-list').innerHTML=D.groups.company.map(g=>`<option value="${esc(g.label)}">${esc((g.tickers||[]).join(' '))}</option>`).join('');
    const add=()=>{
      const v=$('add').value.trim().toLowerCase();if(!v)return;
      const C=D.groups.company,g=C.find(x=>x.label.toLowerCase()===v)||C.find(x=>(x.tickers||[]).some(t=>t.toLowerCase()===v));
      if(!g)return;
      $('add').value='';
      if(!st.cos.includes(g.id)){st.cos.push(g.id);persist();redraw();}
    };
    $('add').onchange=add;$('add').oninput=()=>{const v=$('add').value.toLowerCase();if(D.groups.company.some(x=>x.label.toLowerCase()===v))add();};
    fillCos();fit();document.fonts?.ready.then(fit);
    [...$('mode').options].forEach(o=>{if(!D.groups[o.value]?.length)o.disabled=true;});
    $('q').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,180);};
    $('qlens').onchange=search;$('qent').onchange=search;
    $('more-turns').onclick=()=>{st.allTurns=true;drawTurns();};
  }
  function fillCos(){$('add').hidden=st.mode!=='company';}
  // the heading's dropdowns are only as wide as the word they show
  const ruler=document.createElement('canvas').getContext('2d');
  function fit(){for(const id of ['lens','mode','who']){const el=$(id),cs=getComputedStyle(el);ruler.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    el.style.width=Math.ceil(ruler.measureText(el.options[el.selectedIndex]?.text||'').width*1.02+26)+'px';}}
  const redraw=()=>{const need=st.mode==='company'?st.cos.filter(e=>!loaded.has(e)):[];if(!need.length)return drawTrend();ensure(need).then(drawTrend);};
  async function start(){
    try{
      const r=await fetch('cube/calls.json',{cache:'no-cache'});
      if(!r.ok)throw Error('Earnings call data could not be loaded.');
      D=await r.json();
    }catch(e){const box=$('load-error');box.hidden=false;box.textContent=e.message;return;}
    $('asof').textContent=typeof EQ==='object'?'Updated '+EQ.day(D.updated):'updated '+D.updated;
    fillControls();redraw();drawStance();drawTurns();drawMethod();
    // the Industry page hides this block while another industry is open; redraw at the real width on return
    addEventListener('eq:industry',()=>{fit();drawTrend();drawStance();});
    let w=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-w)>40){w=innerWidth;drawTrend();drawStance();}});
    addEventListener('ml:themechange',()=>{drawTrend();drawStance();});
    addEventListener('hashchange',()=>{
      if(!applyHash())return;
      const ids=new Set(D.groups.company.map(g=>g.id));st.cos=st.cos.filter(e=>ids.has(e));
      for(const id of HASH_SELECTS)$(id).value=st[id];
      syncHidden();fillCos();fit();redraw();drawStance();
    });
  }
  start();
})();
