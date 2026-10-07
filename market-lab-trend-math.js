/* One deterministic implementation for the browser and Node verification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MarketLabTrendMath=api;})(globalThis,()=>{
  'use strict';
  const VERSION='price-box-10-21-50-100-200-v3', EPS=1e-12;
  const LABELS=['Unavailable','Strong uptrend','Uptrend','Consolidation after uptrend','Consolidation','Consolidation after downtrend','Downtrend','Strong downtrend','Transition'];
  const direction=s=>s===1||s===2?1:s===6||s===7?-1:0;
  const finite=Number.isFinite;
  function ema(values,n){let count=0,sum=0,last=null;return values.map(v=>{if(!finite(v)){count=0;sum=0;last=null;return null;}if(count<n){sum+=v;count++;if(count<n)return null;last=sum/n;}else last+=(v-last)*2/(n+1);return last;});}
  function changes(close,mode='log'){return close.map((v,i)=>i&&finite(v)&&finite(close[i-1])&&(mode==='level'||v>0&&close[i-1]>0)?(mode==='level'?v-close[i-1]:Math.log(v/close[i-1])):null);}
  function rms(values,n=50){let sum=0,count=0;return values.map((v,i)=>{if(finite(v)){sum+=v*v;count++;}if(i>=n&&finite(values[i-n])){sum-=values[i-n]**2;count--;}return count===n?Math.sqrt(Math.max(0,sum/n)):null;});}
  function classify({eligible,tight,above10,below10,above21,below21,slope10,slope21}){
    if(!eligible)return 0;
    if(tight)return 4;
    if(above10&&slope10>EPS)return 1;
    if(below10&&slope10<-EPS)return 7;
    if(above21&&slope21>EPS)return 2;
    if(below21&&slope21<-EPS)return 6;
    return 8;
  }
  function priceBoxes(close){
    let box=null,outside=0;
    return close.map((price,i)=>{
      if(!finite(price)){box=null;outside=0;return null;}
      if(box){
        const side=price>box.high+EPS?1:price<box.low-EPS?-1:0;
        const overshoot=Math.max(price-box.high,box.low-price,0),buffer=.25*(box.high-box.low);
        if(side&&(side===outside||overshoot>buffer+EPS)){box=null;outside=0;return null;}
        outside=side;return {...box};
      }
      const recent=close.slice(Math.max(0,i-9),i+1);
      if(recent.length<10||!recent.every(finite))return null;
      const low=Math.min(...recent),high=Math.max(...recent),width=high-low;
      const scale=Math.max(Math.abs((high+low)/2),EPS);
      // Freeze the observed boundaries; a rolling box must not chase a trend.
      if(width<=.2*scale+EPS&&Math.abs(price-recent[0])<=.25*width+EPS){
        box={low,high,confirmed:i};return {...box};
      }
      return null;
    });
  }
  function trend(close,mode='log'){
    close=close.map(v=>finite(v)&&(mode==='level'||v>0)?v:null);
    const averages=Object.fromEntries([10,21,50,100,200].map(n=>[n,ema(close,n)]));
    const fast=averages[10],slow=averages[21],returns=changes(close,mode),vol=rms(returns);
    const boxes=priceBoxes(close),width=[],tight=[],fastSlope=[],slowSlope=[],states=[],pullback=[],bounce=[];
    let runDir=0,run=0,lastTrend=0,lastTrendAt=-Infinity,boxDirection=0;
    const diff=(a,b)=>mode==='level'?a-b:Math.log(a/b);
    for(let i=0;i<close.length;i++){
      const ok=i>=5&&[close[i],fast[i],slow[i],fast[i-5],slow[i-5]].every(finite);
      fastSlope.push(ok?diff(fast[i],fast[i-5]):null);slowSlope.push(ok?diff(slow[i],slow[i-5]):null);
      const band=[fast[i],slow[i],averages[50][i]];
      width.push(band.every(finite)?(mode==='level'?Math.max(...band)-Math.min(...band):Math.log(Math.max(...band)/Math.min(...band))):null);
      tight.push(!!boxes[i]);
      if(!boxes[i])boxDirection=0;
      else if(boxes[i].confirmed===i)boxDirection=i-lastTrendAt<=50?lastTrend:0;
      const hold=(ma,sign)=>ok&&[0,1,2].every(k=>sign*(close[i-k]-ma[i-k])>EPS);
      let s=classify({eligible:ok,tight:tight[i],above10:hold(fast,1),below10:hold(fast,-1),above21:hold(slow,1),below21:hold(slow,-1),slope10:fastSlope[i],slope21:slowSlope[i]});
      const d=direction(s);
      if(!s){run=0;runDir=0;lastTrend=0;lastTrendAt=-Infinity;}
      else if(!d){if(s===4&&boxDirection)s=boxDirection>0?3:5;run=0;runDir=0;}
      else{run=d===runDir?run+1:1;runDir=d;if(run>=3){lastTrend=d;lastTrendAt=i;}}
      states.push(s);
      pullback.push(s?slowSlope[i]>EPS&&close[i]<fast[i]:null);
      bounce.push(s?slowSlope[i]<-EPS&&close[i]>fast[i]:null);
    }
    return {close,fast,slow,averages,returns,vol,width,tight,boxes,fastSlope,slowSlope,states,pullback,bounce};
  }
  function beta(asset,benchmark){
    const n=asset.close.length,empty=()=>Array(n).fill(null);
    const values=empty(),correlation=empty(),r2=empty(),paired=Array(n).fill(0),market=empty();
    if(!benchmark||asset.mode==='level'||benchmark.mode==='level')return {values,correlation,r2,paired,market,reason:'Return beta is unavailable for native-unit series or a missing benchmark.'};
    const ar=changes(asset.close),br=changes(benchmark.close),index=new Map(benchmark.dates.map((d,i)=>[d,i]));
    for(let i=1;i<n;i++){const j=index.get(asset.dates[i]);if(j>0&&benchmark.dates[j-1]===asset.dates[i-1]&&finite(br[j]))market[i]=br[j];}
    let k=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
    const add=(i,sign)=>{if(i>=0&&finite(ar[i])&&finite(market[i])){const x=market[i],y=ar[i];k+=sign;sx+=sign*x;sy+=sign*y;sxx+=sign*x*x;syy+=sign*y*y;sxy+=sign*x*y;}};
    for(let i=0;i<n;i++){
      add(i,1);add(i-126,-1);paired[i]=k;
      if(k<100)continue;
      const vx=sxx-sx*sx/k,vy=syy-sy*sy/k,cov=sxy-sx*sy/k;
      if(vx<=EPS)continue;
      values[i]=cov/vx;
      if(vy>EPS){correlation[i]=Math.max(-1,Math.min(1,cov/Math.sqrt(vx*vy)));r2[i]=correlation[i]**2;}
    }
    return {values,correlation,r2,paired,market,reason:null};
  }
  function events(profile,dates,mode='log'){
    const x=profile.close.map(v=>finite(v)?mode==='level'?v:Math.log(v):null),out=[],seen=new Set();
    let consolidation=0,breakSeen=false;
    for(let t=0;t<x.length;t++){
      if(consolidation>=7&&!breakSeen&&finite(x[t])&&profile.vol[t-1]>EPS){
        const prior=x.slice(t-Math.min(consolidation,21),t);
        if(prior.every(finite)){const pad=.5*profile.vol[t-1];let type=x[t]>Math.max(...prior)+pad?'breakout':x[t]<Math.min(...prior)-pad?'breakdown':null;
          if(type){out.push({type,index:t,date:dates[t],start:t-consolidation});breakSeen=true;}}
      }
      if(profile.states[t]>=3&&profile.states[t]<=5)consolidation++;
      else{consolidation=0;breakSeen=false;}
      if(t<43||!finite(x[t]))continue;
      for(const sign of [1,-1]){
        let low=t-21;for(let j=t-21;j<t;j++)if(!finite(x[j])){low=-1;break;}else if(sign*x[j]<=sign*x[low])low=j;
        if(low<21)continue;
        let high=low-21;for(let j=low-21;j<low;j++)if(!finite(x[j])){high=-1;break;}else if(sign*x[j]>=sign*x[high])high=j;
        if(high<0||!finite(profile.vol[high])||profile.vol[high]<EPS)continue;
        const duration=low-high,elapsed=t-low,drop=sign*(x[high]-x[low]);
        if(duration<3||duration>21||elapsed>Math.min(21,Math.floor(1.5*duration))||drop<2*profile.vol[high]*Math.sqrt(duration))continue;
        const recovered=sign*(x[t]-x[low])/drop,prev=sign*(x[t-1]-x[low])/drop;
        if(recovered<.8||prev>=.8)continue;
        let base=0;for(let j=low+1;j<=t;j++)if(sign*(x[j]-x[low])<=.2*drop)base++;
        const key=sign+':'+high+':'+low;if(base>5||seen.has(key))continue;
        seen.add(key);out.push({type:sign===1?'v_recovery':'inverted_v',index:t,date:dates[t],start:high,trough:low,recovered});
      }
    }
    return out.sort((a,b)=>a.index-b.index);
  }
  function calculate(asset,benchmark=null){
    if(asset.dates.length!==asset.close.length)throw Error('Price dates and values do not match.');
    const raw=trend(asset.close,asset.mode),b=beta(asset,benchmark),residual=[];
    let level=null;
    for(let i=0;i<asset.close.length;i++){
      if(i&&finite(raw.returns[i])&&finite(b.values[i-1])&&finite(b.market[i])){
        let e=raw.returns[i]-b.values[i-1]*b.market[i];if(Math.abs(e)<EPS)e=0;
        if(level===null)level=100;else level*=Math.exp(e);
        residual[i]=finite(level)?level:null;
      }else if(finite(b.values[i])&&finite(raw.returns[i])&&finite(b.market[i])){level=100;residual[i]=100;}
      else{residual[i]=null;level=null;}
    }
    return {version:VERSION,dates:asset.dates,raw,adjusted:trend(residual),beta:b,events:events(raw,asset.dates,asset.mode)};
  }
  function summarize(result,start,end,adjusted=false){
    const p=adjusted?result.adjusted:result.raw,dates=result.dates;
    const a=dates.findIndex(d=>!start||d>=start);let b=dates.length-1;while(b>=0&&end&&dates[b]>end)b--;
    const rows=LABELS.map((label,state)=>({state,label,sessions:0,percent:null,episodes:0,completed:0,average:null,longest:0}));
    const lengths=LABELS.map(()=>[]);let eligible=0;
    if(a<0||b<a)return {rows:rows.slice(1),eligible:0,total:0,current:null,events:[],patterns:[],first:null,last:null};
    for(let i=a;i<=b;i++)if(p.states[i]){rows[p.states[i]].sessions++;eligible++;}
    let i=0;
    while(i<=b){const s=p.states[i];if(!s){i++;continue;}let j=i+1;while(j<p.states.length&&j<=b&&p.states[j]===s)j++;
      const visible=Math.max(0,Math.min(j-1,b)-Math.max(i,a)+1);
      if(visible){rows[s].episodes++;rows[s].longest=Math.max(rows[s].longest,visible);if(i>=a&&j<=b&&p.states[j]&&p.states[j]!==s)lengths[s].push(j-i);}
      i=j;
    }
    rows.forEach((r,s)=>{r.percent=eligible?100*r.sessions/eligible:null;r.completed=lengths[s].length;r.average=r.completed?lengths[s].reduce((x,y)=>x+y,0)/r.completed:null;});
    let current=null;if(p.states[b]){let first=b;while(first>0&&p.states[first-1]===p.states[b])first--;current={state:p.states[b],label:LABELS[p.states[b]],age:b-first+1,date:dates[b],start:dates[first]};}
    const patterns=['pullback','bounce'].map(type=>{let n=0,k=0;for(let j=a;j<=b;j++)if(result.raw[type][j]!=null){n++;if(result.raw[type][j])k++;}return {type,sessions:k,eligible:n,percent:n?100*k/n:null};});
    return {rows:rows.slice(1),eligible,total:b-a+1,current,events:result.events.filter(e=>e.index>=a&&e.index<=b),patterns,first:dates[a],last:dates[b],endIndex:b};
  }
  function decode(payload){let day=0;const dates=payload.days.map((d,i)=>{day=i?day+d:d;return new Date(day*86400000).toISOString().slice(0,10);});return {...payload,dates};}
  return {VERSION,LABELS,direction,ema,changes,rms,classify,priceBoxes,trend,beta,events,calculate,summarize,decode};
});
