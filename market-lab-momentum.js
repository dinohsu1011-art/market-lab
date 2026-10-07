/* A versioned checklist over the existing daily edition; no extra data feed. */
(()=>{
  const VERSION='momentum-v1', TOTAL=12, WATCH_MIN=8;
  const PHASE_VERSION='momentum-phases-v1';
  const PHASE_GROUPS={
    strongest:{label:'Strongest momentum',description:'Ranked by the 12-point strength checklist.'},
    up_accelerating:{label:'Upward momentum accelerating',sign:1,description:'Positive momentum is gaining strength. Ranked by the largest increase.'},
    up_fading:{label:'Upward momentum fading',sign:-1,description:'Momentum is still positive, but losing strength. Ranked by the largest slowdown.'},
    down_accelerating:{label:'Downward momentum accelerating',sign:-1,description:'Negative momentum is getting stronger. Ranked by the fastest deterioration.'},
    selling_easing:{label:'Selling pressure easing',sign:1,description:'Momentum is still negative, but the decline is slowing. Ranked by the largest improvement.'},
    turning_up:{label:'Turning upward',sign:1,description:'Momentum turned positive within the last three sessions and is still improving.'},
    turning_down:{label:'Turning downward',sign:-1,description:'Momentum turned negative within the last three sessions and is still deteriorating.'}
  };
  const bool=v=>typeof v==='boolean'?v:null;
  const positive=v=>Number.isFinite(v)?v>0:null;
  const and=(a,b)=>a===false||b===false?false:a===true&&b===true?true:null;
  const check=(id,label,pass,rule)=>({id,label,pass:bool(pass),rule});
  function score(q,benchmark='SPY',{fresh=true}={}){
    const d=q?.diagnostics||{},rs=q?.rs?.[benchmark]||{};
    const groups=[
      {label:'Trend',checks:[
        check('trend','Established uptrend',q?.trending,'Above a rising 21-day EMA, with the existing two-session pullback allowance.'),
        check('strong','Strong uptrend',q?.strong,'Above rising 10- and 21-day EMAs, without using the pullback allowance.'),
        check('fan','Shorter averages lead',d.maFan,'10-day EMA > 21-day EMA > 50-day EMA.')
      ]},
      {label:'Relative strength',checks:[21,50,100].map(n=>check('rs'+n,'Ahead of '+benchmark+' over '+n+' sessions',positive(rs[n]),'Stock return relative to '+benchmark+' over the same '+n+' sessions is positive.'))},
      {label:'Buying activity',checks:[
        check('obv','Volume balance rising',d.obv,'On-balance volume is higher than 20 sessions ago.'),
        check('upDown','More volume on rising days',d.upDownVolume,'Up-day volume / down-day volume over 20 sessions is at least 1.2.'),
        check('demand','Busy session, strong close',and(bool(d.rvol),bool(d.closeHigh)),'Volume is at least 1.5 times its prior 20-session average and the close is in the top quarter of the daily range.')
      ]},
      {label:'Price structure',checks:[
        check('swings','Higher highs and lows',d.hhhl,'The latest two confirmed swing highs and swing lows are both rising.'),
        check('weekly','Weekly trend aligned',d.weeklyEMA,'The completed-week 10-period EMA is above the 21-period EMA.'),
        check('high','New 52-week closing high',d.high252,'Close is strictly above all of the previous 252 closes.')
      ]}
    ].map(g=>({...g,points:g.checks.filter(c=>c.pass===true).length,available:g.checks.filter(c=>c.pass!==null).length}));
    const available=groups.reduce((n,g)=>n+g.available,0),earned=groups.reduce((n,g)=>n+g.points,0);
    const eligible=fresh&&q?.comparable===true;
    const points=eligible?earned:null;
    const watch=eligible&&q.trending===true&&available>=10&&earned>=WATCH_MIN;
    return {version:VERSION,benchmark,points,total:TOTAL,available,missing:TOTAL-available,groups,watch,
      label:!eligible?'Not ranked':available<10?'Limited history':earned>=10?'Broad confirmation':earned>=8?'Momentum building':earned>=6?'Mixed signals':'Few confirmations',
      reasons:groups.flatMap(g=>g.checks).filter(c=>c.pass===true).map(c=>c.label),
      note:!fresh?'Latest close unavailable.':q?.comparable!==true?'Momentum ranking covers US-listed stocks.':available<TOTAL?(TOTAL-available)+' checks unavailable; the score is not scaled up.':''};
  }
  function marketReading(series,updated){
    const p=series?.daily,n=p?.dates?.length||0;
    if(n<3||p.dates[n-1]!==updated)return {trending:null,gap:null};
    const gaps=[];
    for(let i=n-3;i<n;i++){
      const c=p.close?.[i],e=p.averages?.['21']?.[i];
      if(!Number.isFinite(c)||!Number.isFinite(e)||c<=0||e<=0)return {trending:null,gap:null};
      gaps.push(100*(c/e-1));
    }
    const gap=gaps.reduce((s,v)=>s+v,0)/3;
    return {trending:gap>0,gap,from:p.dates[n-3],through:updated};
  }
  function marketPass(context,filter='any'){
    if(filter==='any')return true;
    if(filter==='both')return context?.sp500?.trending===true&&context?.nasdaq?.trending===true;
    return context?.[filter]?.trending===true;
  }
  function top(rows,benchmark='SPY'){
    return rows.map(r=>({...r,momentum:score(r.daily,benchmark,{fresh:r.fresh}),relative:r.daily?.rs?.[benchmark]?.['50']??null}))
      .filter(r=>r.fresh===true&&r.momentum.points!==null&&r.momentum.available>=10)
      .sort((a,b)=>b.momentum.points-a.momentum.points||
        ((b.relative??-Infinity)-(a.relative??-Infinity))||
        ((b.turnoverUSD?.['1D']??0)-(a.turnoverUSD?.['1D']??0))||a.id.localeCompare(b.id))
      .slice(0,10);
  }
  function phaseTop(rows,group,updated,{stretchedOnly=false}={}){
    const validPhase=r=>r.momentum_phase?.version===PHASE_VERSION&&r.momentum_phase.updated===updated;
    const pool=rows.filter(r=>!stretchedOnly||(validPhase(r)&&r.momentum_phase.stretched===true));
    if(group==='strongest')return top(pool);
    const config=PHASE_GROUPS[group];if(!config)return [];
    return pool.filter(r=>r.fresh===true&&r.daily?.comparable===true&&validPhase(r)&&
        r.momentum_phase.groups?.includes(group)&&Number.isFinite(r.momentum_phase.change)&&Number.isFinite(r.momentum_phase.level))
      .map(r=>({...r,relative:r.daily?.rs?.SPY?.['50']??null}))
      .sort((a,b)=>config.sign*(b.momentum_phase.change-a.momentum_phase.change)||
        ((b.turnoverUSD?.['1D']??0)-(a.turnoverUSD?.['1D']??0))||a.id.localeCompare(b.id))
      .slice(0,10);
  }
  window.MarketLabMomentum={VERSION,TOTAL,WATCH_MIN,score,top,phaseTop,PHASE_GROUPS,PHASE_VERSION,marketReading,marketPass};
})();
