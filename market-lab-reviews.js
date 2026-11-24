/* Layout and archive browsing. Research prose and metrics are not regenerated here. */
document.addEventListener('DOMContentLoaded',()=>{
  const data=window.QUANT_WEEKEND, index=window.QUANT_REVIEWS_INDEX;
  if(!data)return;
  const risk=document.getElementById('risk'), participation=document.getElementById('participation');
  const overview=document.createElement('div');overview.className='ml-review-overview';
  risk.before(overview);overview.append(risk,participation);
  for(const section of [risk,participation]){
    const disclosure=document.createElement('details');disclosure.innerHTML='<summary>Methodology</summary>';
    section.querySelectorAll(':scope > .lede,:scope > .note').forEach(node=>disclosure.append(node));
    if(section===risk)disclosure.append(document.getElementById('rratios'));
    section.append(disclosure);
  }
  const breadth=document.createElement('div');breadth.className='ml-breadth-plot';
  document.getElementById('gauges').before(breadth);
  function drawBreadth(){
    const g=data.gauges;if(!g?.dates)return;
    const palette=MarketLab.colors(),start=Math.max(0,g.dates.length-252);
    MarketLabChart.chart(breadth,[['pct50','Above 50-day',palette.accent],['pct200','Above 200-day','#b392df']].map(([key,title,color])=>({
      title,color,points:g.dates.slice(start).map((date,i)=>({date,value:g[key][i+start]})).filter(p=>Number.isFinite(p.value))
    })),{height:260,label:'S&P 500 participation over the past year',format:v=>v.toFixed(0)+'%'});
  }
  const edition=document.getElementById('weeklyedition');
  // Archived prose stays below current market metrics and is explicitly dated.
  document.querySelector('.page').append(edition);
  const archive=document.createElement('div');archive.className='ml-archive-list';
  document.querySelector('.ml-context-rail').append(archive);
  let request=0;
  (index?.editions||[]).slice().reverse().forEach(row=>{
    const button=document.createElement('button');button.type='button';button.textContent=row.week_ending;
    const kind=document.createElement('small');kind.textContent=row.kind==='weekly'?'weekly':'daily archive';button.append(kind);
    button.onclick=async()=>{
      const mine=++request;
      archive.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===button));
      const title=edition.querySelector('h2'),body=document.getElementById('editionbody');
      title.textContent='Archived narrative';
      document.getElementById('editionmeta').textContent=row.week_ending+' · '+(row.kind==='weekly'?'weekly edition':'legacy daily review');
      body.textContent='Loading saved review…';body.classList.add('ml-archive-content');
      edition.scrollIntoView({behavior:'smooth',block:'start'});
      document.body.classList.remove('ml-sidebar-open');
      try{
        const response=await fetch('cube/reviews/'+encodeURIComponent(row.review_id)+'/narrative.json');
        if(!response.ok)throw new Error('Archive unavailable');
        const narrative=await response.json();if(mine!==request)return;
        body.replaceChildren();
        const add=(tag,text)=>{if(!text)return;const el=document.createElement(tag);el.textContent=text;body.append(el);};
        if(narrative.status==='legacy'){
          const c=narrative.content||{};
          if(!Object.values(c).some(Boolean))add('p','This legacy snapshot has no saved narrative.');
          add('p',c.summary||c.detail);
          for(const [key,label] of [['winners','Worked'],['laggards','Lagged'],['why','Why'],['comparison','Since prior review'],['volume','Volume']]){
            if(c[key]){add('h3',label);add('p',c[key]);}
          }
        }else if(narrative.status==='complete'){
          add('p',narrative.content?.lead);
          (narrative.content?.sections||[]).forEach(s=>{add('h3',s.title);add('p',s.body);});
        }else add('p','Narrative pending: '+(narrative.reason||'writer unavailable'));
        add('p','Current charts above remain dated '+data.as_of+'. This section displays saved text from '+row.week_ending+'.');
      }catch(error){if(mine===request)body.textContent='This saved narrative could not be loaded.';}
    };
    archive.append(button);
  });
  drawBreadth();
  window.addEventListener('ml:themechange',drawBreadth);
  let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(drawBreadth,120);});
  window.dispatchEvent(new Event('resize'));
});
