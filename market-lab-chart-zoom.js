/* Ruler measurements use the primary axis, independently of any right-axis overlay. */
(()=>{
  const NS='http://www.w3.org/2000/svg';let active=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const number=v=>v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const signed=v=>(v>0?'+':'')+number(v);
  const node=(name,attrs={},text)=>{const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
  function calculate(a,b,kind='price'){
    const delta=b-a,percent=a>0?(b/a-1)*100:null;
    if(!Number.isFinite(a)||!Number.isFinite(b))return {delta:null,percent:null,text:'Unavailable'};
    if(kind==='points')return {delta:delta*100,percent:null,text:signed(delta*100)+' pp'};
    if(kind==='level')return {delta,percent:null,text:signed(delta)};
    const text=(percent==null?'% unavailable':signed(percent)+'%')+(kind==='price'?' · '+signed(delta):kind==='relative'?' relative':'');
    return {delta,percent,text};
  }
  function controls(){
    const group=document.createElement('span');group.className='ml-ruler-controls';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='ml-ruler-toggle';toggle.dataset.measureToggle='';
    toggle.setAttribute('aria-label','Measure change');toggle.setAttribute('aria-pressed','false');toggle.title='Measure change · click the start, then the end. Shift + click starts a measurement. Esc clears.';
    const icon=node('svg',{viewBox:'0 0 24 24',width:18,height:18,'aria-hidden':'true',fill:'none',stroke:'currentColor','stroke-width':1.5});
    icon.append(node('path',{d:'M3 16 16 3l5 5L8 21Zm9-9 2 2m-5 1 2 2m-5 1 2 2'}));toggle.append(icon);
    const clear=document.createElement('button');clear.type='button';clear.className='ml-ruler-clear';clear.textContent='×';clear.hidden=true;clear.setAttribute('aria-label','Clear measurement');clear.title='Clear measurement (Esc)';
    group.append(toggle,clear);return group;
  }
  function mount(svg,group,getContext){
    const toggle=group.querySelector('[data-measure-toggle]'),clearButton=group.querySelector('.ml-ruler-clear'),events=new AbortController();
    const status=document.createElement('span');status.className='ml-ruler-status';status.setAttribute('role','status');group.append(status);
    let enabled=false,down=null,pending=null,result=null,layer=null,suppressUntil=0;
    const context=()=>{const c=getContext();return c?.ruler&&c.to>c.from?c:null;};
    const point=(e,c)=>{const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)*c.W/r.width,y:(e.clientY-r.top)*c.H/r.height};};
    const endpoint=(p,c)=>{
      const i=c.indexAtX?c.indexAtX(p.x):Math.round(c.from+clamp((p.x-c.px.x0)/(c.px.x1-c.px.x0),0,1)*(c.to-c.from));
      return {i:clamp(i,c.from,c.to),v:c.ruler.valueAtY(clamp(p.y,c.px.y0,c.px.y1))};
    };
    const release=()=>{const id=down?.id;down=null;if(id!=null&&svg.hasPointerCapture(id))svg.releasePointerCapture(id);};
    function clear(){release();pending=null;result=null;layer?.remove();layer=null;enabled=false;status.textContent='';syncButtons();if(active===api)active=null;}
    function syncButtons(){toggle.disabled=!context();toggle.setAttribute('aria-pressed',String(enabled));clearButton.hidden=!result&&!enabled;svg.dataset.measuring=String(enabled);}
    function draw(c,a,b){
      layer?.remove();layer=node('g',{'data-chart-measurement':'','pointer-events':'none'});
      const values=calculate(a.v,b.v,c.ruler.kind),sessions=Math.abs(b.i-a.i),color=b.v>=a.v?'var(--ml-accent)':'var(--ml-down)';
      const x1=c.X(a.i),x2=c.X(b.i),y1=c.Y(a.v),y2=c.Y(b.v),left=Math.min(x1,x2),top=Math.min(y1,y2),width=Math.abs(x2-x1),height=Math.abs(y2-y1);
      layer.dataset.start=c.dates[a.i];layer.dataset.end=c.dates[b.i];layer.dataset.fromValue=a.v;layer.dataset.toValue=b.v;layer.dataset.sessions=sessions;layer.dataset.percent=values.percent??'';
      layer.append(node('rect',{x:left,y:top,width:Math.max(1,width),height:Math.max(1,height),fill:color,'fill-opacity':.12,stroke:color,'stroke-opacity':.5}),
        node('path',{d:`M${x1},${y1}H${x2}V${y2}`,fill:'none',stroke:color,'stroke-width':1.5}),
        node('circle',{cx:x1,cy:y1,r:3,fill:color}),node('circle',{cx:x2,cy:y2,r:3,fill:color}));
      const fmt=c.ruler.format||number,lines=[values.text,`${sessions} ${c.ruler.unit||'trading sessions'} · ${fmt(a.v)} → ${fmt(b.v)}`,`${c.dates[a.i]} → ${c.dates[b.i]}`];
      const boxWidth=Math.min(c.W-8,Math.max(225,...lines.map(s=>s.length*6.5+20))),boxHeight=67;
      const lx=clamp((x1+x2-boxWidth)/2,4,c.W-boxWidth-4),below=Math.max(y1,y2)+10,ly=below+boxHeight<=c.H-4?below:clamp(top-boxHeight-10,4,c.H-boxHeight-4);
      layer.append(node('rect',{x:lx,y:ly,width:boxWidth,height:boxHeight,rx:4,fill:'var(--ml-surface)',stroke:color}));
      lines.forEach((line,i)=>layer.append(node('text',{x:lx+boxWidth/2,y:ly+20+i*18,'text-anchor':'middle',fill:i?'var(--ml-muted)':color,'font-size':i?12:14,'font-family':'var(--sans)','font-weight':i?400:600},line)));
      svg.append(layer);return lines.join('. ');
    }
    const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const listen=(target,type,fn)=>target.addEventListener(type,fn,{capture:true,signal:events.signal});
    listen(toggle,'click',()=>{if(enabled)clear();else{enabled=true;active=api;status.textContent='Click the start, then the end. Escape clears.';syncButtons();}});
    listen(clearButton,'click',clear);
    listen(svg,'pointerdown',e=>{
      if(e.button!==0||e.isPrimary===false||!(enabled||e.shiftKey))return;
      const c=context();if(!c)return;const p=point(e,c);
      if(p.x<c.px.x0||p.x>c.px.x1||p.y<c.px.y0||p.y>c.px.y1)return;
      consume(e);release();active=api;enabled=true;
      down={id:e.pointerId,c,x:e.clientX,y:e.clientY,moved:false};svg.setPointerCapture(e.pointerId);syncButtons();
    });
    listen(svg,'pointermove',e=>{
      if(!enabled)return;
      consume(e);
      if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>=4)down.moved=true;
      if(pending)draw(pending.c,pending.a,endpoint(point(e,pending.c),pending.c));
    });
    listen(svg,'pointerup',e=>{
      if(!down||e.pointerId!==down.id)return;consume(e);
      const d=down,b=endpoint(point(e,d.c),d.c);release();suppressUntil=performance.now()+500;
      if(!d.moved){
        if(pending){result={a:pending.a,b};status.textContent=draw(d.c,pending.a,b);pending=null;}
        else{result=null;pending={c:d.c,a:b};draw(d.c,b,b);status.textContent='Start selected. Click the end to finish. Escape cancels.';}
      }
      syncButtons();
    });
    listen(svg,'pointercancel',()=>{if(down)clear();});
    listen(svg,'lostpointercapture',()=>{if(down)clear();});
    for(const type of ['click','dblclick'])listen(svg,type,e=>{if(enabled||performance.now()<suppressUntil)consume(e);});
    const api={clear,sync:()=>{clear();syncButtons();},destroy:()=>{clear();events.abort();status.remove();},connected:()=>svg.isConnected};
    syncButtons();return api;
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active?.connected()){e.preventDefault();e.stopImmediatePropagation();active.clear();}},true);
  window.addEventListener('blur',()=>active?.clear());
  window.MarketLabChartMeasure={controls,mount,calculate};
})();

