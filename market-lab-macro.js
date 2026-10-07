(function(){"use strict";
const I=window.QUANT_MACRO_INDEX||{series:[],coverage_gaps:[]},$=s=>document.querySelector(s),COLORS=["#1d7fc4","#d97706","#059669","#7c3aed"],STORE="quant.macro.configs.v1";
let selected=["fred:CPILFESL","fred:PCEPILFE"],range="5Y",op="yoy",cache=new Map(),seq=0,frozen=null;
const byId=id=>I.series.find(s=>s.id===id),safe=s=>s.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
const LEADING=new Set(['fred:ICSA','fred:PERMIT','fred:ANFCI','fred:DRTSCILM','fred:NFCICREDIT','derived:us_curve_10y_2y:v1','derived:us_curve_10y_3m:v1']);
const CORE=new Set(['fred:GDPC1','fred:INDPRO','fred:RSAFS','fred:PAYEMS','fred:UNRATE','fred:ICSA','fred:CPIAUCSL','fred:CPILFESL','fred:PCEPILFE','fred:DFF','fred:DGS2','fred:DGS10','derived:us_curve_10y_2y:v1']);
function renderRail(query=""){
  const q=query.toLowerCase(),groups={};
  const open=new Set([...document.querySelectorAll('.macro-group[open]')].map(g=>g.dataset.group));
  I.series.filter(s=>!q||[s.title,s.id,s.country,...(s.aliases||[])].join(" ").toLowerCase().includes(q))
    .forEach(s=>(groups[s.group]??=[]).push(s));
  const rows=Object.values(groups).flat();
  const row=s=>`<div class="macro-series-row"><button class="series ${selected.includes(s.id)?'sel':''} ${s.available?'':'off'}" data-id="${s.id}" aria-pressed="${selected.includes(s.id)}" title="${s.available?'':'No accepted observations yet'}">${s.title}</button><button type="button" class="ml-favorite" data-macro-favorite="${s.id}" aria-label="${MarketLabCloud.favorite('macro',s.id)?'Unfavorite':'Favorite'} ${s.title}" aria-pressed="${MarketLabCloud.favorite('macro',s.id)}">${MarketLabCloud.favorite('macro',s.id)?'★':'☆'}</button></div>`;
  const section=(name,items,initial=false)=>`<details class="macro-group" data-group="${name}" ${q||open.has(name)||(!document.querySelector('.macro-group')&&initial)?'open':''}><summary>${name}<small>${items.length}</small></summary>${items.map(row).join('')||'<p class="ml-rail-empty">'+(name==='Favorites'?'Star a series to keep it here.':'No matching series.')+'</p>'}</details>`;
  $("#series-list").innerHTML=section('Leading Indicators',rows.filter(s=>LEADING.has(s.id)),true)
    +section('Core Data',rows.filter(s=>CORE.has(s.id)),true)
    +section('Favorites',rows.filter(s=>MarketLabCloud.favorite('macro',s.id)),true)
    +Object.entries(groups).map(([g,items])=>section(g,items,items.some(s=>selected.includes(s.id)))).join('');
  document.querySelectorAll(".series").forEach(b=>b.onclick=()=>toggle(b.dataset.id));
  document.querySelectorAll('[data-macro-favorite]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;try{await MarketLabCloud.setFavorite('macro',b.dataset.macroFavorite,!MarketLabCloud.favorite('macro',b.dataset.macroFavorite));}
    catch(error){$('#status').textContent=error.message;}finally{b.disabled=false;}
  });
}
function toggle(id){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id].slice(-8);frozen=null;writeHash();renderRail($("#search").value);render();}
function writeHash(){history.replaceState(null,"","#"+encodeURIComponent(JSON.stringify({v:1,series:selected,range,op,data_mode:frozen?"frozen":"latest"})));}
function readHash(){if(!location.hash)return;try{const x=JSON.parse(decodeURIComponent(location.hash.slice(1)));if(x.v===1){selected=x.series||selected;range=x.range||range;op=x.op||op;}}catch(_){}}
async function load(id){if(frozen?.payloads?.[id])return frozen.payloads[id];if(cache.has(id))return cache.get(id);const meta=byId(id),response=await fetch(meta.file);if(!response.ok)throw new Error(`${meta.title}: ${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);const payload=JSON.parse(text);cache.set(id,payload);return payload;}
function cutoff(points){if(range==="MAX"||!points.length)return points;const years=parseInt(range),last=new Date(points[points.length-1].date),start=new Date(last);start.setFullYear(start.getFullYear()-years);return points.filter(p=>new Date(p.date)>=start);}
function fmt(v){return Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:2}):"—";}
async function render(){const appearance=MarketLab.colors();COLORS.splice(0,4,appearance.accent,"#e99854","#63b889","#a98bd8");const mine=++seq,$charts=$("#charts");if(!selected.length){$charts.innerHTML='<div class="card" style="padding:80px;text-align:center;color:#78716c">Choose a series from the rail.</div>';$("#latest").innerHTML="";return;}$("#status").textContent="Loading selection…";try{const payloads=await Promise.all(selected.map(load));if(mine!==seq)return;const availableOps=payloads.map(p=>p.definition.allowed_transforms||[]).reduce((a,b)=>a.filter(x=>b.includes(x)));if(!availableOps.includes(op))op=availableOps.includes("level")?"level":availableOps[0]||payloads[0].definition.default_transform;$("#transform").innerHTML=availableOps.map(x=>`<option ${x===op?"selected":""}>${x}</option>`).join("");const groups={};payloads.forEach((p,i)=>{const unit=op==="yoy"||op==="qoq_annualized"?"Percent":op==="change"?`Change in ${p.definition.unit}`:p.definition.unit;(groups[p.definition.group+" · "+unit]??=[]).push({payload:p,index:i});});$charts.innerHTML="";for(const[unit,items]of Object.entries(groups)){for(let offset=0;offset<items.length;offset+=4){const batch=items.slice(offset,offset+4),card=document.createElement("div");card.className="card";card.innerHTML=`<div class="chart-title"><b>${unit}</b><div class="legend">${batch.map(x=>`<span style="--c:${COLORS[x.index%4]}">${x.payload.definition.title}</span>`).join("")}</div></div><div class="plot"></div>`;$charts.appendChild(card);MarketLabChart.chart(card.querySelector(".plot"),batch.map(x=>({title:x.payload.definition.title,color:COLORS[x.index%4],points:cutoff(x.payload.histories[op]||[])})),{label:`${op} macro chart`,format:fmt,onCursor:(rows,event)=>tip(rows,event)});}}$("#latest").innerHTML=payloads.map((p,i)=>{const pts=p.histories[op]||[],last=pts[pts.length-1],m=p.latest;return `<div><b style="color:${COLORS[i%4]}">${p.definition.title}</b><div>${last?fmt(last.value):"—"} <span class="meta">${op}</span></div><div class="meta">Period ${last?.date||"unavailable"} · vintage ${m?.vintage||"unknown"}<br>First collected ${m?.first_seen?new Date(m.first_seen).toLocaleString():"unavailable"}</div></div>`}).join("");$("#details").innerHTML=payloads.map(p=>`<p><b>${p.definition.title}</b> · ${p.definition.frequency}, ${p.definition.seasonal_adjustment||""}, ${p.definition.unit}. ${p.definition.origin_agency||""} via ${p.definition.provider_series_id||"derived"}. <a href="${p.definition.source_url||"#"}" target="_blank" rel="noreferrer">Source</a><br>${p.definition.required_attribution||""} ${p.definition.vintage_gaps?.join(" ")||""}</p>`).join("");$("#status").textContent=`${frozen?"Frozen":"Latest accepted"} · snapshot ${I.snapshot_id?.slice(0,12)||"unavailable"}`;writeHash();}catch(error){if(mine===seq){$charts.innerHTML=`<div class="notice">${error.message}</div>`;$("#status").textContent="Could not load selection";}}}
function tip(rows,event){const t=$("#tip");if(!rows){t.style.display="none";return;}t.innerHTML=rows.map(r=>`<div style="color:${r.color}"><b>${r.title}</b> ${fmt(r.value)} · ${r.date}</div>`).join("");t.style.display="block";t.style.left=Math.min(innerWidth-t.offsetWidth-12,event.clientX+14)+"px";t.style.top=Math.min(innerHeight-t.offsetHeight-12,event.clientY+14)+"px";}
function configs(){try{return JSON.parse(localStorage.getItem(STORE)||"[]")}catch(_){return[]}}
function saveConfigs(rows){try{localStorage.setItem(STORE,JSON.stringify(rows));renderSaved();return true;}catch(_){$("#status").textContent="Browser storage is full; export JSON instead";return false;}}
function renderSaved(){const rows=configs();$("#saved").innerHTML='<option value="">Choose…</option>'+rows.map((r,i)=>`<option value="${i}">${r.name} · ${r.data_mode}</option>`).join("");}
async function save(mode){const rows=configs(),name=`${selected.map(id=>byId(id)?.title).join(" + ")} ${range}`;if(!selected.length)return;let item={schema_version:1,name,data_mode:mode,series:[...selected],range,op,saved_at:new Date().toISOString(),snapshot_id:I.snapshot_id};if(mode==="frozen"){const payloads={};for(const id of selected)payloads[id]=await load(id);item.payloads=payloads;}rows.push(item);if(saveConfigs(rows)&&mode==="frozen"){frozen=item;writeHash();render();}}
function download(obj,name){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
$("#search").oninput=e=>renderRail(e.target.value);
$("#drawer").onclick=()=>$("#rail").classList.toggle("open");
$("#save").onclick=()=>save("latest");
$("#freeze").onclick=()=>save("frozen");
$("#export").onclick=async()=>{
  const payloads={};for(const id of selected)payloads[id]=await load(id);
  download({schema_version:1,data_mode:frozen?"frozen":"latest",snapshot_id:I.snapshot_id,series:selected,range,op,payloads},`market-lab-macro-${new Date().toISOString().slice(0,10)}.json`);
};
$("#png").onclick=()=>{
  const svg=document.querySelector("#charts svg");
  if(svg)MarketLabChart.png(svg,"market-lab-macro.png",`${frozen?"Frozen":"Latest"} · ${I.snapshot_id||""} · source attribution in Equinox`);
};
$("#saved").onchange=e=>{
  if(e.target.value==='')return;
  const item=configs()[Number(e.target.value)];if(!item)return;
  selected=item.series;range=item.range;op=item.op;frozen=item.data_mode==="frozen"?item:null;
  document.querySelectorAll('#ranges button').forEach(b=>b.classList.toggle('on',b.dataset.range===range));
  renderRail();render();
};
$("#clear").onclick=()=>{selected=[];frozen=null;writeHash();renderRail();render();};
$("#transform").onchange=e=>{op=e.target.value;frozen=null;writeHash();render();};
document.querySelectorAll("#ranges button").forEach(b=>b.onclick=()=>{range=b.dataset.range;document.querySelectorAll("#ranges button").forEach(x=>x.classList.toggle("on",x===b));writeHash();render();});
readHash();renderRail();renderSaved();document.querySelectorAll("#ranges button").forEach(b=>b.classList.toggle("on",b.dataset.range===range));if(I.coverage_gaps?.length){$("#gap").hidden=false;$("#gap").textContent=I.coverage_gaps.join(" ");}render();
window.addEventListener('ml:themechange',render);
window.addEventListener('ml:cloudchange',()=>renderRail($('#search').value));
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});
})();
