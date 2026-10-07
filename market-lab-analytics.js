/* Precomputed session statistics. Shared with the landing-page volume panels. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const state={universe:'sp500',history:'1Y',frequency:'daily',units:'dollars'};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(v,n=1)=>Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:n}):'—';
  const pct=v=>Number.isFinite(v)?number(v)+'%':'—';
  const short=v=>!Number.isFinite(v)?'—':Math.abs(v)>=1e12?(v/1e12).toFixed(1)+'T':Math.abs(v)>=1e9?(v/1e9).toFixed(1)+'B':Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':number(v,0);
  let data=null,pending=null;
  let regimeBreadth=null,regimeGeneration=0;
  async function drawRegime(){
    const host=$('an-regime');if(!host||!window.MarketLabRegime)return;
    const generation=++regimeGeneration,universe=state.universe;
    try{
      if(!regimeBreadth)regimeBreadth=fetch('cube/market-breadth.json').then(r=>{if(!r.ok)throw Error('Breadth unavailable');return window.MarketLabReadJSON(r);}).catch(e=>{regimeBreadth=null;throw e;});
      const breadth=await regimeBreadth;if(generation!==regimeGeneration)return;
      const result=MarketLabRegime.calculate(data,breadth,universe);
      const sign=v=>Number.isFinite(v)?(v>0?'+':'')+number(v,1):'—';
      const color=v=>!Number.isFinite(v)||Math.abs(v)<.4?'var(--ml-ink)':v>0?'var(--ml-up)':'var(--ml-down)';
      host.innerHTML=`<div class="an-regime-heading"><h2>Market regime</h2><p class="an-regime-label">${esc(result.label)} <strong>${sign(result.displayScore)}</strong></p><span>−100 to +100</span></div>
        <div class="an-regime-components"><div class="an-regime-columns"><span>Driver · equal weights</span><span>Effect on total</span></div>${result.components.map(c=>{const contribution=Number.isFinite(c.score)?c.score*12.5:null;return `<details class="an-regime-driver"><summary><span>${esc(c.title)}</span><span class="an-regime-effect"><span class="an-regime-track" aria-hidden="true"><i style="left:${50+Math.min(0,contribution||0)*2}%;width:${Math.abs(contribution||0)*2}%;background:${color(c.score)}"></i></span><strong style="color:${color(c.score)}">${sign(contribution)}</strong></span></summary><p>${esc(c.reason)} Each driver can add or subtract up to 25 points.</p></details>`;}).join('')}</div>
        <details class="an-regime-method"><summary>How the score works</summary>
          <p>The score combines four views of the market, with each contributing one quarter. A positive reading means strength is more widespread; a negative reading means weakness is more widespread. The middle covers mixed conditions. It describes the market at the latest stored close, not the chance of making money on the next trade.</p>
          <p><b>Trend participation</b> asks whether strength reaches beyond a few big stocks. We look at how many stocks are above their short- and long-term moving averages, and whether that share has grown over the past five trading sessions.</p>
          <p><b>Buying vs. selling</b> looks at both the number of rising stocks and the money traded in them. We smooth the stock count over ten sessions and measure trading activity over twenty, so one unusual day has less influence. Heavy volume is only supportive when it accompanies rising prices.</p>
          <p><b>Market damage</b> compares stocks close to their yearly highs with those that have fallen much further. It also checks whether new highs have been more common than new lows over the past twenty sessions. This helps distinguish a healthy pause from weakness spreading through the market.</p>
          <p><b>Index trend</b> checks whether the index is above its 50- and 200-day averages, and whether those averages are rising. This can disagree with participation: the index may still look strong while many individual stocks are falling behind.</p>
          <p>Each part runs from −2 to +2. We average the four and put the result on a −100 to +100 scale. Correlation and return dispersion stay separate because stocks moving together, or moving very differently, is not automatically bullish or bearish.</p>
          <details><summary>Exact scoring rules</summary>
            <p>Participation combines two equally weighted readings: the average percentage above the 8-, 21-, 50-, 100- and 200-day averages, minus 50 and divided by 25; and the five-session change in that percentage, divided by 10.</p>
            <p>Buying vs. selling averages two readings: the ten-session exponentially smoothed percentage of rising stocks, and the twenty-session share of dollar volume in rising stocks. For each, subtract 50 and divide by 10. Unchanged stocks and volume without a classified direction are excluded from these ratios.</p>
            <p>Market damage averages two readings: the percentage within 10% of a yearly closing high, minus the percentage at least 20% below it, divided by 25; and the twenty-session average of daily new highs minus new lows, as a percentage of eligible stocks, divided by 2.</p>
            <p>Index trend gives +2 or −2 to each of four comparisons: price against its 50-day average, price against its 200-day average, and each average against its value twenty sessions earlier. Exact ties get zero. We average the four.</p>
            <p>Every underlying reading is limited to −2 through +2 before averaging. The combined score is bearish at −60 or lower; neutral-bearish above −60 through −20; neutral between −20 and +20; neutral-bullish from +20 to below +60; and bullish at +60 or higher. Labels use the unrounded score.</p>
          </details>
          <p>The History control changes the charts, not this latest-close reading. If a required input is missing, we leave the total blank rather than quietly changing the weights. Our first historical check found that stronger scores did not consistently precede better index returns; weak readings often came before rebounds. The rules and weights are unchanged. <a href="research/regime-2026-09-12/report.html">Read the component backtest</a>.</p>
          <p>Historical data uses today's tracked stocks, with removed feeds excluded, so companies that disappeared may be missing from earlier periods. Missing prices are not filled, and dividends are excluded.</p>
        </details>`;
    }catch(e){if(generation===regimeGeneration)host.innerHTML='<h2>Market regime</h2><p class="an-sub">The regime reading is unavailable because a required dataset could not be loaded. The other analytics remain available.</p>';}
  }
  async function load(){if(!pending)pending=fetch('cube/analytics.json').then(r=>{if(!r.ok)throw Error('Analytics data unavailable');return window.MarketLabReadJSON(r);}).then(d=>(data=d)).catch(e=>{pending=null;throw e;});return pending;}
  function rangeIndices(dates,range=state.history){const end=new Date(dates.at(-1)+'T00:00:00Z');if(range==='3M')end.setUTCMonth(end.getUTCMonth()-3);else end.setUTCFullYear(end.getUTCFullYear()-(range==='5Y'?5:1));const cutoff=end.toISOString().slice(0,10);return dates.map((d,i)=>d>=cutoff?i:-1).filter(i=>i>=0);}
  const node=(name,attrs={},text)=>{const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};

  function plot(host,dates,series,options={}){
    return window.MarketLabChartPanels ? MarketLabChartPanels.mount(host,dates,series,options,renderPlot) : renderPlot(host,dates,series,options);
  }
  function renderPlot(host,dates,series,options={}){
    host._measurement?.destroy();host._measurement=null;
    host.replaceChildren();const c=MarketLab.colors(),W=Math.max(280,host.clientWidth),H=options.height||280,m={l:48,r:options.right?58:14,t:16,b:30},pw=W-m.l-m.r,ph=H-m.t-m.b;
    const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':options.label,tabindex:0});host.append(svg);
    if(!dates.length){svg.append(node('text',{x:20,y:40,fill:c.muted},'No eligible observations'));return;}
    const finite=series.filter(s=>!s.right).flatMap(s=>s.values).filter(Number.isFinite);
    if(!finite.length){svg.append(node('text',{x:20,y:40,fill:c.muted},'No eligible observations'));return;}
    let lo=options.domain?.[0]??Math.min(0,...finite),hi=options.domain?.[1]??Math.max(0,...finite);if(lo===hi)hi=lo+1;if(!options.domain){const pad=(hi-lo)*.06;hi+=pad;if(lo<0)lo-=pad;}
    const secondary=series.filter(s=>s.right).flatMap(s=>s.values).filter(Number.isFinite);let rlo=secondary.length?Math.min(...secondary):0,rhi=secondary.length?Math.max(...secondary):1;if(rlo===rhi)rhi=rlo+1;const rp=(rhi-rlo)*.08;rlo-=rp;rhi+=rp;if(options.rightDomain){[rlo,rhi]=options.rightDomain;}
    const x=i=>m.l+(i+.5)*pw/dates.length,y=v=>m.t+(hi-v)/(hi-lo)*ph,ry=v=>m.t+(rhi-v)/(rhi-rlo)*ph;
    for(let j=0;j<5;j++){const v=lo+(hi-lo)*j/4;svg.append(node('line',{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:c.border}),node('text',{x:m.l-7,y:y(v)+4,'text-anchor':'end',fill:c.faint,'font-size':12},(options.format||number)(v)));if(options.right&&secondary.length){const r=rlo+(rhi-rlo)*j/4;svg.append(node('text',{x:W-m.r+7,y:ry(r)+4,fill:c.faint,'font-size':12},(options.rightFormat||short)(r)));}}
    if(lo<0&&hi>0){svg.append(node('line',{x1:m.l,x2:W-m.r,y1:y(0),y2:y(0),stroke:c.muted,'stroke-dasharray':'3 3'}));}
    const ticks=W<480?3:5;for(let j=0;j<ticks;j++){const i=Math.round((dates.length-1)*j/(ticks-1));svg.append(node('text',{x:x(i),y:H-6,'text-anchor':j===0?'start':j===ticks-1?'end':'middle',fill:c.faint,'font-size':12},dates[i].slice(0,7)));}
    let bottoms=Array(dates.length).fill(0);
    for(const s of series){const Y=s.right?ry:y;if(s.type==='bars'){s.values.forEach((v,i)=>{if(Number.isFinite(v))svg.append(node('rect',{x:x(i)-pw/dates.length*.4,y:Math.min(Y(v),Y(0)),width:Math.max(.5,pw/dates.length*.8),height:Math.max(.6,Math.abs(Y(v)-Y(0))),fill:s.colors?.[i]||s.color,'fill-opacity':s.opacity??.8,'data-series':s.key||''}));});}
      else if(s.type==='stack'){const tops=s.values.map((v,i)=>Number.isFinite(v)?bottoms[i]+v:null);let pts=[];const flush=()=>{if(!pts.length)return;const path=pts.map((i,j)=>(j?'L':'M')+x(i)+','+y(tops[i])).join('')+pts.slice().reverse().map(i=>'L'+x(i)+','+y(bottoms[i])).join('')+'Z';svg.append(node('path',{d:path,fill:s.color,'fill-opacity':.85}));pts=[];};tops.forEach((v,i)=>{if(v==null)flush();else pts.push(i);});flush();bottoms=tops.map(v=>v??0);}
      else{let d='',started=false;s.values.forEach((v,i)=>{if(!Number.isFinite(v)){started=false;return;}d+=(started?'L':'M')+x(i).toFixed(2)+','+Y(v).toFixed(2);started=true;});
        if(s.area&&!s.right){let points=[];const flush=()=>{if(points.length){svg.append(node('path',{d:points.map((i,j)=>(j?'L':'M')+x(i)+','+Y(s.values[i])).join('')+'L'+x(points.at(-1))+','+Y(0)+'L'+x(points[0])+','+Y(0)+'Z',fill:s.color,'fill-opacity':.12}));points=[];}};s.values.forEach((v,i)=>Number.isFinite(v)?points.push(i):flush());flush();}
        svg.append(node('path',{d,fill:'none',stroke:s.color,'stroke-width':s.right?1.7:2,'stroke-linejoin':'round'}));}}
    for(const ref of options.referenceLines||[]){const right=ref.axis==='right',Y=right?ry:y;if(right&&!secondary.length||ref.value<(right?rlo:lo)||ref.value>(right?rhi:hi))continue;svg.append(node('line',{x1:m.l,x2:W-m.r,y1:Y(ref.value),y2:Y(ref.value),stroke:c.muted,'stroke-dasharray':'4 4','data-reference':ref.value,'data-axis':right?'right':'left'}));if(ref.label)svg.append(node('text',{x:W-m.r-4,y:Y(ref.value)-4,'text-anchor':'end',fill:c.muted,'font-size':12},ref.label));}
    const cursor=node('line',{y1:m.t,y2:H-m.b,stroke:c.muted,'stroke-dasharray':'3 3',visibility:'hidden'});svg.append(cursor);
    let chosen=dates.length-1;
    const choose=(i)=>{chosen=Math.max(0,Math.min(dates.length-1,i));cursor.setAttribute('x1',x(chosen));cursor.setAttribute('x2',x(chosen));cursor.setAttribute('visibility','visible');options.onCursor?.(chosen);};
    svg.addEventListener('pointermove',e=>{const b=svg.getBoundingClientRect();choose(Math.floor(((e.clientX-b.left)*W/b.width-m.l)/pw*dates.length));});
    svg.addEventListener('pointerleave',()=>{cursor.setAttribute('visibility','hidden');options.onCursor?.(dates.length-1);});
    const selectPoint=e=>{const b=svg.getBoundingClientRect();choose(Math.floor(((e.clientX-b.left)*W/b.width-m.l)/pw*dates.length));const yy=(e.clientY-b.top)*H/b.height;let key=options.screen;if(options.stack){const value=hi-(yy-m.t)/ph*(hi-lo);let base=0;for(const s of series){const next=base+(s.values[chosen]||0);if(value>=base&&value<=next){key=s.key;break;}base=next;}}else if(options.negativeScreen&&yy>y(0))key=options.negativeScreen;options.onSelect?.(chosen,key);};
    let down=null,dragged=false,clickTimer;
    const brush=node('rect',{y:m.t,height:ph,fill:c.accent,'fill-opacity':.15,visibility:'hidden','pointer-events':'none'});svg.append(brush);
    const point=e=>{const b=svg.getBoundingClientRect();return Math.max(0,Math.min(dates.length-1,Math.floor(((e.clientX-b.left)*W/b.width-m.l)/pw*dates.length)));};
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;down={i:point(e),x:e.clientX,y:e.clientY};dragged=false;svg.setPointerCapture(e.pointerId);});
    svg.addEventListener('pointermove',e=>{if(!down)return;if(Math.abs(e.clientX-down.x)>8&&Math.abs(e.clientX-down.x)>Math.abs(e.clientY-down.y)){dragged=true;clearTimeout(clickTimer);const a=x(down.i),b=x(point(e));brush.setAttribute('x',Math.min(a,b));brush.setAttribute('width',Math.abs(b-a));brush.setAttribute('visibility','visible');}});
    svg.addEventListener('pointerup',e=>{if(!down)return;const a=down.i,b=point(e);down=null;brush.setAttribute('visibility','hidden');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(dragged)options.onZoom?.(Math.min(a,b),Math.max(a,b));});
    svg.addEventListener('pointercancel',()=>{down=null;dragged=false;brush.setAttribute('visibility','hidden');});
    svg.addEventListener('click',e=>{if(dragged){dragged=false;return;}clearTimeout(clickTimer);if(e.detail<2)clickTimer=setTimeout(()=>selectPoint(e),350);});
    svg.addEventListener('dblclick',e=>{clearTimeout(clickTimer);e.preventDefault();options.onExplain?.();});
    svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter')options.onSelect?.(chosen,options.screen);else choose(e.key==='Home'?0:e.key==='End'?dates.length-1:chosen+(e.key==='ArrowLeft'?-1:1));}});
    if(options.ruler&&window.MarketLabChartMeasure){
      const controls=host.closest('article').querySelector('.ml-ruler-controls');
      host._measurement=MarketLabChartMeasure.mount(svg,controls,()=>({
        W,H,px:{x0:m.l,x1:W-m.r,y0:m.t,y1:H-m.b},from:0,to:dates.length-1,dates,X:x,Y:y,
        indexAtX:v=>Math.floor((v-m.l)/pw*dates.length),
        ruler:{kind:'price',format:options.format||number,unit:options.measureUnit||'trading sessions',valueAtY:v=>hi-(v-m.t)/ph*(hi-lo)}
      }));
    }
  }
  function leaders(screen,date){location.href=`market-lab-leaders.html?analytics=${encodeURIComponent(state.universe)}&screen=${encodeURIComponent(screen)}&date=${encodeURIComponent(date)}#1D|all|best|100|0|||table|1D|0|8|div0|14`;}
  function card(parent,title,subtitle,wide=false){const el=document.createElement('article');el.className='an-card'+(wide?' an-wide':'');el.innerHTML=`<header><h3>${esc(title)}</h3><b></b></header><p class="an-sub">${esc(subtitle)}</p><div class="an-legend"></div><div class="an-plot"></div><p class="an-readout"></p>`;parent.append(el);return el;}
  function drawParticipation(group,indices){drawRegime();const parent=$('an-participation');parent.replaceChildren();const c=MarketLab.colors(),s=group.series,dates=indices.map(i=>data.dates[i]),values=key=>indices.map(i=>s[key][i]);
    const thrust=card(parent,'Breadth thrust','Advancing share · 10-session EMA');thrust.querySelector('header b').textContent=pct(s.thrust.at(-1));
    const update=(el,items,j)=>el.querySelector('.an-readout').textContent=dates[j]+' · '+items.map(([k,label,f])=>label+' '+(f||number)(s[k][indices[j]])).join(' · ');
    plot(thrust.querySelector('.an-plot'),dates,[{values:values('thrust'),color:c.accent}],{label:'Breadth thrust',domain:[0,100],format:v=>number(v,0)+'%',screen:'advancing',onCursor:j=>update(thrust,[['advances','Up'],['declines','Down'],['above50_change5','5D breadth change',v=>number(v)+' pp']],j),onSelect:(j,key)=>leaders(key,dates[j])});
    thrust.querySelector('.an-legend').innerHTML='<button data-screen="advancing">Advancers ↗</button><button data-screen="declining">Decliners ↗</button>';thrust.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>leaders(b.dataset.screen,dates.at(-1)));update(thrust,[['advances','Up'],['declines','Down'],['above50_change5','5D breadth change',v=>number(v)+' pp']],dates.length-1);
    const highs=card(parent,'New highs / new lows','Closing prices · prior 252 sessions');highs.querySelector('header b').textContent=`${number(s.highs.at(-1),0)} / ${number(s.lows.at(-1),0)}`;
    highs.querySelector('.an-legend').innerHTML=`<span style="color:${c.up}">Highs</span><span style="color:${c.down}">Lows</span>`;
    plot(highs.querySelector('.an-plot'),dates,[{values:values('highs'),color:c.up,type:'bars'},{values:values('lows').map(v=>-v),color:c.down,type:'bars'},{values:values('net_highs20'),color:c.ink,right:true}],{label:'New closing highs and lows',right:true,format:v=>number(v,0),originalOverlayLabel:'20D net highs',screen:'highs',negativeScreen:'lows',onCursor:j=>update(highs,[['highs','Highs'],['lows','Lows'],['net_highs20','20D net']],j),onSelect:(j,key)=>leaders(key,dates[j])});update(highs,[['highs','Highs'],['lows','Lows'],['highlow_eligible','Eligible']],dates.length-1);
    const dd=card(parent,'Drawdown distribution','Distance below the 52-week closing high',true),colors=[c.accent,'#7599b3','#aa9c83','#bf7880',c.down];dd.querySelector('header b').textContent=number(s.drawdown_eligible.at(-1),0)+' stocks';
    dd.querySelector('.an-legend').innerHTML=data.drawdown_labels.map((l,i)=>`<button data-screen="dd${i}"><i style="background:${colors[i]}"></i>${l}</button>`).join('');dd.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>leaders(b.dataset.screen,dates.at(-1)));
    plot(dd.querySelector('.an-plot'),dates,data.drawdown_labels.map((l,i)=>({key:'dd'+i,values:values('dd'+i),color:colors[i],type:'stack'})),{label:'Stocks by drawdown band',domain:[0,100],format:v=>number(v,0)+'%',stack:true,screen:'dd0',onCursor:j=>update(dd,data.drawdown_labels.map((l,i)=>['dd'+i,l,pct]),j),onSelect:(j,key)=>leaders(key,dates[j])});update(dd,data.drawdown_labels.map((l,i)=>['dd'+i,l,pct]),dates.length-1);
  }
  function draw(){if(!$('analytics-page')||!data)return;const group=data.universes.find(g=>g.id===state.universe)||data.universes[0],indices=rangeIndices(data.dates);$('an-asof').textContent='updated '+data.as_of;$('an-status').textContent='';drawParticipation(group,indices);drawVolume(group);drawStructure(group,indices);drawLeadership();$('an-method').innerHTML=`<p>${esc(data.methodology)}</p><p>Breadth thrust: 10-session exponential average of advances / (advances + declines). Flat closes are excluded from that ratio. Moving-average breadth requires 50 consecutive closes. Highs/lows compare with the previous 252 sessions, excluding today. Drawdown bands require 252 consecutive closes including today. Clicking a chart selects the names on that date; Leaders shows their latest returns.</p><p>${esc(data.volume_methodology||'')}</p><p>Dispersion: sample standard deviation of 21-session stock returns. Correlation: equal-weight average of all pairs with 63 complete, non-constant daily returns. Percentiles use the preceding 252 readings including the current reading (minimum 60). Theme participation uses current holdings and local currencies, not a point-in-time portfolio or USD return. The 5-session change compares only members eligible at both endpoints.</p>`;}
  async function start(){
    if(!$('analytics-page'))return;
    const params=new URLSearchParams(location.hash.slice(1)),sections=['participation','activity','structure','leadership'];
    if(params.get('section')==='trends'||location.hash==='#trends'){
      const asset=params.get('asset')||'spy';
      location.replace('market-lab-themes.html?profile=1#'+[encodeURIComponent(asset),'cum','lin',params.get('from')||'',params.get('to')||''].join('|'));return;
    }
    if(['sp500','nasdaq','total'].includes(params.get('universe')))state.universe=params.get('universe');
    if(['3M','1Y','5Y'].includes(params.get('history')))state.history=params.get('history');
    let section=params.get('section')||location.hash.slice(1);
    const save=()=>{const p=new URLSearchParams(location.hash.slice(1));p.set('universe',state.universe);p.set('history',state.history);if(sections.includes(section))p.set('section',section);history.replaceState(null,'','#'+p);};
    $('an-universe').value=state.universe;$('an-history').value=state.history;
    for(const [id,key]of [['an-universe','universe'],['an-history','history']])$(id).onchange=e=>{state[key]=e.target.value;save();draw();};
    document.querySelectorAll('[aria-label="Analytics sections"] a').forEach(a=>a.onclick=e=>{e.preventDefault();section=a.hash.slice(1);save();$(section)?.scrollIntoView({behavior:'smooth',block:'start'});});
    try{await load();draw();if(sections.includes(section))requestAnimationFrame(()=>$(section)?.scrollIntoView({block:'start'}));}catch(e){$('an-status').textContent=e.message;}
  }
  function aggregateVolume(dates,s,frequency){
    const groups=new Map(),keys=['shares','dollars',...['shares','dollars'].flatMap(u=>['up','down','flat','unclassified'].map(p=>u+'_'+p))];
    dates.forEach((date,i)=>{let key=date;if(frequency==='monthly')key=date.slice(0,7);if(frequency==='weekly'){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));key=d.toISOString().slice(0,10);}let g=groups.get(key);if(!g){g={date,start:date,sessions:0,eligible:Infinity,price:null,totals:{},valid:{}};groups.set(key,g);}g.date=date;g.sessions++;g.eligible=Math.min(g.eligible,s.volume_eligible[i]||0);if(Number.isFinite(s.price[i]))g.price=s.price[i];keys.forEach(k=>{if(Number.isFinite(s[k]?.[i])){g.totals[k]=(g.totals[k]||0)+s[k][i];g.valid[k]=(g.valid[k]||0)+1;}});});
    const out=[...groups.values()].map(g=>({...g,...Object.fromEntries(keys.map(k=>[k,g.valid[k]===g.sessions?g.totals[k]:null]))}));
    out.forEach((g,i)=>{for(const unit of ['shares','dollars']){const prior=out.slice(i-19,i+1).map(r=>r[unit]);g[unit+'_ma20']=prior.length===20&&prior.every(Number.isFinite)?prior.reduce((a,b)=>a+b,0)/20:null;const direction=g[unit+'_up']+g[unit+'_down'];g[unit+'_up_share']=direction>0?100*g[unit+'_up']/direction:null;}});return out;
  }
  const volumeState={frequency:'daily',units:'dollars',history:'1Y'};
  function volumeControls(host,landing=false){host.innerHTML=`<label>Period <select data-volume="frequency" aria-label="Volume period"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Volume <select data-volume="units" aria-label="Volume units"><option value="dollars">$ traded</option><option value="shares">Shares</option></select></label>${landing?'<label>History <select data-volume="history" aria-label="Volume history"><option value="3M">3 months</option><option value="1Y">1 year</option><option value="5Y">5 years</option></select></label><a href="market-lab-analytics.html#activity">More analytics →</a>':''}`;host.querySelectorAll('select').forEach(select=>{select.value=volumeState[select.dataset.volume];select.onchange=()=>{volumeState[select.dataset.volume]=select.value;if(landing)drawLandingVolume();else draw();};});}
  function volumeCard(parent,group,landing){
    const s=group.series,rows=aggregateVolume(data.dates,s,volumeState.frequency),indices=rangeIndices(rows.map(r=>r.date),landing?volumeState.history:state.history),shown=indices.map(i=>rows[i]),dates=shown.map(r=>r.date),unit=volumeState.units,c=MarketLab.colors(),latest=shown.at(-1),fmt=v=>(unit==='dollars'?'$':'')+short(v);
    const el=card(parent,landing?group.benchmark:'Aggregate volume','Available constituent '+(unit==='dollars'?'dollar turnover':'share volume'));el.querySelector('header b').textContent=fmt(latest[unit]);const interval={daily:'day',weekly:'week',monthly:'month'}[volumeState.frequency];
    el.querySelector('.an-legend').innerHTML=`<span style="color:${c.accent}">■ Volume · left</span><span style="color:${c.muted}">20-${interval} average</span>`;
    const read=j=>{const r=shown[j];el.querySelector('.an-readout').textContent=`${r.date} · ${fmt(r[unit])} · index ${number(r.price,2)} · ${r.eligible}/${group.members} eligible${volumeState.frequency!=='daily'?' · '+r.sessions+' sessions':''}${j===shown.length-1&&volumeState.frequency!=='daily'?' · to date':''}`;};
    plot(el.querySelector('.an-plot'),dates,[{key:'volume',type:'bars',values:shown.map(r=>r[unit]),color:c.accent},{values:shown.map(r=>r[unit+'_ma20']),color:c.muted},{values:shown.map(r=>r.price),color:c.ink,right:true}],{label:group.benchmark+' constituent volume and index price',defaultOverlay:group.id,right:true,format:short,height:280,onCursor:read});read(shown.length-1);
    return {shown,dates};
  }
  function drawVolume(group){if(!group.series.shares)return;$('activity').hidden=false;const host=$('an-volume');host.innerHTML='<div class="an-volume-controls"></div><div class="an-volume-grid"></div>';volumeControls(host.firstElementChild);const parent=host.lastElementChild,{shown,dates}=volumeCard(parent,group,false),c=MarketLab.colors(),unit=volumeState.units;
    const el=card(parent,'Advancing / declining volume','Share of directional '+(unit==='dollars'?'dollar turnover':'share volume'));el.querySelector('header b').textContent=pct(shown.at(-1)[unit+'_up_share']);el.querySelector('.an-legend').innerHTML=`<span style="color:${c.up}">Advancing share</span><span>Flat and unclassified activity excluded from ratio</span>`;
    const read=j=>{const r=shown[j];el.querySelector('.an-readout').textContent=`${r.date} · up ${short(r[unit+'_up'])} · down ${short(r[unit+'_down'])} · flat ${short(r[unit+'_flat'])} · unclassified ${short(r[unit+'_unclassified'])}`;};plot(el.querySelector('.an-plot'),dates,[{values:shown.map(r=>r[unit+'_up_share']),color:c.up}],{label:'Advancing share of directional volume',domain:[0,100],format:v=>number(v,0)+'%',onCursor:read});read(shown.length-1);
  }
  function drawLandingVolume(){const panel=$('volume-panel');if(!panel||panel.hidden||!data)return;panel.innerHTML='<h2>Market volume</h2><div class="an-volume-controls"></div><div class="an-volume-grid"></div>';volumeControls(panel.querySelector('.an-volume-controls'),true);data.universes.forEach(g=>volumeCard(panel.querySelector('.an-volume-grid'),g,true));}
  async function showVolume(visible){const panel=$('volume-panel');if(!panel)return;panel.hidden=!visible;if(!visible)return;try{await load();if(data.universes.every(g=>g.series.shares))drawLandingVolume();else panel.textContent='Volume data unavailable.';}catch(e){panel.textContent=e.message;}}
  function drawStructure(group,indices){if(!group.series.correlation)return;$('structure').hidden=false;const host=$('an-structure');host.replaceChildren();const c=MarketLab.colors(),s=group.series,dates=indices.map(i=>data.dates[i]);
    for(const [key,title,unit,subtitle,color] of [['dispersion','Return dispersion',' pp','Cross-sectional standard deviation · 21-session returns',c.accent],['correlation','Stock correlation','','Average pairwise correlation · 63 sessions',c.up]]){
      const el=card(host,title,subtitle),latest=s[key].at(-1);el.querySelector('header b').textContent=number(latest,key==='correlation'?2:1)+(latest==null?'':unit);
      const read=j=>{const i=indices[j];el.querySelector('.an-readout').textContent=`${dates[j]} · ${number(s[key][i],2)}${unit} · percentile ${number(s[key+'_percentile'][i],0)} · ${number(s[key+'_eligible'][i],0)} stocks`;};
      plot(el.querySelector('.an-plot'),dates,[{values:indices.map(i=>s[key][i]),color}],{label:title,format:v=>number(v,key==='correlation'?2:0),onCursor:read});read(dates.length-1);
    }
  }
  let membersData=null,membersPending=null;
  async function loadMembers(){if(!membersPending)membersPending=fetch('cube/analytics-members.json').then(r=>{if(!r.ok)throw Error('Participation data unavailable');return window.MarketLabReadJSON(r);}).then(d=>{membersData=d;d.lookup={};for(const [stem,s]of Object.entries(d.stocks)){d.lookup[stem.toLowerCase()]=s;d.lookup[s.id.toLowerCase()]=s;}return d;}).catch(e=>{membersPending=null;throw e;});return membersPending;}
  function groupSummary(members,catalog){const unique=[...new Set(members)],seen=new Set(),records=[],identities=new Set();for(const id of unique){const s=catalog.lookup[String(id).toLowerCase()];identities.add(s?s.stem:String(id).toLowerCase());if(s&&!seen.has(s.stem)){records.push(s);seen.add(s.stem);}}
    const live=records.filter(s=>s.fresh),returns=live.filter(s=>Number.isFinite(s.r['1M'])),current=live.filter(s=>s.above50!=null),paired=current.filter(s=>s.above50_5!=null);
    return {total:identities.size,eligible:current.length,returnEligible:returns.length,paired:paired.length,
      return:returns.length?returns.reduce((a,s)=>a+s.r['1M'],0)/returns.length:null,
      above:current.length?100*current.filter(s=>s.above50).length/current.length:null,
      change:paired.length?100*paired.reduce((a,s)=>a+Number(s.above50)-Number(s.above50_5),0)/paired.length:null};
  }
  let leadershipMode='themes',leadershipGeneration=0;
  async function drawLeadership(){if(!$('an-leadership'))return;$('leadership').hidden=false;const generation=++leadershipGeneration,host=$('an-leadership');try{const catalog=await loadMembers();if(generation!==leadershipGeneration)return;
      const groups=leadershipMode==='baskets'?(MarketLabCloud.state.available?MarketLabCloud.state.baskets:[]):catalog.themes;
      const rows=groups.map(g=>({...g,stats:groupSummary(g.members,catalog)})).sort((a,b)=>(b.stats.above??-1)-(a.stats.above??-1));
      host.innerHTML=`<div class="an-volume-controls"><label>Groups <select id="an-group-mode"><option value="themes">Themes</option><option value="baskets">My baskets</option></select></label><span class="an-sub">Latest · all holdings · local currencies</span></div><div class="an-card an-tablewrap"><table class="an-table"><thead><tr><th>Name</th><th>21-session return</th><th>Above 50D</th><th>5-session change</th><th>Eligible</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><button data-group="${i}">${esc(r.label||r.name)} ↗</button></td><td style="color:${Number.isFinite(r.stats.return)?r.stats.return>=0?'var(--ml-up)':'var(--ml-down)':'var(--ml-muted)'}">${pct(r.stats.return)}</td><td><span class="an-partbar"><i style="width:${r.stats.above||0}%"></i></span>${pct(r.stats.above)}</td><td>${number(r.stats.change)} pp</td><td>${r.stats.eligible}/${r.stats.total}</td></tr>`).join('')}</tbody></table>${!rows.length?`<p class="an-empty">${leadershipMode==='baskets'&&!MarketLabCloud.state.available?'Sign in to load your cloud baskets.':'No groups yet.'}</p>`:''}</div>`;
      $('an-group-mode').value=leadershipMode;$('an-group-mode').onchange=e=>{leadershipMode=e.target.value;drawLeadership();};host.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const g=rows[+b.dataset.group],id=leadershipMode==='baskets'?'saved:'+g.id:g.id;location.href='market-lab-themes.html#baskets:month:heatmap:1y:'+encodeURIComponent(id);});
    }catch(e){if(generation===leadershipGeneration)host.textContent=e.message;}
  }
  async function basketParticipation(host,members){if(!host)return;const key=JSON.stringify(members);host.dataset.members=key;host.hidden=!members?.length;if(host.hidden)return;try{const catalog=await loadMembers();if(host.dataset.members!==key)return;const s=groupSummary(members,catalog);host.textContent=`${pct(s.above)} above 50D · ${number(s.change)} pp over 5 sessions · ${s.eligible}/${s.total} eligible`; }catch(e){host.textContent='Participation unavailable';}}
  window.MarketLabAnalytics={load,plot,rangeIndices,number,short,aggregateVolume,showVolume,loadMembers,groupSummary,basketParticipation};
  window.addEventListener('ml:cloudchange',()=>{if(leadershipMode==='baskets')drawLeadership();});
  window.addEventListener('ml:themechange',()=>{draw();drawLandingVolume();});let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{draw();drawLandingVolume();},150);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
