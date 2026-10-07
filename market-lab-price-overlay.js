/* Daily indicator over the comparison chart, without changing the price scale. */
(()=>{
  const NS='http://www.w3.org/2000/svg';
  const node=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
  function mount(toolbar,svg){
    const select=document.createElement('select');select.className='ml-overlay-select';select.setAttribute('aria-label','Stock chart overlay');
    const readout=document.createElement('span');readout.className='ml-chart-overlay-readout';readout.setAttribute('role','status');
    toolbar.append(select);svg.closest('.chartwrap').after(readout);
    const historyPanel=document.createElement('div');historyPanel.className='ml-overlay-history';historyPanel.hidden=true;readout.after(historyPanel);
    let selected='',context=null,ticket=0,values=new Map(),loadedId='',message='';
    let requestedOverlay=new URLSearchParams(location.search).get('overlay')==='overextension';
    const resetDrawing=()=>{svg.querySelector('[data-price-overextension]')?.remove();values.clear();loadedId='';};
    function clear(){ticket++;resetDrawing();toolbar.hidden=true;readout.textContent='';historyPanel.hidden=true;historyPanel.replaceChildren();}
    function cursor(date){
      if(!selected||!loadedId)return;
      const v=values.get(date);
      readout.textContent=message||(loadedId+' · daily score · right axis · '+date+' · '+(Number.isFinite(v)?(v>0?'+':'')+v.toFixed(1):'unavailable'));
    }
    async function paint(){
      const token=++ticket,c=context;resetDrawing();message='';readout.textContent='';
      historyPanel.hidden=true;historyPanel.replaceChildren();
      if(!selected||!c)return;
      readout.textContent='Loading overextension…';
      try{
        const h=await MarketLabOverextension.history(selected,c.updated);
        if(token!==ticket||!svg.isConnected)return;
        historyPanel.innerHTML=MarketLabOverextension.historicalContext(h);historyPanel.hidden=false;
        const dates=c.dates.slice(c.from,c.to+1),scores=MarketLabOverextension.align(h,dates),g=c.geom,px=g.px;
        loadedId=h.id;values=new Map(dates.map((d,i)=>[d,scores[i]]));
        if(!scores.some(Number.isFinite))message='No overextension readings in this range. Available history: '+h.dates[0]+' → '+h.dates.at(-1)+'.';
        else{
          const layer=node('g',{'data-price-overextension':h.id,'pointer-events':'none'}),colors=MarketLab.colors();
          const y=v=>px.y1-(v+105)/210*(px.y1-px.y0),width=Math.max(.4,(px.x1-px.x0)/Math.max(1,dates.length)*.75);
          scores.forEach((v,i)=>{if(!Number.isFinite(v))return;const x=g.X(c.from+i);layer.append(node('rect',{x:Math.max(px.x0,x-width/2),y:Math.min(y(v),y(0)),width:Math.min(width,px.x1-Math.max(px.x0,x-width/2)),height:Math.max(.5,Math.abs(y(v)-y(0))),fill:MarketLabOverextension.barColor(v),'fill-opacity':.3,'data-score':v,'data-date':dates[i]}));});
          for(const v of [-97,-50,0,50,99]){
            const yy=y(v);if(v===-97||v===0||v===99)layer.append(node('line',{x1:px.x0,x2:px.x1,y1:yy,y2:yy,stroke:colors.muted,'stroke-dasharray':'4 4','stroke-opacity':.6}));
            layer.append(node('text',{x:px.x1-5,y:yy-4,'text-anchor':'end',fill:colors.muted,'font-size':12,'paint-order':'stroke',stroke:colors.surface,'stroke-width':3},(v>0?'+':'')+v));
          }
          svg.insertBefore(layer,svg.firstChild);
        }
        cursor(dates.at(-1));
      }catch(e){if(token===ticket){message=e.message;readout.textContent=message;}}
    }
    function sync(c){
      context=c;const unique=[...new Map(c.items.map(item=>[item.id,item])).values()];
      if(selected&&!unique.some(item=>item.id===selected))selected='';
      if(requestedOverlay&&unique.length){selected=unique[0].id;requestedOverlay=false;}
      select.replaceChildren(new Option('Overlay',''),...unique.map(item=>new Option('Overextension · '+item.label,item.id)));
      select.value=selected;updateControl();toolbar.hidden=!unique.length;paint();
    }
    const updateControl=()=>{select.dataset.active=String(!!selected);select.title=selected?'Overlay: '+select.selectedOptions[0].textContent:'Overlay: none';};
    select.onchange=()=>{selected=select.value;updateControl();paint();};
    return {sync,clear,cursor};
  }
  window.MarketLabPriceOverlay={mount};
})();
