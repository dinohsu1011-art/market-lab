const companyColors = {
  Amazon: "var(--amazon)",
  Google: "var(--capacity-gold)",
  Meta: "var(--capacity-purple)",
  Microsoft: "var(--microsoft)",
  Oracle: "var(--oracle)",
  SpaceX: "var(--spacex)",
  OpenAI: "var(--openai)",
  Anthropic: "var(--anthropic)",
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
    outlook: `KGI: ${c.fleet[3]} GW fleet at end-2027; +${c.additions[2]} GW in 2027. Quarterly additions = annual additions ÷ 4.`,
    values: quarters.map(([,year]) => {
      const i = Number(year) - 2025;
      return i >= 0 && i < c.additions.length ? [c.additions[i] / 4, 'implied'] : null;
    })
  }));
  data = {...data, companies: [...kgiCompanies, ...data.companies.filter(c => !['Amazon','Microsoft','Google','Meta'].includes(c.name)).map(c => ({...c, outlook: (c.name === 'Oracle' ? 'Q2 / Q3 2026: 0.30 / 0.85 GW reported (user updates, Sep 11). ' : 'Prior workbook: ') + c.outlook}))]};
  const companies = data.companies.map((company) => ({
    ...company,
    color: companyColors[company.name] || "var(--benchmark)",
  }));
  const labCompanies = ['OpenAI','Anthropic'].map(name => ({name, lab:true, color:companyColors[name],
    outlook:'Approximate global compute allocation from the supplied charts. See lab estimate methodology under the capacity figures.',
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

  chartData = {quarters, companies};
  renderCapacityChart();

  document.querySelector("#outlookList").innerHTML = companies.map((company) => `
    <div class="outlook-item"><div class="outlook-company" style="color:${company.color}">${company.name === 'SpaceX' ? 'xAI' : company.name}</div><div class="outlook-copy">${company.outlook}</div></div>`).join("");

  window.renderDealChart(rentalRates);

  const tableHeaders = ["", "Monthly Payment", "Capacity", "GPUs", "Term"];
  document.querySelector("#agreementsTable").innerHTML = tableHeaders.map((header) => `<div class="table-cell header">${header}</div>`).join("") + agreements.map((agreement) => `
    <div class="table-cell company" style="color:${agreement.color}">${agreement.company}</div><div class="table-cell">${agreement.payment}</div><div class="table-cell">${agreement.capacity}</div><div class="table-cell">${agreement.gpus == null ? "N/D" : `~${Number(agreement.gpus).toLocaleString()}`}</div><div class="table-cell">${agreement.term}</div>`).join("");
}

let chartData;
// Capacity chart: every company on one shared GW axis (chart kit in market-lab-capacity-comps.js).
const capacityState = {source: 'kgi', period: 'quarterly', measure: 'fleet', compareYear: '2027', jefView: 'annual', jefMeasure: 'jef',
  hidden: new Set(), sinoHidden: new Set(), compareHidden: new Set(), jefHidden: new Set(), plansHidden: new Set()};
const capacityTicker = {Amazon: 'AMZN', Google: 'GOOGL', Microsoft: 'MSFT', Meta: 'META'};
const gw = (v, long) => v == null ? '–' : (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(long ? 2 : 1)) + ' GW';
const gwCell = v => formatCapacity(v.toFixed(2));
const displayName = name => name === 'SpaceX' ? 'xAI' : name;

const sinopacCapacity = [
  {name:'AWS', values:[12,30], prior:'25–30', color:'var(--amazon)', kgi:'AMZN'},
  {name:'Azure', values:[10,26], prior:'25+', color:'var(--microsoft)', kgi:'MSFT'},
  {name:'GCP', values:[8,24], prior:'20', color:'var(--capacity-gold)', kgi:'GOOGL'},
  {name:'OCI', values:[2,12.5], prior:'7', color:'var(--oracle)'},
  {name:'Meta', values:[5,14], prior:'10–13', color:'var(--capacity-purple)', kgi:'META'},
  {name:'xAI', values:[2.2,10], prior:'N/A', color:'var(--spacex)'},
  {name:'Tesla', values:[0.5,2], prior:'2', color:'var(--tesla)'},
  {name:'CoreWeave', short:'CRWV', values:[0.8,8], prior:'5.5–6.5', color:'var(--coreweave)'},
  {name:'Nebius', short:'NBIS', values:[12,5], prior:'2–3', color:'var(--nebius)', disputed:true}
];

// Jefferies Exhibit 5 (source: Jefferies, Aterio): hyperscaler planned projects vs
// JEF estimated deliveries, North America only, 2026E–2030E. Source prints MW.
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
// Hyperscaler plans (Jefferies Exhibit 5 "planned" rows, North America) vs SinoPac
// (U.S.): capacity added 2026E–2030E. SinoPac adds = its 2030 total − its 2025 total.
const plansVsSinopac = [
  {name:'Amazon', sino:'AWS', color:'var(--amazon)'},
  {name:'Google', sino:'GCP', color:'var(--capacity-gold)'},
  {name:'Microsoft', sino:'Azure', color:'var(--microsoft)', note:'Rents much of its capacity; rented sites are not in the plan list'},
  {name:'Meta', sino:'Meta', color:'var(--capacity-purple)'}
];
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
// Plain statement of which figures the current view plots, shown with the capacity figures.
function setSourceKey(items) {
  document.querySelector('#sourceKey').innerHTML = items.map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function setCapacityText(sub, tableSub, method) {
  const panel = document.querySelector('#capacityPanel');
  panel.querySelector('.panel-heading p').textContent = sub;
  document.querySelector('#capacityTableSub').textContent = tableSub;
  document.querySelector('#capacityMethod').textContent = method;
}

// A period counts as an estimate when it ends after the KGI note date.
function capacityCutoff() { return new Date(window.capacityResearch.asOf + 'T12:00:00'); }
const quarterEnd = (q, y) => new Date(Number(y), Number(q.slice(1)) * 3, 0, 12);
const yearEnd = y => new Date(Number(y), 11, 31, 12);
const kgiFor = c => window.capacityResearch.kgi.find(r => r.name === capacityTicker[c.name]);

function fleetQuarter(c, i) {
  const [quarter, year] = chartData.quarters[i];
  if (c.lab) return labFleet(c.name, Number(year), Number(quarter.slice(1)));
  const kgi = kgiFor(c);
  if (!kgi) {
    // Oracle / xAI: user-defined zero baseline at the start of the timeline.
    // Missing quarters add zero to this tracked series, not a claim of no real buildout.
    const opening = c.values.slice(0, i).reduce((s, e) => s + (e ? Number(e[0]) : 0), 0);
    const addition = c.values[i] ? Number(c.values[i][0]) : 0;
    return {opening, addition, total: opening + addition, missing: !c.values[i]};
  }
  const y = Number(year) - 2024, q = Number(quarter.slice(1));
  if (y < 1 || y >= kgi.fleet.length) return null;
  const addition = (kgi.fleet[y] - kgi.fleet[y - 1]) / 4;
  return {opening: kgi.fleet[y - 1] + addition * (q - 1), addition: kgi.additions[y - 1] / 4, total: kgi.fleet[y - 1] + addition * q};
}

function fleetYear(c, year) {
  if (c.lab) {
    const total = labYear(c.name, Number(year)), opening = labYear(c.name, Number(year) - 1);
    return total == null ? null : {opening, total, addition: opening == null ? null : total - opening};
  }
  const kgi = kgiFor(c);
  if (kgi) {
    const y = Number(year) - 2024;
    if (y < 1 || y >= kgi.fleet.length) return null;
    return {opening: kgi.fleet[y - 1], total: kgi.fleet[y], addition: kgi.additions[y - 1]};
  }
  const {quarters} = chartData;
  if (!quarters.some(q => q[1] === year)) return null;
  const sum = test => c.values.reduce((t, e, j) => t + (e && test(Number(quarters[j][1])) ? Number(e[0]) : 0), 0);
  const opening = sum(y => y < Number(year)), inYear = sum(y => y === Number(year));
  const full = quarters.filter(q => q[1] === year).length === 4 && quarters.every((q, j) => q[1] !== year || c.values[j]);
  return {opening, total: opening + inYear, addition: full ? inYear : null};
}

function capacityRows() {
  const {quarters, companies} = chartData;
  const cutoff = capacityCutoff();
  const annual = capacityState.period === 'annual';
  const periods = annual
    ? ['2025', '2026', '2027', '2028'].map(y => ({key: y, label: y + (yearEnd(y) > cutoff ? 'E' : ''), title: `Year-end ${y}${yearEnd(y) > cutoff ? ' (estimate)' : ''}`, estimate: yearEnd(y) > cutoff}))
    : quarters.map(([q, y]) => ({key: `${y} ${q}`, label: q, year: y, title: `${q} ${y}${quarterEnd(q, y) > cutoff ? ' (estimate)' : ''}`, estimate: quarterEnd(q, y) > cutoff}));
  const rows = companies.map(c => ({name: displayName(c.name), lab: c.lab, color: c.color, cells: periods.map((p, i) => {
    const f = annual ? fleetYear(c, p.key) : fleetQuarter(c, i);
    if (!f) return null;
    const addition = f.missing ? null : f.addition;
    const growth = f.opening > 0 && !f.missing ? (f.total / f.opening - 1) * 100 : null;
    return {fleet: f.total, addition: Number.isFinite(addition) ? addition : null, growth, e: p.estimate};
  })}));
  return {periods, rows, annual};
}

const SOURCES = [['kgi', 'KGI model'], ['sinopac', 'SinoPac'], ['compare', 'KGI vs SinoPac'], ['jefferies', 'Jefferies'], ['plans', 'Plans vs SinoPac']];
function capacityControls(panel) {
  const {source} = capacityState;
  const set = (key, value) => { capacityState[key] = value; renderCapacityChart(); };
  const ctl = name => panel.querySelector(`[data-ctl=${name}]`);
  CompChart.segmented(ctl('source'), SOURCES, source, v => set('source', v));
  ctl('period').hidden = !['kgi', 'jefferies'].includes(source);
  ctl('measure').hidden = !['kgi', 'jefferies'].includes(source);
  ctl('year').hidden = source !== 'compare';
  if (source === 'kgi') {
    CompChart.segmented(ctl('period'), [['quarterly', 'Quarterly'], ['annual', 'Annual']], capacityState.period, v => set('period', v));
    CompChart.segmented(ctl('measure'), [['fleet', 'Total fleet'], ['additions', 'Additions'], ['growth', capacityState.period === 'annual' ? 'YoY growth' : 'QoQ growth']], capacityState.measure, v => set('measure', v));
  } else if (source === 'jefferies') {
    CompChart.segmented(ctl('period'), [['annual', 'Each year'], ['cumulative', 'Running total']], capacityState.jefView, v => set('jefView', v));
    CompChart.segmented(ctl('measure'), [['jef', 'JEF estimate'], ['plan', 'Announced plan'], ['both', 'JEF vs plan'], ['share', 'JEF ÷ plan']], capacityState.jefMeasure, v => set('jefMeasure', v));
  } else if (source === 'compare') {
    CompChart.segmented(ctl('year'), ['2025', '2026', '2027', '2028', '2029', '2030'].map(y => [y, y + (yearEnd(y) > capacityCutoff() ? 'E' : '')]), capacityState.compareYear, v => set('compareYear', v));
  }
}

function renderCapacityChart() {
  if (!chartData) return;
  const panel = document.querySelector('#capacityPanel');
  capacityControls(panel);
  document.querySelector('#labEstimateNotes').hidden = capacityState.source !== 'kgi';
  const render = {kgi: renderKgiCapacity, sinopac: renderSinopacCapacity, compare: renderBrokerCapacity, jefferies: renderJefferiesCapacity, plans: renderPlansVsSinopac}[capacityState.source];
  render(panel);
}

function renderKgiCapacity(panel) {
  const {periods, rows, annual} = capacityRows();
  const {measure} = capacityState;
  const pick = {fleet: 'fleet', additions: 'addition', growth: 'growth'}[measure];
  const fmt = measure === 'growth' ? (v, long) => CompChart.fmtPct(v, long ? 1 : 0) : gw;
  const labNote = 'Implied from Altimeter and SemiAnalysis charts';
  const series = rows.map(r => ({name: r.name, color: r.color, points: r.cells.map(c => c && c[pick] != null ? {v: c[pick], e: c.e, note: r.lab ? labNote : ''} : null)}));
  CompChart.legend(panel.querySelector('.comp-legend'), series, capacityState.hidden, renderCapacityChart);
  const host = panel.querySelector('.comp-chart');
  const axisFmt = v => measure === 'growth' ? v + '%' : v + ' GW';
  if (annual && measure === 'additions') {
    CompChart.columnChart(host, {label: 'Annual capacity additions', groups: periods.map(p => ({label: p.label, title: p.title, estimate: p.estimate})), series: series.map(s => ({...s, values: s.points})), hidden: capacityState.hidden, fmt: gw, labelFmt: v => formatCapacity(v.toFixed(1)), axisFmt});
  } else {
    CompChart.lineChart(host, {label: 'Data center capacity', periods, series, hidden: capacityState.hidden, fmt, axisFmt});
  }
  const heading = {fleet: 'Total fleet', additions: 'Capacity added', growth: 'Fleet growth'}[measure];
  setCapacityText(
    `${heading}, ${measure === 'growth' ? (annual ? 'year-over-year %' : 'quarter-over-quarter %') : 'GW'}, ${annual ? 'by year' : 'by quarter'}`,
    `KGI model, ${annual ? 'by year' : 'by quarter'}`,
    (measure === 'additions'
      ? (annual ? 'KGI annual additions are used as supplied; they differ from year-end fleet changes in some years. ' : 'KGI quarterly additions are annual additions ÷ 4, a flat split, not commissioning dates. ')
      : 'KGI fleet steps evenly through each year to match its year-end totals. ')
    + 'Oracle and xAI start at zero in Q3 2025 and add tracked workbook additions, so they are not whole-company fleets. OpenAI and Anthropic are implied from charts and overlap provider fleets. Periods ending after the KGI note date (Sep 11, 2026) are estimates.');
  const cols = CompChart.dividerFlags(periods.map(p => ({label: annual ? p.label : `${p.label} '${p.year.slice(2)}`, estimate: p.estimate})));
  CompChart.figuresTable(document.querySelector('#capacityTable'), {caption: 'Company', columns: cols, rowGroups: rows.map(r => ({
    name: r.name + (r.lab ? ' ~' : ''), color: r.color, rows: [
      {label: 'Fleet GW', fmt: gwCell, cells: r.cells.map(c => c && {v: c.fleet, e: c.e})},
      {label: 'Added GW', fmt: gwCell, cells: r.cells.map(c => c && c.addition != null ? {v: c.addition, e: c.e} : null)},
      {label: annual ? 'YoY' : 'QoQ', fmt: v => CompChart.fmtPct(v, 0), cells: r.cells.map(c => c && c.growth != null ? {v: c.growth, e: c.e} : null)},
    ]}))});
  setSourceKey([
    ['Source', 'KGI for Amazon, Google, Microsoft and Meta. Your workbook (company disclosures) for Oracle and xAI. OpenAI and Anthropic (~) implied from Altimeter and SemiAnalysis charts.'],
    ['Region', 'Global'],
    ['Years', annual ? '2025 to 2028E' : `${periods[0].label} ${periods[0].year} to ${periods.at(-1).label} ${periods.at(-1).year}E`]
  ]);
}

function renderSinopacCapacity(panel) {
  const plotted = sinopacCapacity.map(c => ({...c, base: c.disputed ? null : c.values[0]}));
  const series = [
    {name: '2025 baseline', color: 'var(--ml-muted)', values: plotted.map(c => c.base == null ? null : {v: c.base, e: false, color: c.color})},
    {name: '2030 forecast', color: 'var(--ml-muted)', hatch: true, values: plotted.map(c => ({v: c.values[1], e: true, color: c.color, note: `Prior 2030 forecast: ${c.prior} GW`}))},
  ];
  CompChart.legend(panel.querySelector('.comp-legend'), series, capacityState.sinoHidden, renderCapacityChart);
  CompChart.columnChart(panel.querySelector('.comp-chart'), {label: 'SinoPac cumulative capacity', groups: plotted.map(c => ({label: (c.short || c.name) + (c.disputed ? '*' : ''), title: c.name})), series, hidden: capacityState.sinoHidden, fmt: gw, labelFmt: v => formatCapacity(v), axisFmt: v => v + ' GW'});
  setCapacityText('SinoPac, U.S. capacity in place, GW, 2025 vs 2030', 'SinoPac, 2025 and 2030 only',
    'User-supplied SinoPac table (2026). Only 2025 and 2030 are given, so no in-between years or quarterly timing is inferred. *Nebius 2025 prints as 12 GW and is not plotted: its basis is unresolved (the company reported 0.17 GW active power at end-2025; a 1.2 GW reading would sum to 41.7 GW against the stated 43 GW). CoreWeave 800 MW read as 0.8 GW. Hover a column for the prior 2030 forecast.');
  const cagr = c => c.base ? {v: ((c.values[1] / c.base) ** (1 / 5) - 1) * 100, e: true} : null;
  CompChart.figuresTable(document.querySelector('#capacityTable'), {caption: 'Company', columns: [{label: '2025'}, {label: '2030E', estimate: true, divider: true}, {label: 'Prior 2030E', estimate: true}, {label: "CAGR '25 to '30", estimate: true}], rowGroups: plotted.map(c => ({
    name: c.name, color: c.color, rows: [{label: 'GW', fmt: v => formatCapacity(v), cells: [c.base == null ? (c.disputed ? {v: 12, text: '12*'} : null) : {v: c.base}, {v: c.values[1], e: true}, {v: 1, e: true, text: c.prior}, cagr(c) && {...cagr(c), text: CompChart.fmtPct(cagr(c).v, 0)}]}],
  }))});
  setSourceKey([
    ['Source', 'SinoPac Investment Consulting (2026). 2030 rows sum to 131.5 GW; the source rounds to 132.'],
    ['Region', 'United States'],
    ['Years', '2025 and 2030E only']
  ]);
}

function renderBrokerCapacity(panel) {
  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];
  const cutoff = capacityCutoff();
  const pairs = sinopacCapacity.filter(s => s.kgi);
  const kgiFleet = (s, y) => { const k = window.capacityResearch.kgi.find(r => r.name === s.kgi); return k?.fleet[Number(y) - 2024] ?? null; };
  const sino = (s, y) => s.values[0] + (s.values[1] - s.values[0]) * (Number(y) - 2025) / 5;
  const est = y => yearEnd(y) > cutoff;
  const y = capacityState.compareYear;
  const series = [
    {name: 'KGI', color: 'var(--broker-a)', values: pairs.map(s => kgiFleet(s, y) == null ? null : {v: kgiFleet(s, y), e: est(y)})},
    {name: 'SinoPac', color: 'var(--broker-b)', values: pairs.map(s => ({v: sino(s, y), e: est(y), note: y > '2025' && y < '2030' ? 'Straight line between 2025 and 2030' : ''}))},
  ];
  CompChart.legend(panel.querySelector('.comp-legend'), series, capacityState.compareHidden, renderCapacityChart);
  CompChart.columnChart(panel.querySelector('.comp-chart'), {label: 'KGI vs SinoPac fleet', groups: pairs.map(s => ({label: s.name, title: `${s.name}, year-end ${y}`, estimate: est(y)})), series, hidden: capacityState.compareHidden, fmt: gw, labelFmt: v => formatCapacity(v.toFixed(1)), axisFmt: v => v + ' GW'});
  setCapacityText(`KGI vs SinoPac, capacity in place at year-end ${y}, GW`, 'KGI vs SinoPac, year-end capacity in place',
    'SinoPac 2026 to 2029 is a straight line between its 2025 and 2030 figures, not a published path. KGI stops at 2028. Totals cover different company sets (KGI 4, SinoPac 9), so they are not like-for-like. Nebius has an unresolved 2025 baseline and is not in the SinoPac total check.');
  const cols = CompChart.dividerFlags(years.map(yr => ({label: yr + (est(yr) ? 'E' : ''), estimate: est(yr)})));
  const one = v => formatCapacity(v.toFixed(1));
  const rowGroups = pairs.map(s => ({name: s.name, color: s.color, rows: [
    {label: 'KGI', fmt: one, cells: years.map(yr => kgiFleet(s, yr) == null ? null : {v: kgiFleet(s, yr), e: est(yr)})},
    {label: 'SinoPac', fmt: one, cells: years.map(yr => ({v: sino(s, yr), e: est(yr)}))},
  ]}));
  rowGroups.push({name: 'Total', color: 'var(--ml-ink)', rows: [
    {label: 'KGI, 4 cos', fmt: one, cells: years.map(yr => yr <= '2028' ? {v: window.capacityResearch.kgi.reduce((t, k) => t + k.fleet[Number(yr) - 2024], 0), e: est(yr)} : null)},
    {label: 'SinoPac, 9 cos', fmt: one, cells: years.map(yr => ({v: 43 + (132 - 43) * (Number(yr) - 2025) / 5, e: est(yr)}))},
  ]});
  CompChart.figuresTable(document.querySelector('#capacityTable'), {caption: 'Company', columns: cols, rowGroups});
  setSourceKey([
    ['Source', 'KGI vs SinoPac Investment Consulting (2026)'],
    ['Region', 'KGI: global. SinoPac: United States.'],
    ['Years', '2025 to 2030E. KGI stops at 2028.']
  ]);
}

function renderJefferiesCapacity(panel) {
  const cumulative = capacityState.jefView === 'cumulative';
  const measure = capacityState.jefMeasure;
  const toGW = values => { let run = 0; return values.map(v => { run += v; return (cumulative ? run : v) / 1000; }); };
  const rows = jefferiesCapacity.map(c => ({...c, p: toGW(c.planned), j: toGW(c.jef)}));
  const total = {p: toGW(jefferiesTotal.planned), j: toGW(jefferiesTotal.jef)};
  const share = (r, i) => r.p[i] ? r.j[i] / r.p[i] * 100 : null;
  const periods = jefYears.map(y => ({key: String(y), label: y + 'E', title: `${y}${cumulative ? ', running total from 2026' : ''}`, estimate: true}));
  const pick = (r, i) => measure === 'plan' ? r.p[i] : measure === 'share' ? share(r, i) : r.j[i];
  const series = rows.map(r => ({name: r.name, color: r.color, points: jefYears.map((_, i) => {
    const v = pick(r, i);
    return v == null ? null : {v, e: true, note: measure === 'share' ? `${r.j[i].toFixed(1)} of ${r.p[i].toFixed(1)} GW planned` : `JEF ÷ plan: ${share(r, i) == null ? 'no plan' : Math.round(share(r, i)) + '%'}`};
  })}));
  CompChart.legend(panel.querySelector('.comp-legend'), series, capacityState.jefHidden, renderCapacityChart);
  const fmt = measure === 'share' ? v => Math.round(v) + '%' : gw;
  if (measure === 'both') {
    CompChart.pairChart(panel.querySelector('.comp-chart'), {label: 'Jefferies estimate vs announced plan', groups: periods, hidden: capacityState.jefHidden,
      aLabel: 'Announced plan', bLabel: 'JEF estimate', fmt: gw, labelFmt: v => v.toFixed(1), axisFmt: v => v + ' GW',
      series: rows.map(r => ({name: r.name, color: r.color, a: r.p, b: r.j, note: i => share(r, i) == null ? 'No plan this year' : `JEF expects ${Math.round(share(r, i))}% of plan built`}))});
  } else {
    CompChart.lineChart(panel.querySelector('.comp-chart'), {label: 'Jefferies capacity', periods, series, hidden: capacityState.jefHidden, fmt, axisFmt: v => measure === 'share' ? v + '%' : v + ' GW'});
  }
  const what = {jef: 'Jefferies delivery estimate', plan: 'Projects the companies announced', both: 'Jefferies estimate (solid) beside announced plan (faint)', share: 'Share of announced plan Jefferies expects built'}[measure];
  setCapacityText(`${what}, ${measure === 'share' ? '%' : 'GW'}, North America, ${cumulative ? 'running total from 2026' : 'each year'}`,
    `Jefferies Exhibit 5, North America, ${cumulative ? 'running total from 2026' : 'each year'}`,
    'Plan = projects the hyperscalers have announced. JEF estimate = what Jefferies expects to be delivered. Source prints MW; shown here ÷ 1,000 as GW. xAI is listed as SPCX in the source. Totals are the printed source totals, which differ from row sums by up to 1 MW due to rounding. '
    + (cumulative ? 'Running totals start in 2026, so they exclude capacity built earlier and are not total fleet.' : 'Each year shows capacity delivered in that year.')
    + ' Scope is North America, unlike KGI (global) and SinoPac (U.S.).');
  const cols = periods.map(p => ({label: p.label, estimate: true}));
  const one = v => v.toFixed(1);
  const pct = v => Math.round(v) + '%';
  const group = (name, color, r, note) => ({name: name + (note ? ` (${note})` : ''), color, rows: [
    {label: 'Plan GW', fmt: one, cells: jefYears.map((_, i) => ({v: r.p[i], e: true}))},
    {label: 'JEF GW', fmt: one, cells: jefYears.map((_, i) => ({v: r.j[i], e: true}))},
    {label: 'JEF ÷ plan', fmt: pct, cells: jefYears.map((_, i) => share(r, i) == null ? null : {v: share(r, i), e: true})},
  ]});
  CompChart.figuresTable(document.querySelector('#capacityTable'), {caption: 'Company', columns: cols,
    rowGroups: [...rows.map(r => group(r.name, r.color, r, r.note)), group('Total', 'var(--ml-ink)', total, '5 cos')]});
  setSourceKey([
    ['Source', 'Jefferies Exhibit 5, built on Aterio project data'],
    ['Region', 'North America'],
    ['Years', '2026E to 2030E']
  ]);
}

function renderPlansVsSinopac(panel) {
  const rows = plansVsSinopac.map(r => {
    const plan = jefferiesCapacity.find(c => c.name === r.name).planned.reduce((a, b) => a + b, 0) / 1000;
    const s = sinopacCapacity.find(c => c.name === r.sino).values;
    return {...r, plan, sinopac: s[1] - s[0]};
  });
  const total = {name: 'Total', color: 'var(--ml-ink)', plan: rows.reduce((a, r) => a + r.plan, 0), sinopac: rows.reduce((a, r) => a + r.sinopac, 0)};
  const verdict = ratio => ratio > 1.15 ? 'Plan above SinoPac' : ratio < 0.85 ? 'Plan below SinoPac' : 'Close';
  const series = [
    {name: 'Announced plan', color: 'var(--broker-a)', values: rows.map(r => ({v: r.plan, e: true, note: `Plan ÷ SinoPac: ${Math.round(r.plan / r.sinopac * 100)}%. ${verdict(r.plan / r.sinopac)}${r.note ? '. ' + r.note : ''}`}))},
    {name: 'SinoPac', color: 'var(--broker-b)', values: rows.map(r => ({v: r.sinopac, e: true}))},
  ];
  CompChart.legend(panel.querySelector('.comp-legend'), series, capacityState.plansHidden, renderCapacityChart);
  CompChart.columnChart(panel.querySelector('.comp-chart'), {label: 'Plans vs SinoPac', groups: rows.map(r => ({label: r.name, title: `${r.name}, GW added 2026 to 2030`, estimate: true})), series, hidden: capacityState.plansHidden, fmt: gw, labelFmt: v => v.toFixed(1), axisFmt: v => v + ' GW'});
  setCapacityText('GW added from start of 2026 to end of 2030', 'Announced plans vs SinoPac, five years combined',
    'Plan = the sum of 2026E to 2030E projects each company has announced, from Jefferies Exhibit 5 (Aterio data), North America only, MW ÷ 1,000. SinoPac = its 2030 U.S. capacity minus its 2025 U.S. capacity, which assumes the 2025 figure is a year-end total. Microsoft rents much of its capacity from other providers (CoreWeave, Nebius and others); rented sites do not appear in plan lists but do count in SinoPac’s Azure total, which likely explains most of its gap. The two sources may also measure power differently (chip power vs whole-site power). xAI is left out: its scope in the two sources is not clearly the same.');
  const one = v => v.toFixed(1);
  CompChart.figuresTable(document.querySelector('#capacityTable'), {caption: 'Company', columns: [{label: 'Plan GW', estimate: true}, {label: 'SinoPac GW', estimate: true}, {label: 'Plan ÷ SinoPac', estimate: true}, {label: 'Read', estimate: true}],
    rowGroups: [...rows, total].map(r => ({name: r.name, color: r.color, rows: [{label: 'Added 2026 to 2030', fmt: one, cells: [
      {v: r.plan, e: true}, {v: r.sinopac, e: true}, {v: 1, e: true, text: Math.round(r.plan / r.sinopac * 100) + '%'}, {v: 1, e: true, text: verdict(r.plan / r.sinopac)}]}]}))});
  setSourceKey([
    ['Source', 'Plan: projects the companies have announced (Jefferies Exhibit 5, Aterio data). SinoPac Investment Consulting (2026).'],
    ['Region', 'Plan: North America. SinoPac: United States.'],
    ['Years', '2026E to 2030E, five years combined']
  ]);
}

document.querySelector('#capacityMethod').insertAdjacentHTML('afterend','<details id="labEstimateNotes" class="chart-method lab-notes"><summary>OpenAI &amp; Anthropic · estimate methodology</summary><p>Combined GW uses the supplied Altimeter chart: 3.60 / 10.36 / 24.80 / 40.25 for 2025–2028. OpenAI / Anthropic allocations are 58/42, 55/45, 51/49 and 51/49. The supplied SemiAnalysis Tokenomics chart suggests OpenAI leads and the gap narrows by 2Q27. These rounded visual allocations assume a common linear, zero-based scale; its unlabeled y-axis does not establish exact GW ratios. Different hardware efficiencies add uncertainty.</p><p>The 2Q27 split is held through 2028. Quarterly capacity is linearly interpolated between year-end estimates. Annual additions are changes in estimated year-end capacity. Earlier quarterly points and 2029–2030 are unavailable. Lab access overlaps provider fleets and is excluded from provider totals. Global lab scope differs from SinoPac’s U.S. scope. Existing lab scenarios further down the page use their own delivery assumptions.</p><p>Public disclosures provide context for the buildout: <a href="https://openai.com/index/five-new-stargate-sites/" target="_blank" rel="noopener">OpenAI: nearly 7 GW planned Stargate capacity (Sep 2025)</a>; <a href="https://www.anthropic.com/news/anthropic-amazon-compute" target="_blank" rel="noopener">Anthropic / AWS: up to 5 GW, nearly 1 GW by end-2026 (Apr 2026)</a>; <a href="https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services" target="_blank" rel="noopener">Anthropic / Google: over 1 GW expected in 2026 (Oct 2025)</a>. These are overlapping plans with different delivery dates and do not provide comparable installed totals. The split is a modeling assumption informed by the supplied chart; disclosed commitments are not summed to calculate it.</p></details>');

renderDashboard(window.capacityWorkbook);
