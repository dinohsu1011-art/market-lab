const companyColors = {
  Amazon: "var(--amazon)",
  Google: "var(--capacity-gold)",
  Meta: "var(--capacity-purple)",
  Microsoft: "var(--microsoft)",
  Oracle: "var(--oracle)",
  SpaceX: "var(--spacex)",
};

const rentalColors = [
  "var(--amazon)",
  "var(--reflection)",
  "var(--benchmark)",
  "var(--microsoft)",
  "var(--spacex)",
  "var(--oracle)",
  "var(--internal)",
];


function formatCapacity(value) {
  if (Number(value) === 1) return "1.0";
  return Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function renderDashboard(data) {
  const research = window.capacityResearch;
  const { quarters } = data;
  data = {...data, companies: data.companies.map(company => ({
    ...company,
    values: company.values.map((entry,i) => {
      const override = research.quarterlyOverrides?.[company.name]?.[quarters[i].join(' ')];
      return override ? [override.value,override.status] : entry;
    })
  }))};
  const kgiNames = {AMZN: 'Amazon', GOOGL: 'Google', MSFT: 'Microsoft', META: 'Meta'};
  const kgiCompanies = research.kgi.map(c => ({
    name: kgiNames[c.name],
    outlook: `KGI: ${c.fleet[3]} GW fleet at end-2027; +${c.additions[2]} GW in 2027. Quarterly bars = annual additions ÷ 4.`,
    values: quarters.map(([,year]) => {
      const i = Number(year) - 2025;
      return i >= 0 && i < c.additions.length ? [c.additions[i] / 4, 'implied'] : null;
    })
  }));
  data = {...data, companies: [...kgiCompanies, ...data.companies.filter(c => !['Amazon','Microsoft','Google','Meta'].includes(c.name)).map(c => ({...c, outlook: (c.name === 'Oracle' ? 'Q2 / Q3 2026: 0.30 / 0.85 GW reported (user updates, Sep 11). ' : 'Prior workbook: ') + c.outlook}))]};
  const labTotal = name => research.labs.find(l => l.name === name).rows.reduce((s,r) => s+r[2],0);
  const annual2027 = research.kgi.reduce((s,c) => s+c.additions[2],0);
  const metrics = [
    {label:'KGI 2027 additions',value:annual2027,unit:'GW',note:`Top 4 · ${(annual2027/4).toFixed(1)} GW/qtr allocation`},
    {label:'KGI 2027 fleet',value:research.kgi.reduce((s,c) => s+c.fleet[3],0),unit:'GW',note:'Top 4 cumulative · year-end'},
    {label:'Anthropic EOY 2027',value:labYear('Anthropic',2027).toFixed(1),unit:'GW',note:'Chart-implied · 49% of combined labs'},
    {label:'OpenAI EOY 2027',value:labYear('OpenAI',2027).toFixed(1),unit:'GW',note:'Chart-implied · 51% of combined labs'}
  ];
  const companies = data.companies.map((company) => ({
    ...company,
    color: companyColors[company.name] || "var(--benchmark)",
  }));
  const labCompanies = ['OpenAI','Anthropic'].map(name => ({name, lab:true,
    color:name==='OpenAI'?'var(--microsoft)':'var(--oracle)',
    outlook:'Approximate global compute allocation from the supplied charts. See lab estimate methodology below.',
    values:quarters.map(([q,y])=>{const s=labFleet(name,Number(y),Number(q.slice(1)));return s?.addition == null ? null : [s.addition,'implied'];})}));
  const xaiIndex=companies.findIndex(c=>c.name==='SpaceX'||c.name==='xAI');
  companies.splice(xaiIndex<0?companies.length:xaiIndex+1,0,...labCompanies);
  const rentalRates = data.rentalRates.map((item, index) => ({
    ...item,
    color: rentalColors[index % rentalColors.length],
  }));
  const agreementColors = ["var(--amazon)", "var(--microsoft)", "var(--oracle)"];
  const agreements = data.agreements.map((agreement, index) => ({
    ...agreement,
    color: agreementColors[index % agreementColors.length],
  }));
  const capacityValues = companies.flatMap((company) => company.values.filter(Boolean).map(([value]) => Number(value)));
  const maxCapacity = Math.max(2.2, ...capacityValues) * 1.05;
  const maxRental = Math.max(55, ...rentalRates.map((item) => Number(item.value))) * 1.02;

  document.querySelector("#summaryStrip").innerHTML = metrics.map((metric) => `
    <div class="metric">
      <p class="metric-label">${metric.label}</p>
      <div class="metric-value-line"><span class="metric-value">${metric.value}</span><span class="metric-unit">${metric.unit}</span></div>
      <p class="metric-note">${metric.note}</p>
    </div>`).join("");

  chartData = {quarters, companies};
  renderCapacityChart();

  document.querySelector("#outlookList").innerHTML = companies.map((company) => `
    <div class="outlook-item"><div class="outlook-company" style="color:${company.color}">${company.name}</div><div class="outlook-copy">${company.outlook}</div></div>`).join("");

  window.renderDealChart(rentalRates);

  const tableHeaders = ["", "Monthly Payment", "Capacity", "GPUs", "Term"];
  document.querySelector("#agreementsTable").innerHTML = tableHeaders.map((header) => `<div class="table-cell header">${header}</div>`).join("") + agreements.map((agreement) => `
    <div class="table-cell company" style="color:${agreement.color}">${agreement.company}</div><div class="table-cell">${agreement.payment}</div><div class="table-cell">${agreement.capacity}</div><div class="table-cell">${agreement.gpus == null ? "N/D" : `~${Number(agreement.gpus).toLocaleString()}`}</div><div class="table-cell">${agreement.term}</div>`).join("");
}

let chartData;
let capacityPeriod = 'quarterly';
let annualOverlay = true;
let qoqGrowth = false;

function annualEntry(company, year) {
  if(company.lab) {const end=labYear(company.name,Number(year)),start=labYear(company.name,Number(year)-1);return {value:end==null||start==null?null:end-start,status:'implied'};}
  const names = {Amazon:'AMZN', Google:'GOOGL', Microsoft:'MSFT', Meta:'META'};
  const kgi = window.capacityResearch.kgi.find(c => c.name === names[company.name]);
  if (kgi) return {value:kgi.additions[Number(year)-2025], status:'implied', note:'KGI full-year estimate'};
  const indices = chartData.quarters.map((q,i) => q[1] === year ? i : -1).filter(i => i >= 0);
  const values = indices.map(i => company.values[i]);
  if (indices.length !== 4 || values.some(v => !v)) return {value:null, note:'Full-year data unavailable'};
  return {value:values.reduce((s,v) => s+Number(v[0]),0), status:values.every(v => v[1] === 'reported') ? 'reported' : 'implied', note:'Sum of four workbook quarters'};
}

let capacitySource = 'kgi';
const sinopacCapacity = [
  {name:'AWS', values:[12,30], prior:'25–30', color:'var(--amazon)'},
  {name:'Azure', values:[10,26], prior:'25+', color:'var(--microsoft)'},
  {name:'GCP', values:[8,24], prior:'20', color:'var(--reflection)'},
  {name:'OCI', values:[2,12.5], prior:'7', color:'var(--oracle)'},
  {name:'Meta', values:[5,14], prior:'10–13', color:'#75618c'},
  {name:'xAI', values:[2.2,10], prior:'N/A', color:'#52677e'},
  {name:'CoreWeave', values:[0.8,8], prior:'5.5–6.5', color:'#766c48'},
  {name:'Nebius', values:[12,5], prior:'2–3', color:'#8b7080', disputed:true},
  {name:'Tesla', values:[0.5,2], prior:'2', color:'#a74549'}
];
function renderSinopacCapacity() {
  const chart=document.querySelector('#capacityChart');
  chart.classList.add('annual-mode','sinopac-mode');
  chart.classList.remove('growth-mode','cumulative-stacked','with-annual-overlay');
  chart.style.setProperty('--period-count',2);
  chart.innerHTML='<div class="quarter-header"><div></div><div class="quarter-cell"><span>2025</span><span>Source baseline</span></div><div class="quarter-cell forecast-period"><span>2030E</span><span>Cumulative capacity</span></div></div>'+sinopacCapacity.map(c=>`<div class="company-chart-group" style="--series:${c.color}"><div class="capacity-row"><div class="company-label" style="color:${c.color}">${c.name}</div>${c.values.map((v,i)=>c.disputed&&!i?'<div class="capacity-cell"><span class="capacity-empty" title="Source prints 12 GW; 1.2 GW correction unverified. Company reports 0.17 GW global active power at end-2025.">Unresolved*</span></div>':`<div class="capacity-cell${i?' estimate-cell':''}"><div class="capacity-bar" style="height:${Math.max(3,v/30*48)}px" title="${c.name}: ${v} GW${c.disputed&&!i?' — screenshot value disputed; does not reconcile to stated total':''}. Previous 2030 forecast (year-end 2025): ${c.prior} GW"><span class="bar-value">${v}${c.disputed&&!i?'*':''}</span></div></div>`).join('')}</div></div>`).join('');
  document.querySelector('.capacity-heading h2').textContent='SinoPac · Cumulative Capacity';
  document.querySelector('.capacity-heading > div > p').textContent='U.S. data-center capacity · GW · supplied 2026 estimate';
  document.querySelector('.capacity-heading .legend').innerHTML='<span>2025 baseline</span><span class="opacity-key"><i></i>2030 forecast</span>';
  document.querySelector('.chart-method').textContent='Source: user-supplied SinoPac Investment Consulting table (2026). Only 2025 and 2030 supplied; no intervening years or quarterly timing inferred. *Nebius 2025 is printed as 12 GW: not plotted because the basis is unresolved. 1.2 GW is not verified; it would sum to 41.7 GW versus the stated 43 GW. Company-reported global active power was 0.17 GW at end-2025; the 1.2 GW Missouri campus is a planned project announced in 2026. See verification below. CoreWeave 800 MW interpreted as 0.8 GW. 2030 rows sum to 131.5 GW (source rounds to 132). Hover bars for the previous 2030 forecast. Geography/power basis may differ from KGI. Summary cards and adjacent outlook remain the current model.';
}
function renderBrokerCapacity() {
  const years=[2025,2026,2027,2028,2029,2030];
  const tickers={AWS:'AMZN',GCP:'GOOGL',Azure:'MSFT',Meta:'META'};
  const chart=document.querySelector('#capacityChart');
  chart.classList.add('annual-mode','broker-paired');
  chart.classList.remove('growth-mode','cumulative-stacked','with-annual-overlay','sinopac-mode');
  chart.style.setProperty('--period-count',years.length);
  const currentYear=Number(window.capacityResearch.asOf.slice(0,4));
  const interpolate=(start,end,y)=>start+(end-start)*(y-2025)/5;
  const cells=(values,max,total=false)=>years.map((y,i)=>`<div class="capacity-cell broker-pair${y>currentYear?' estimate-cell':''}">${values[i].map((value,j)=>value===null?`<span class="broker-unavailable" title="${j?'Nebius 2025 baseline unresolved; annual path cannot be interpolated':'KGI estimate not supplied for this company/year'}">N/D</span>`:`<div class="capacity-bar" style="--series:${j?'var(--oracle)':'var(--amazon)'};height:${value/max*82}px" title="${j?'SinoPac':'KGI'} ${y}: ${formatCapacity(value)} GW${total?(j?' — nine-company source aggregate; not a sum of displayed rows':' — four-company coverage total'):''}${j&&y>2025&&y<2030?' — linear interpolation':''}"><span class="bar-value">${formatCapacity(value)}</span></div>`).join('')}</div>`).join('');
  chart.innerHTML=`<div class="quarter-header"><div></div>${years.map(y=>`<div class="quarter-cell${y>currentYear?' forecast-period':''}"><span>FY</span><span>${y}${y>currentYear?'E':''}</span></div>`).join('')}</div>`+sinopacCapacity.map(sino=>{
    const k=window.capacityResearch.kgi.find(r=>r.name===tickers[sino.name]);
    const values=years.map(y=>[k?.fleet[y-2024]??null,sino.disputed&&y!==2030?null:interpolate(sino.values[0],sino.values[1],y)]);
    return `<div class="company-chart-group" style="--series:${sino.color}"><div class="capacity-row"><div class="company-label" style="color:${sino.color}">${sino.name}${sino.disputed?'*':''}</div>${cells(values,36)}</div></div>`;
  }).join('');
  const totals=years.map(y=>[y<=2028?window.capacityResearch.kgi.reduce((sum,k)=>sum+k.fleet[y-2024],0):null,interpolate(43,132,y)]);
  chart.innerHTML+=`<div class="company-chart-group broker-total"><div class="capacity-row"><div class="company-label">Total<small>KGI: 4 companies<br>SinoPac: 9 companies<br>Separate scale: 0–140 GW</small></div>${cells(totals,140,true)}</div></div>`;
  document.querySelector('.capacity-heading h2').textContent='Annual Cumulative Fleet · KGI vs SinoPac';
  document.querySelector('.capacity-heading > div > p').textContent='Gigawatts (GW) · paired year-end capacity';
  document.querySelector('.capacity-heading .legend').innerHTML='<span><i class="legend-swatch" style="background:var(--amazon)"></i>KGI (left)</span><span><i class="legend-swatch" style="background:var(--oracle)"></i>SinoPac (right)</span><span class="opacity-key"><i></i>Future period</span>';
  document.querySelector('.chart-method').textContent='SinoPac 2026–2029 linearly interpolated between supplied 2025 and 2030 figures; not published annual forecasts. KGI covers four companies through 2028; other entries are N/D. *Nebius has an unresolved 2025 baseline, so only its 2030 target is plotted. Total uses KGI’s four-company sum versus SinoPac’s stated nine-company 43 / 132 GW aggregates, interpolated independently: it is not a like-for-like coverage comparison or a sum of displayed SinoPac rows. SinoPac’s source totals do not reconcile with the disputed 2025 rows; 2030 rows sum to 131.5 GW, rounded to 132. Total bars use a separate 0–140 GW scale; company bars share 0–36 GW. SinoPac is labeled U.S. capacity; KGI scope may differ. Summary cards and outlook retain the current model.';
}
// Jefferies Exhibit 5 (source: Jefferies, Aterio): hyperscaler planned projects vs
// JEF estimated deliveries, North America only, 2026E–2030E. Source prints MW.
let jefView = 'annual';
const jefYears = [2026,2027,2028,2029,2030];
const jefferiesCapacity = [
  {name:'Amazon', color:'var(--amazon)', planned:[1505,3337,3283,7529,6536], jef:[1505,2925,1855,1913,1913]},
  {name:'Meta', color:'var(--capacity-purple)', planned:[1653,2093,2013,1406,1432], jef:[1653,1874,1331,761,545]},
  {name:'Google', color:'var(--capacity-gold)', planned:[1099,1293,3578,4793,2659], jef:[1099,1229,2534,1492,666]},
  {name:'Microsoft', color:'var(--microsoft)', planned:[1186,767,817,4237,2473], jef:[1186,707,597,1693,944]},
  {name:'xAI', note:'SPCX in source', color:'var(--spacex)', planned:[767,880,440,0,714], jef:[767,792,220,0,393]}
];
// Printed source totals; company rows round, so these differ from row sums by ≤1 MW.
const jefferiesTotal = {planned:[6209,8370,10130,17965,13815], jef:[6209,7527,6537,5859,4461]};
function renderJefferiesCapacity() {
  const cumulative = jefView === 'cumulative';
  const toGW = values => {let run=0;return values.map(v=>{run+=v;return (cumulative?run:v)/1000;});};
  const fmt1 = v => v.toFixed(1);
  const chart = document.querySelector('#capacityChart');
  chart.classList.add('annual-mode','jef-mode');
  chart.classList.remove('growth-mode','cumulative-stacked','with-annual-overlay','sinopac-mode','broker-paired');
  chart.style.setProperty('--period-count',jefYears.length);
  const rows = jefferiesCapacity.map(c => ({...c, p:toGW(c.planned), j:toGW(c.jef)}));
  const total = {p:toGW(jefferiesTotal.planned), j:toGW(jefferiesTotal.jef)};
  const max = Math.max(...rows.flatMap(r => r.p));
  const totalMax = Math.max(...total.p);
  const cells = (r, scale, label) => jefYears.map((y,i) => {
    const share = r.p[i] ? Math.round(r.j[i]/r.p[i]*100) + '% of plan' : 'no plan';
    const bar = (v,kind) => `<div class="capacity-bar ${kind==='Planned'?'jef-planned':''}" style="height:${Math.max(v?2:0,v/scale*82)}px" title="${label} ${y}${cumulative?' cumulative':''}: ${kind} ${fmt1(v)} GW · JEF estimate = ${share}"><span class="bar-value">${fmt1(v)}</span></div>`;
    return `<div class="capacity-cell broker-pair">${bar(r.p[i],'Planned')}${bar(r.j[i],'JEF estimate')}</div>`;
  }).join('');
  chart.innerHTML = `<div class="quarter-header"><div></div>${jefYears.map(y=>`<div class="quarter-cell"><span>FY</span><span>${y}E</span></div>`).join('')}</div>`
    + rows.map(r => `<div class="company-chart-group" style="--series:${r.color}"><div class="capacity-row"><div class="company-label" style="color:${r.color}">${r.name}${r.note?`<small>${r.note}</small>`:''}</div>${cells(r,max,r.name)}</div></div>`).join('')
    + `<div class="company-chart-group broker-total" style="--series:var(--ink)"><div class="capacity-row"><div class="company-label">Total<small>5 companies<br>Separate scale</small></div>${cells(total,totalMax,'Total')}</div></div>`
    + `<div class="jef-share-row"><div>JEF ÷ planned</div>${jefYears.map((_,i)=>`<div>${Math.round(total.j[i]/total.p[i]*100)}%</div>`).join('')}</div>`;
  document.querySelector('.capacity-heading h2').textContent = cumulative ? 'Jefferies · Cumulative Planned vs Delivered' : 'Jefferies · Planned vs Delivered';
  document.querySelector('.capacity-heading > div > p').textContent = 'Gigawatts (GW) · North America · ' + (cumulative ? 'running total from 2026' : 'annual');
  document.querySelector('.capacity-heading .legend').innerHTML = '<span><i class="legend-swatch jef-planned-key"></i>Hyperscaler plan (left)</span><span><i class="legend-swatch" style="background:var(--ink)"></i>JEF estimate (right)</span>';
  document.querySelector('.chart-method').textContent = 'Source: user-supplied Jefferies Exhibit 5 (Jefferies, Aterio), North America only. Planned = projects the hyperscalers have announced; JEF estimate = what Jefferies expects to be delivered. Source prints MW; shown here ÷ 1,000 as GW. xAI is listed as SPCX in the source. Totals are the printed source totals, which differ from row sums by up to 1 MW due to rounding. ' + (cumulative ? 'Cumulative bars are running totals of 2026E–2030E deliveries, not total fleet: capacity built before 2026 is excluded.' : 'Annual bars are capacity delivered in each year.') + ' Company bars share one scale; the total row uses its own. Scope is North America, unlike KGI (global) and SinoPac (U.S.); summary cards and outlook remain the current model.';
}
// Rounded visual allocations from the supplied SemiAnalysis chart; no numeric
// y-axis is available. 2027H2 and 2028 hold the approximate 2Q27 split constant.
const labComputeEstimate = [
  {year:2025, total:18*.20, openaiShare:.58},
  {year:2026, total:37*.28, openaiShare:.55},
  {year:2027, total:80*.31, openaiShare:.51},
  {year:2028, total:115*.35, openaiShare:.51}
];
function labYear(name,year) {
  const r=labComputeEstimate.find(r=>r.year===year);
  return r ? r.total*(name==='OpenAI'?r.openaiShare:1-r.openaiShare) : null;
}
function labFleet(name,year,quarter=4) {
  const end=labYear(name,year), start=labYear(name,year-1);
  if(end==null || (start==null && quarter!==4)) return null;
  if(start==null) return {total:end,opening:null,addition:null};
  return {total:start+(end-start)*quarter/4,opening:start+(end-start)*(quarter-1)/4,addition:(end-start)/4};
}
function renderCapacityChartBase() {
  if (!chartData) return;
  const sino=capacitySource==='sinopac';
  const compare=capacitySource==='compare';
  const jef=capacitySource==='jefferies';
  document.querySelector('#capacityChart').classList.remove('broker-paired','sinopac-mode','jef-mode');
  document.querySelector('#compareSource').setAttribute('aria-pressed',String(compare));
  document.querySelector('#kgiSource').setAttribute('aria-pressed',String(!sino && !compare && !jef));
  document.querySelector('#sinopacSource').setAttribute('aria-pressed',String(sino));
  document.querySelector('#jefferiesSource').setAttribute('aria-pressed',String(jef));
  document.querySelector('#jefViewButtons').hidden=!jef;
  document.querySelector('#periodButtons').hidden=jef;
  ['annualOverlay','qoqGrowth'].forEach(id=>{document.querySelector('#'+id).closest('label').hidden=jef;});
  document.querySelectorAll('#jefViewButtons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.jefView===jefView)));
  ['quarterlyView','annualView','annualOverlay','qoqGrowth'].forEach(id=>{document.querySelector('#'+id).disabled=sino || compare || jef;});
  if(sino || compare || jef) {
    document.querySelector('#quarterlyView').setAttribute('aria-pressed','false');
    document.querySelector('#annualView').setAttribute('aria-pressed','true');
    if(jef) renderJefferiesCapacity(); else if(compare) renderBrokerCapacity(); else renderSinopacCapacity(); return;
  }
  const {quarters, companies} = chartData;
  const years = [...new Set(quarters.map(q => q[1]))];
  const annual = capacityPeriod === 'annual';
  const periods = annual ? years.map(y => ['FY', y]) : quarters;
  const entries = company => annual ? years.map(y => {const e=annualEntry(company,y); return e.value == null ? null : [e.value,e.status];}) : company.values;
  const growth = qoqGrowth && !annual;
  const stacked = annualOverlay && !growth;
  const ticker = {Amazon:'AMZN', Google:'GOOGL', Microsoft:'MSFT', Meta:'META'};
  function stackEntry(c, i) {
    if(c.lab) {
      const [q,y]=periods[i];const s=labFleet(c.name,Number(y),q==='FY'?4:Number(q.slice(1)));
      if(s && annual && s.opening!=null) {s.opening=labYear(c.name,Number(y)-1);s.addition=s.total-s.opening;}
      return s;
    }
    const kgi = window.capacityResearch.kgi.find(r => r.name === ticker[c.name]);
    if (annual) {
      const year = Number(years[i]);
      if (kgi) {
        const y = year - 2024;
        if (y < 1 || y >= kgi.fleet.length) return null;
        return {opening:kgi.fleet[y-1], addition:kgi.fleet[y]-kgi.fleet[y-1], total:kgi.fleet[y]};
      }
      if (!['Oracle','SpaceX'].includes(c.name)) return null;
      const sum = predicate => c.values.reduce((total,e,j)=>total+(e && predicate(Number(quarters[j][1])) ? Number(e[0]) : 0),0);
      const opening = sum(y=>y<year), addition = sum(y=>y===year);
      return {opening, addition, total:opening+addition};
    }

    if (!kgi) {
      if (!['Oracle','SpaceX'].includes(c.name)) return null;
      // User-defined zero baseline at the start of the displayed timeline.
      // Missing quarters add zero to this tracked series, not a claim of no real buildout.
      const opening = c.values.slice(0,i).reduce((s,e)=>s+(e ? Number(e[0]) : 0),0);
      const addition = c.values[i] ? Number(c.values[i][0]) : 0;
      return {opening, addition, total:opening+addition, missing:!c.values[i]};
    }
    const [quarter, year] = quarters[i];
    const y = Number(year)-2024, q = Number(quarter.slice(1));
    if (y < 1 || y >= kgi.fleet.length) return null;
    const addition = (kgi.fleet[y]-kgi.fleet[y-1])/4;
    return {opening:kgi.fleet[y-1]+addition*(q-1), addition, total:kgi.fleet[y-1]+addition*q};
  }
  function growthEntry(c, i) {
    const fleet = stackEntry(c, i);
    if (!fleet || fleet.opening <= 0 || fleet.missing) return null;
    return fleet.addition / fleet.opening * 100;
  }
  const growthMax = Math.max(1,...companies.flatMap(c=>periods.map((_,i)=>Math.abs(growthEntry(c,i)||0))));
  const max = Math.max(2.2,...companies.flatMap(c => entries(c).map((e,i) => stacked ? (stackEntry(c,i)?.total || 0) : (e ? Number(e[0]) : 0))))*1.05;
  const chart = document.querySelector('#capacityChart');
  chart.classList.toggle('annual-mode',annual);
  chart.classList.toggle('with-annual-overlay',false);
  chart.classList.toggle('cumulative-stacked',stacked);
  chart.classList.toggle('growth-mode',growth);
  chart.style.setProperty('--period-count',periods.length);
  const asOf = new Date(window.capacityResearch.asOf + 'T12:00:00');
  const currentYear = asOf.getFullYear(), currentQuarter = Math.floor(asOf.getMonth()/3)+1;
  const futurePeriod = ([q,y]) => Number(y)>currentYear || (Number(y)===currentYear && (q==='FY' ? false : Number(q.slice(1))>currentQuarter));
  chart.innerHTML = `<div class="quarter-header"><div></div>${periods.map(([q,y])=>`<div class="quarter-cell ${futurePeriod([q,y]) ? 'forecast-period' : ''}"><span>${q}</span><span>${y}${futurePeriod([q,y]) ? 'E' : ''}</span></div>`).join('')}</div>` + companies.map(c => {
    const bars=entries(c).map((entry,i)=> {
      // Visual treatment follows the user-requested time cutoff, independent of source status.
      const estimated = futurePeriod(periods[i]);
      const estimateClass = estimated ? ' estimate-cell' : '';

      if (growth) {
        const value = growthEntry(c,i);
        if (value == null) return `<div class="capacity-cell${estimateClass}"><span class="capacity-empty">N/D</span></div>`;
        const label = (value > 0 ? '+' : '') + formatCapacity(value) + '%';
        return `<div class="growth-cell${estimateClass}"><div class="growth-zero"></div><div class="growth-bar ${value<0?'negative':''}" style="height:${Math.abs(value)/growthMax*36}px" title="${c.name} ${periods[i].join(' ')}: cumulative fleet growth ${label}"></div><span class="growth-label ${value<0?'negative':''}">${label}</span></div>`;
      }
      if (stacked) {
        const s = stackEntry(c,i);
        if (!s) return `<div class="capacity-cell${estimateClass}"><span class="capacity-empty" title="Opening fleet not available">N/D</span></div>`;
        if(c.lab && s.opening==null) return `<div class="capacity-cell${estimateClass}"><div class="capacity-bar implied" style="height:${s.total/max*92}px" title="${c.name}: estimated year-end capacity; prior-year baseline unavailable"><span class="bar-value">~${formatCapacity(s.total)}</span></div></div>`;
        return `<div class="capacity-cell${estimateClass}"><div class="fleet-stack" style="height:${s.total/max*92}px" title="${c.name} ${periods[i].join(' ')}: opening ${formatCapacity(s.opening)} + addition ${formatCapacity(s.addition)} = ${formatCapacity(s.total)} GW"><span class="bar-value">${formatCapacity(s.total)}</span><div class="fleet-addition" style="min-height:0;height:${s.total ? s.addition/s.total*100 : 0}%"></div><div class="fleet-opening" style="height:${s.total ? s.opening/s.total*100 : 0}%"></div></div></div>`;
      }
      if(!entry) return `<div class="capacity-cell${estimateClass}"><span class="capacity-empty">N/D</span></div>`;
      const [v,status]=entry;
      return `<div class="capacity-cell${estimateClass}"><div class="capacity-bar ${status==='implied'?'implied':''}" style="height:${Math.max(7,Number(v)/max*48)}px" data-tooltip="${c.name}: ${formatCapacity(v)} GW, ${status}, ${periods[i].join(' ')}"><span class="bar-value">${formatCapacity(v)}</span></div></div>`;
    }).join('');
    const overlay='';
    return `<div class="company-chart-group" style="--series:${c.color}"><div class="capacity-row"><div class="company-label" style="color:${c.color}">${c.name}</div>${bars}</div>${overlay}</div>`;
  }).join('');
  document.querySelector('.capacity-heading h2').textContent=annual?(stacked?'Cumulative Fleet + Annual Additions':'Annual Capacity Additions'):growth?'QoQ Growth in Cumulative Fleet':stacked?'Cumulative Fleet + Quarterly Additions':'Quarterly Capacity Build Rate';
  document.querySelector('#quarterlyView').setAttribute('aria-pressed',String(!annual));
  document.querySelector('#annualView').setAttribute('aria-pressed',String(annual));
  document.querySelector('#annualOverlay').disabled=growth;
  document.querySelector('#qoqGrowth').disabled=annual;
  document.querySelector('.capacity-heading > div > p').textContent=growth?'Change in cumulative fleet (%)':'Gigawatts (GW)';
  document.querySelector('.capacity-heading .legend').innerHTML = growth ? '<span>Quarter addition ÷ opening fleet</span>' : stacked ? '<span><i class="legend-swatch fleet-base"></i>Opening fleet</span><span><i class="legend-swatch reported"></i>'+ (annual?'Year addition':'Quarter addition') +'</span>' : '<span><i class="legend-swatch reported"></i>Reported</span><span><i class="legend-swatch implied"></i>Estimated</span>';
  document.querySelector('.capacity-heading .legend').insertAdjacentHTML('beforeend','<span class="opacity-key"><i></i>Translucent = future period</span>');
  document.querySelector('.chart-method').textContent=growth ? 'QoQ fleet growth = quarterly addition ÷ opening fleet × 100, equivalent to ending fleet ÷ prior-quarter ending fleet − 1. Uses the same KGI fleet-change allocation as the stacked bars. Quarterly timing is assumed. Oracle / SpaceX use a user-defined zero start; missing quarters carry forward tracked capacity. Growth from zero or for a missing addition is N/D.' : stacked && annual ? 'Stack = opening fleet + annual fleet increase; labels show year-end cumulative GW. KGI increases use year-end fleet differences, which can differ from the separate additions table. Oracle / SpaceX accumulate recorded additions from the zero baseline; missing periods carry forward. These are tracked additions, not total company fleets.' : stacked ? 'Stack = opening fleet + quarterly addition; labels show cumulative GW. To reconcile to KGI year-end fleet, additions here equal the annual fleet change ÷ 4 (some differ from KGI’s separate additions table). Quarterly timing is assumed. Oracle / SpaceX start at zero and accumulate recorded additions; missing quarters carry forward. These are tracked additions, not total company fleets.' : annual ? 'KGI: full-year annual additions as supplied. Oracle / SpaceX: sum of four available workbook quarters; incomplete years are N/D. Annual additions differ from fleet changes in some KGI years—see reconciliation below.' : 'KGI bars: annual additions ÷ 4, a flat allocation—not commissioning dates. Annual labels show full-year totals (including 2025, although only Q3–Q4 are displayed). Oracle / SpaceX retain workbook assumptions; incomplete annual totals are N/D.';
}
function renderCapacityChart() {
  renderCapacityChartBase();
  if(!chartData) return;
  const chart=document.querySelector('#capacityChart');
  const groups=()=>[...chart.querySelectorAll('.company-chart-group')];
  if(capacitySource==='jefferies') {
    // Jefferies covers hyperscaler builds only; lab rows are not part of its exhibit.
  } else if(capacitySource!=='kgi') {
    const years=capacitySource==='sinopac'?[2025,2030]:[2025,2026,2027,2028,2029,2030];
    const anchor=groups().find(g=>g.querySelector('.company-label')?.textContent==='xAI');
    const scale=capacitySource==='sinopac'?48/30:82/36;
    const rows=['OpenAI','Anthropic'].map(name=>`<div class="company-chart-group lab-estimate" style="--series:${name==='OpenAI'?'var(--microsoft)':'var(--oracle)'}"><div class="capacity-row"><div class="company-label">${name}<small>Implied · global</small></div>${years.map(year=>{const v=labYear(name,year);return v==null?'<div class="capacity-cell"><span class="capacity-empty" title="No supplied combined forecast after 2028">N/D</span></div>':`<div class="capacity-cell${year>2026?' estimate-cell':''}"><div class="capacity-bar implied" style="height:${v*scale}px" title="${name} ${year}: approximate allocation from supplied charts, ${formatCapacity(v)} GW; independent of broker estimates"><span class="bar-value">~${formatCapacity(v)}</span></div></div>`;}).join('')}</div></div>`).join('');
    if(anchor) anchor.insertAdjacentHTML('afterend',rows);
  } else {
    for(const g of groups()) {
      const label=g.querySelector('.company-label');
      if(label.textContent==='SpaceX') label.textContent='xAI';
      if(['OpenAI','Anthropic'].includes(label.textContent)) {
        g.classList.add('lab-estimate');
        label.insertAdjacentHTML('beforeend','<small>Implied · global</small>');
        g.querySelectorAll('.bar-value,.growth-label').forEach(v=>{if(!v.textContent.startsWith('~'))v.textContent='~'+v.textContent;});
      }
    }
  }
  let notes=document.querySelector('#labEstimateNotes');
  if(!notes) {
    document.querySelector('.chart-method').insertAdjacentHTML('afterend','<details id="labEstimateNotes" class="chart-method"><summary>OpenAI &amp; Anthropic · estimate methodology</summary><p>Combined GW uses the supplied Altimeter chart: 3.60 / 10.36 / 24.80 / 40.25 for 2025–2028. OpenAI / Anthropic allocations are 58/42, 55/45, 51/49 and 51/49. The supplied SemiAnalysis Tokenomics chart suggests OpenAI leads and the gap narrows by 2Q27. These rounded visual allocations assume a common linear, zero-based scale; its unlabeled y-axis does not establish exact GW ratios. Different hardware efficiencies add uncertainty.</p><p>The 2Q27 split is held through 2028. Quarterly capacity is linearly interpolated between year-end estimates. Annual additions are changes in estimated year-end capacity. Earlier quarterly points and 2029–2030 are unavailable. Lab access overlaps provider fleets and is excluded from provider totals. Global lab scope differs from SinoPac’s U.S. scope. Existing lab scenarios further down the page use their own delivery assumptions.</p><p>Public disclosures provide context for the buildout: <a href="https://openai.com/index/five-new-stargate-sites/" target="_blank" rel="noopener">OpenAI: nearly 7 GW planned Stargate capacity (Sep 2025)</a>; <a href="https://www.anthropic.com/news/anthropic-amazon-compute" target="_blank" rel="noopener">Anthropic / AWS: up to 5 GW, nearly 1 GW by end-2026 (Apr 2026)</a>; <a href="https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services" target="_blank" rel="noopener">Anthropic / Google: over 1 GW expected in 2026 (Oct 2025)</a>. These are overlapping plans with different delivery dates and do not provide comparable installed totals. The split is a modeling assumption informed by the supplied chart; disclosed commitments are not summed to calculate it.</p></details>');
  }
}
document.querySelector('#kgiSource').addEventListener('click',()=>{capacitySource='kgi';renderCapacityChart();});
document.querySelector('#compareSource').addEventListener('click',()=>{capacitySource='compare';capacityPeriod='annual';renderCapacityChart();});
document.querySelector('#sinopacSource').addEventListener('click',()=>{capacitySource='sinopac';renderCapacityChart();});
document.querySelector('#jefferiesSource').addEventListener('click',()=>{capacitySource='jefferies';renderCapacityChart();});
document.querySelectorAll('#jefViewButtons button').forEach(b=>b.addEventListener('click',()=>{jefView=b.dataset.jefView;renderCapacityChart();}));
document.querySelector('#quarterlyView').addEventListener('click',()=>{capacityPeriod='quarterly';renderCapacityChart();});
document.querySelector('#annualView').addEventListener('click',()=>{capacityPeriod='annual';renderCapacityChart();});
document.querySelector('#qoqGrowth').addEventListener('change',e=>{qoqGrowth=e.target.checked;renderCapacityChart();});
document.querySelector('#annualOverlay').addEventListener('change',e=>{annualOverlay=e.target.checked;renderCapacityChart();});

renderDashboard(window.capacityWorkbook);
