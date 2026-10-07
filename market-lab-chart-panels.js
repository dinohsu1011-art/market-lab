/* Shared exploration controls; chart data and numerical axes remain in the renderer. */
(() => {
  const settings = new Map(), livePanels = new Map();
  let overlayPromise, dialog, active;
  const choices = [['none','None'],['sp500','S&P 500'],['nasdaq','Nasdaq'],['smh','SMH'],['igv','IGV'],['gld','GLD'],['slv','SLV']];
  const explainers = {
    'Breadth thrust': ['Are more stocks joining the rise?', 'This line tracks the share of stocks that closed higher, smoothed over roughly two trading weeks so one noisy day matters less. Stocks that finished unchanged are left out.', 'Above 50% means rising stocks have generally outnumbered falling ones. A rising line shows more stocks joining in; a falling line shows fewer. It helps you judge how broad a market move is, but cannot tell you what happens next.'],
    'New closing highs and lows': ['Are more stocks breaking higher or lower?', 'Green bars count stocks finishing at a new one-year closing high. Red bars count those finishing at a new one-year closing low. The line adds up highs minus lows over the last 20 trading days.', 'More highs than lows suggests strength is spreading. More lows suggests weakness is spreading. We need about a year of price history to count a stock. These charts use today’s stock lists, so past readings do not recreate the exact market membership at the time.'],
    'Stocks by drawdown band': ['How far have stocks fallen from their highs?', 'Each color shows the share of stocks within a certain distance of their highest closing price over the past year. For example, the 20–40% band contains stocks that have fallen between 20% and 40%. Together, the bands add up to 100%.', 'If the deeper bands grow, more stocks are struggling—even when a few large names keep the index looking strong. Click a band to see the stocks in it.'],
    'Advancing share of directional volume': ['Is more trading happening in rising or falling stocks?', 'This shows how much of the day’s trading happened in stocks that closed higher, compared with stocks that closed lower. Above 50% means rising stocks accounted for more of that activity. Unchanged stocks are left out.', 'You can measure activity in shares or dollars traded. Dollars traded are estimated from closing price times share volume. This is not money flowing into or out of the market: every trade has both a buyer and a seller.'],
    'Return dispersion': ['How wide is the gap between stocks?', 'This compares each stock’s return over roughly the past month. A higher line means returns are more spread out: some stocks may be doing very well while others lag badly. A lower line means their results are more similar.', 'A wide gap is not automatically bad for the market. It can mean investors are moving from one group to another. The percentile tells you how unusual today’s gap is compared with roughly the past year; 90 means it is higher than about 90% of those readings.'],
    'Stock correlation': ['Are stocks moving together?', 'This looks at daily price moves over roughly the past three months. A reading near 1 means stocks have tended to rise and fall together. Near 0 means their moves have had little relationship. Below 0 means they have tended to move in opposite directions.', 'Stocks can move together in a broad rally or a broad selloff, so a high reading is not automatically bearish. It does mean that owning many different names may offer less protection if they all start falling together.']
  };
  function explanation(label) {
    if(label==='Overextension')return ['How far has price stretched?','This is your Overextension Universal indicator. It compares distance from the 20-, 50- and 200-day averages and Bollinger bands with the stock’s own recent history. Bars above zero mean price is above its 200-day average; bars below zero mean it is below.','The outer lines mark your +99 and −97 thresholds. A large reading is unusual, but a strong trend can stay stretched. The score is not a percentage chance of a reversal. The faint −50 and −80 lines are reference levels from your script, not additional signals.'];
    if(label==='Price & moving averages')return ['How is price moving around its averages?','The short averages follow recent moves; the long averages show the wider direction. The same published values appear in the Technical table and power the momentum scan.','Drag across dates to zoom, or add a price overlay on the separate right axis. Weekly and monthly views omit the current period, so an unfinished bar cannot become a confirmed reading.'];
    if(label==='Trend profile')return ['Is the price trending or moving sideways?','The shorter moving averages show the recent direction; the longer ones show the bigger picture. Consolidation means the price has settled into a fixed range. One close outside the range can be a false start; two consecutive closes on the same side confirm that the range has broken.','The strip below follows the dates shown in the chart. Drag to zoom; the price scale adjusts with it. The table uses the From and Through dates above. Market-adjusted removes the fitted benchmark move using the beta known the previous day.'];
    if (label.includes('breadth on left')) return ['How many stocks are above their average price?', 'For each stock, we compare its latest close with its average closing price over the number of trading days you selected. A reading of 70% means seven out of ten stocks are above that average. A small stock counts just as much as a large one.', 'If the index rises while this percentage falls, fewer stocks are supporting the rally. Read the percentage on the left and the comparison price on the right. Stocks without enough price history are left out.'];
    if (label.includes('constituent volume')) return ['How busy is the market?', 'The bars add up trading in the stocks in the selected index. Choose the number of shares or the estimated dollars traded, then daily, weekly or monthly totals. The average line helps you see whether activity is unusually high or low.', 'High activity can accompany a rally or a selloff—check the price line for direction. These totals are not money flowing into the market. A week or month still in progress only includes trading so far, and older totals may cover fewer stocks.'];
    return explainers[label] || ['About this chart', 'The chart shows the selected historical series. Drag horizontally to inspect a shorter period. Price overlays use a separate right-hand scale.'];
  }
  function overlays() {
    if (!overlayPromise) overlayPromise = fetch('cube/analytics-overlays.json').then(r => { if (!r.ok) throw Error('Overlay prices unavailable'); return r.json(); }).catch(e => { overlayPromise=null; throw e; });
    return overlayPromise;
  }
  function mount(host, dates, series, options, renderer) {
    const card=host.closest('article'), key=options.panelKey || location.pathname+':'+options.label;
    if (!card) return renderer(host,dates,series,options);
    let s=settings.get(key);
    if (!s) {s={overlay:options.defaultOverlay || (series.some(x=>x.right)?'original':'none'),zoom:null,flipped:false};settings.set(key,s);}
    const signature=dates[0]+':'+dates.at(-1);
    if(s.signature!==signature){s.zoom=null;s.signature=signature;}
    const ctrl={host,card,dates,series,options,renderer,state:s,key};
    livePanels.set(key,ctrl);
    host._panel=ctrl;
    decorate(ctrl,card,host,false);
    render(ctrl,card,host,false);
  }
  function decorate(ctrl,card,host,expanded) {
    const heading=card.querySelector('header');
    const tools=document.createElement('div');tools.className='ml-chart-actions';
    const info=document.createElement('button');info.type='button';info.textContent='ⓘ';info.dataset.chartInfo='';info.setAttribute('aria-label','Explain '+ctrl.options.label);
    info.onclick=()=>{ctrl.state.flipped=!ctrl.state.flipped;refresh(ctrl);};
    const expand=document.createElement('button');expand.type='button';expand.textContent=expanded?'×':'⛶';expand.setAttribute('aria-label',expanded?'Close expanded chart':'Expand '+ctrl.options.label);
    expand.onclick=()=>expanded?dialog.close():open(ctrl);
    tools.append(info,expand);heading.append(tools);
    if(window.MarketLabChartMeasure&&ctrl.options.assetId&&['Price & moving averages','Trend profile'].includes(ctrl.options.label))tools.prepend(MarketLabChartMeasure.controls());
    const bar=document.createElement('div');bar.className='ml-panel-toolbar';
    const select=document.createElement('select');select.className='ml-overlay-select';select.setAttribute('aria-label','Price overlay');
    if(ctrl.series.some(s=>s.right)&&!ctrl.options.defaultOverlay)select.add(new Option(ctrl.options.originalOverlayLabel||'Original line','original'));
    choices.forEach(([value,text])=>select.add(new Option(value==='none'?'Overlay':text,value)));
    if(ctrl.options.assetId&&window.MarketLabOverextension)select.add(new Option('Overextension','overextension'));
    select.value=ctrl.state.overlay;
    select.onchange=()=>{ctrl.state.overlay=select.value;refresh(ctrl);};
    tools.prepend(select);
    const reset=document.createElement('button');reset.type='button';reset.textContent='Reset zoom';reset.className='ml-chart-reset';reset.onclick=()=>{ctrl.state.zoom=null;refresh(ctrl);};
    const range=document.createElement('span');range.className='ml-chart-range';
    bar.append(reset,range);host.before(bar);
    const overlayReadout=document.createElement('p');overlayReadout.className='ml-chart-overlay-readout';host.after(overlayReadout);
  }
  function refresh(ctrl) {
    const current=livePanels.get(ctrl.key)||ctrl;
    if(current.card.isConnected)render(current,current.card,current.host,false);
    if(active?.key===ctrl.key)render(ctrl,active.card,active.host,true);
  }
  async function render(ctrl,card,host,expanded) {
    const {dates,series,options,renderer,state:s}=ctrl;
    const requestedOverlay=s.overlay,ticket=host._renderTicket=(host._renderTicket||0)+1;
    const current=()=>host.isConnected&&host._renderTicket===ticket&&s.overlay===requestedOverlay&&!s.flipped;
    let overlayError='',overlayOptions={};
    card.querySelector(':scope > .oe-panel-history')?.remove();
    const select=card.querySelector('[aria-label="Price overlay"]');select.value=s.overlay;
    select.dataset.active=String(s.overlay!=='none');
    select.title='Overlay: '+(s.overlay==='none'?'none':select.selectedOptions[0]?.textContent);
    card.querySelector('.ml-panel-toolbar').hidden=!s.zoom;
    card.querySelector('.ml-chart-reset').hidden=!s.zoom;
    card.querySelector('.ml-chart-range').textContent=s.zoom?s.zoom.join(' → '):'';
    card.querySelector('[data-chart-info]').setAttribute('aria-pressed',String(s.flipped));
    if(s.flipped) {
      host._measurement?.destroy();host._measurement=null;
      host.replaceChildren();host.classList.add('ml-chart-explainer');
      const paragraphs=explanation(options.label);
      paragraphs.forEach((p,i)=>{const e=document.createElement(i?'p':'h3');e.textContent=p;host.append(e);});
      const back=document.createElement('button');back.type='button';back.textContent='Back to chart';back.onclick=()=>{s.flipped=false;refresh(ctrl);};host.append(back);
      card.querySelector('.ml-chart-overlay-readout').textContent='';return;
    }
    host.classList.remove('ml-chart-explainer');
    let plotted=series, overlayLabel=options.originalOverlayLabel||'', selectedPrice=null;
    if(s.overlay==='none')plotted=series.filter(x=>!x.right);
    else if(s.overlay==='overextension') {
      overlayLabel='Overextension · '+options.assetId+' · daily score';
      try{
        const history=await MarketLabOverextension.history(options.assetId,options.updated);
        if(!current())return;
        const stats=document.createElement('div');stats.className='oe-panel-history';stats.innerHTML=MarketLabOverextension.historicalContext(history);card.append(stats);
        selectedPrice=MarketLabOverextension.align(history,dates);
        if(!selectedPrice.some(Number.isFinite))overlayError='No overextension readings in this date range. Available history: '+history.dates[0]+' → '+history.dates.at(-1)+'.';
      }catch(e){if(!current())return;overlayError=e.message;selectedPrice=dates.map(()=>null);}
      plotted=[MarketLabOverextension.overlaySeries(selectedPrice),...series.filter(x=>!x.right)];
      overlayOptions={rightDomain:[-105,105],rightFormat:v=>(v>0?'+':'')+v.toFixed(0),
        referenceLines:[...(options.referenceLines||[]),{value:99,label:'+99',axis:'right'},{value:-97,label:'−97',axis:'right'},{value:0,axis:'right'}]};
    }
    else if(s.overlay!=='original') {
      overlayLabel=choices.find(x=>x[0]===s.overlay)?.[1]||s.overlay;
      if(options.defaultOverlay===s.overlay&&series.some(x=>x.right))selectedPrice=series.find(x=>x.right).values;
      else {
        try {
          const payload=await overlays();
          if(!current())return;
          const p=payload.series[s.overlay];if(!p)throw Error('Overlay not available');
          const lookup=new Map(p.dates.map((d,i)=>[d,p.close[i]]));selectedPrice=dates.map(d=>lookup.get(d)??null);
        } catch(e){if(!current())return;overlayError=e.message;selectedPrice=dates.map(()=>null);}
      }
      plotted=[...series.filter(x=>!x.right),{values:selectedPrice,color:MarketLab.colors().ink,right:true}];
    }
    if(!current())return;
    const indices=dates.map((d,i)=>!s.zoom||(d>=s.zoom[0]&&d<=s.zoom[1])?i:-1).filter(i=>i>=0);
    const shown=indices.length>=2?indices:dates.map((_,i)=>i);
    const right=plotted.some(x=>x.right);
    let domain=options.domain;
    if(options.fitY){
      let lo=Infinity,hi=-Infinity;
      for(const line of plotted.filter(x=>!x.right))for(const i of shown)if(Number.isFinite(line.values[i])){lo=Math.min(lo,line.values[i]);hi=Math.max(hi,line.values[i]);}
      if(Number.isFinite(lo)){const pad=Math.max((hi-lo)*.05,Math.abs(hi)*.01,1e-8);domain=[lo-pad,hi+pad];}
    }
    options.onVisibleRange?.(shown);
    const update=j=>{
      const i=shown[j];options.onCursor?.(i);
      const original=ctrl.card.querySelector('.an-readout');const target=card.querySelector('.an-readout');
      if(expanded&&original&&target)target.textContent=original.textContent;
      const value=plotted.find(x=>x.right)?.values[i];
      card.querySelector('.ml-chart-overlay-readout').textContent=overlayError||(right?overlayLabel+' · right axis · '+dates[i]+' · '+(Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:2}):'unavailable'):'');
    };
    renderer(host,shown.map(i=>dates[i]),plotted.map(x=>({...x,values:shown.map(i=>x.values[i]),colors:x.colors?shown.map(i=>x.colors[i]):undefined})),{
      ...options,...overlayOptions,domain,right,height:expanded?Math.max(280,innerHeight-280):options.height,
      ruler:!!card.querySelector('.ml-ruler-controls'),
      onCursor:update,onSelect:(j,k)=>options.onSelect?.(shown[j],k),
      onZoom:(a,b)=>{if(b-a<2)return;s.zoom=[dates[shown[a]],dates[shown[b]]];refresh(ctrl);},
      onExplain:()=>{s.flipped=true;refresh(ctrl);}
    });
    host.dataset.start=dates[shown[0]];host.dataset.end=dates[shown.at(-1)];update(shown.length-1);
  }
  function open(ctrl) {
    if(dialog?.open)dialog.close();
    dialog=document.createElement('dialog');dialog.className='ml-chart-dialog';dialog.setAttribute('aria-label',ctrl.options.label+' expanded');
    const card=document.createElement('article');card.className='an-card';
    const header=document.createElement('header'),title=document.createElement('h3');title.textContent=ctrl.card.querySelector('h3').textContent;header.append(title);
    const legend=document.createElement('div');legend.className='an-legend';legend.innerHTML=ctrl.card.querySelector('.an-legend,.ml-breadth-legend')?.innerHTML||'';
    legend.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>ctrl.card.querySelectorAll('.an-legend button')[i]?.click());
    const host=document.createElement('div');host.className='an-plot';const readout=document.createElement('p');readout.className='an-readout';
    card.append(header,legend,host,readout);dialog.append(card);document.body.append(dialog);
    active={key:ctrl.key,ctrl,card,host};
    decorate(ctrl,card,host,true);
    const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const thisDialog=dialog;
    dialog.addEventListener('close',()=>{document.body.style.overflow=priorOverflow;thisDialog.remove();if(active?.ctrl===ctrl)active=null;(livePanels.get(ctrl.key)||ctrl).card.querySelector('.ml-chart-actions button:last-child')?.focus();refresh(ctrl);},{once:true});
    dialog.showModal();render(ctrl,card,host,true);
  }
  window.addEventListener('ml:themechange',()=>{if(active)render(active.ctrl,active.card,active.host,true);});
  window.addEventListener('resize',()=>{if(active)render(active.ctrl,active.card,active.host,true);});
  window.MarketLabChartPanels={mount};
})();
