/* Pure brief calculations; private basket membership stays in the browser. */
(()=>{
  const key=s=>String(s||'').toUpperCase();
  function resolve(members,b,cloud=[]){
    const stocks=new Map(),groups=new Map();
    for(const r of b.stocks)for(const alias of [r.id,r.symbol,...(r.aliases||[])])stocks.set(key(alias),r.symbol);
    for(const g of [...b.groups,...cloud])groups.set(key(g.id),g.members||[]);
    const found=new Set(),visited=new Set();
    function visit(id){id=key(id);if(visited.has(id))return;visited.add(id);
      if(stocks.has(id))found.add(stocks.get(id));else for(const child of groups.get(id)||[])visit(child);}
    members.forEach(visit);return found;
  }
  function scopeRows(b,scope,cloud){
    if(scope==='all')return b.stocks;
    if(scope==='baskets'&&!cloud?.available)return [];
    const members=scope==='baskets'?(cloud.baskets||[]).flatMap(g=>g.members||[]):b.scopes[scope]||[];
    const allowed=resolve(members,b,cloud?.baskets||[]);
    return b.stocks.filter(r=>allowed.has(r.symbol));
  }
  function groupVolume(rows,total){
    const valid=rows.filter(r=>r.fresh&&Number.isFinite(r.volume?.ratio));
    const sum=field=>valid.reduce((n,r)=>n+(r.volume[field]||0),0);
    const recent=sum('recent_mean'),base=sum('baseline_mean');
    const hasPrevious=valid.length&&valid.every(r=>Number.isFinite(r.volume.previous_baseline_mean));
    const previous=hasPrevious&&sum('previous_baseline_mean')>0?sum('previous_recent_mean')/sum('previous_baseline_mean'):null;
    const ratio=base>0?recent/base:null;
    const driver=[...valid].sort((a,b)=>b.volume.recent_mean-a.volume.recent_mean)[0];
    return {ratio,previous,change:ratio!=null&&previous!=null?ratio-previous:null,
      eligible:valid.length,total,accelerating:valid.filter(r=>r.volume.ratio>=1.5&&r.volume.change>0).length,
      driver:driver?.symbol,driver_share:driver&&recent>0?driver.volume.recent_mean/recent:null};
  }
  function groups(b,rows,scope,cloud){
    const selected=new Set(rows.map(r=>r.symbol));
    const source=scope==='baskets'?(cloud?.baskets||[]).map(g=>({...g,label:g.name})):b.groups;
    return source.map(g=>{
      const all=resolve(g.members||[],b,cloud?.baskets||[]),members=[...all].filter(t=>selected.has(t));
      return {...g,members,volume:groupVolume(rows.filter(r=>members.includes(r.symbol)),members.length)};
    }).filter(g=>g.volume.total&&g.volume.eligible>=Math.max(1,g.volume.total/2)&&g.volume.ratio!=null)
      .sort((a,b)=>b.volume.ratio-a.volume.ratio);
  }
  const identity=t=>[t.kind,t.key,t.direction||''].join(':');
  function attention(rows,signals,side,thresholds){
    const fresh=new Set((signals?.new||[]).map(identity));
    return rows.filter(r=>r.fresh&&r.extension.side===side&&Number.isFinite(r.extension.score)
      &&(side==='up'?r.extension.score>=thresholds.top:r.extension.score<=thresholds.bottom)
      &&r.volume.ratio>=thresholds.volume).map(r=>({...r,new:fresh.has('ext:'+r.symbol+':'+side)}))
      .sort((a,b)=>Number(b.new)-Number(a.new)||b.volume.ratio-a.volume.ratio||Math.abs(b.extension.score)-Math.abs(a.extension.score)||a.symbol.localeCompare(b.symbol)).slice(0,5);
  }
  const chartUrl=id=>'market-lab-themes.html?overlay=overextension#'+encodeURIComponent(id);
  window.MarketLabBriefModel={resolve,scopeRows,groupVolume,groups,attention,identity,chartUrl};
})();