/* Horizontal period selection for the main stock/comparison chart. */
(()=>{
  function mount(svg,reset,{getContext,onZoom,onReset}){
    const rulerControls=MarketLabChartMeasure.controls();rulerControls.id='stock-chart-measure';reset.before(rulerControls);
    const ruler=MarketLabChartMeasure.mount(svg,rulerControls,getContext);
    let down=null,brush=null,origin=null,applied=null,suppressClickUntil=0;
    const point=(e,c)=>{
      const r=svg.getBoundingClientRect();
      return {x:(e.clientX-r.left)*c.W/r.width,y:(e.clientY-r.top)*c.H/r.height};
    };
    const index=(x,c)=>Math.round(c.from+Math.max(0,Math.min(1,(x-c.px.x0)/(c.px.x1-c.px.x0)))*(c.to-c.from));
    function cancel(){
      const id=down?.id;down=null;brush?.remove();brush=null;
      if(id!=null&&svg.hasPointerCapture(id))svg.releasePointerCapture(id);
    }
    function sync(){
      cancel();
      ruler.sync();
      const c=getContext();
      if(origin&&(!c||c.from!==applied.from||c.to!==applied.to)){origin=null;applied=null;}
      reset.hidden=!origin;
      if(c){svg.dataset.start=c.dates[c.from];svg.dataset.end=c.dates[c.to];}
      else{delete svg.dataset.start;delete svg.dataset.end;}
    }
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.isPrimary===false||down)return;
      const c=getContext();if(!c||c.to-c.from<2)return;
      const p=point(e,c);
      if(p.x<c.px.x0||p.x>c.px.x1||p.y<c.px.y0||p.y>c.px.y1)return;
      suppressClickUntil=0;
      down={id:e.pointerId,c,start:index(p.x,c),x:e.clientX,y:e.clientY,dragged:false};
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove',e=>{
      if(!down||e.pointerId!==down.id)return;
      const dx=Math.abs(e.clientX-down.x),dy=Math.abs(e.clientY-down.y);
      if(!down.dragged&&(dx<8||dx<=dy))return;
      down.dragged=true;
      const c=down.c,end=index(point(e,c).x,c),a=c.X(down.start),b=c.X(end);
      if(!brush){
        brush=document.createElementNS('http://www.w3.org/2000/svg','rect');
        for(const [k,v] of Object.entries({'data-stock-zoom-brush':'',y:c.px.y0,height:c.px.y1-c.px.y0,fill:'var(--ml-accent)','fill-opacity':.15,'pointer-events':'none'}))brush.setAttribute(k,v);
        svg.append(brush);
      }
      brush.setAttribute('x',Math.min(a,b));brush.setAttribute('width',Math.abs(b-a));
    });
    svg.addEventListener('pointerup',e=>{
      if(!down||e.pointerId!==down.id)return;
      const d=down,end=index(point(e,d.c).x,d.c),from=Math.min(d.start,end),to=Math.max(d.start,end);
      cancel();
      if(!d.dragged)return;
      suppressClickUntil=performance.now()+400;
      if(to-from<2||(from===d.c.from&&to===d.c.to))return;
      origin=origin||d.c.snapshot;applied={from,to};reset.hidden=false;
      onZoom(from,to);
    });
    svg.addEventListener('pointercancel',cancel);
    svg.addEventListener('lostpointercapture',cancel);
    svg.addEventListener('click',e=>{if(e.detail&&performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&down){cancel();e.preventDefault();}});
    window.addEventListener('blur',cancel);
    reset.onclick=()=>{if(!origin)return;const saved=origin;cancel();origin=null;applied=null;reset.hidden=true;onReset(saved);};
    return {sync};
  }
  window.MarketLabChartZoom={mount};
})();
