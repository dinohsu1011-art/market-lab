// Reported actuals vs the estimate this page showed before each report.
// The comps workbook re-export overwrites estimates, so the pre-report estimate is
// frozen here. Add the actual (and reported date + source) when a company reports;
// the charts and tables then draw that quarter as reported and show the estimate beside it.
// metric: capex | fcf | cloud | aiRevenue ($B, same basis as market-lab-capacity-comps-data.js)
//         capacity (GW added in the quarter)
// company: the company name used on the page (Microsoft, Google, Amazon, Oracle, Meta, SpaceX).
// quarter: calendar quarter, "2026 Q3".
window.capacityActuals = {
  updatedAt: '2026-10-29',
  entries: [
    {company: 'Meta', metric: 'capex', quarter: '2026 Q3', estimate: 40.9682, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 33.942, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: purchases of property and equipment. Including finance lease principal ($0.96B) it was $34.91B. FY26 capex guide (with finance leases) $135B to $145B, was $130B to $145B.'},
    {company: 'Meta', metric: 'fcf', quarter: '2026 Q3', estimate: -9.1367, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -1.156, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: operating cash flow $32.786B minus purchases of property and equipment $33.942B. Meta\'s own definition (also minus finance lease principal) gives -$2.12B.'},
    {company: 'Oracle', metric: 'capacity', quarter: '2026 Q3', estimate: 1.0, estimateFrom: 'capacity workbook, Sep 1 (implied)', actual: 0.85, reported: '2026-09-11',
      source: 'Your update, Sep 11: Oracle Q3 2026 landed at 0.85 GW.'},

    {company: 'SpaceX', metric: 'capex', quarter: '2026 Q3', estimate: 16.8834, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 16.444, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22), segment table: SI (formerly AI) segment capex, three months to Sep 30. Whole-company capex was $19.59B.'},
    {company: 'SpaceX', metric: 'aiRevenue', quarter: '2026 Q3', estimate: 6.2752, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 7.56, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22), segment table: SI (formerly AI) segment revenue, three months to Sep 30. Includes Cursor from its acquisition.'},
    {company: 'SpaceX', metric: 'fcf', quarter: '2026 Q3', estimate: -11.616, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -9.962, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22): operating cash flow $9.631B minus purchases of property and equipment $19.593B (nine-month less six-month figures). Whole company.'},
    {company: 'Microsoft', metric: 'capex', quarter: '2026 Q3', estimate: 51.7974, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 45.2, reported: '2026-10-28',
      source: 'Microsoft FY27 Q1 (Jul to Sep 2026), Oct 28: capex including finance leases as Microsoft states it, up about 30% (CNBC). 10-Q: cash additions to property and equipment $39.367B plus $5.19B of finance lease assets. Some third-party capacity slipped out of the quarter.'},
    {company: 'Microsoft', metric: 'cloud', quarter: '2026 Q3', estimate: 32.2504, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 33.165, reported: '2026-10-28',
      source: 'Microsoft 8-K Ex 99.1: Azure revenue $33.165B, up 48% (first quarter Microsoft gave Azure in dollars). Guided 49% to 50% growth in constant currency for Oct to Dec.'},
    {company: 'Microsoft', metric: 'fcf', quarter: '2026 Q3', estimate: 8.4098, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 18.633, reported: '2026-10-28',
      source: 'Microsoft 10-Q: operating cash flow $58.000B minus additions to property and equipment $39.367B. Down 27% from a year earlier.'},
    {company: 'Google', metric: 'capex', quarter: '2026 Q3', estimate: 55.7226, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 51.355, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: purchases of property and equipment, Jul to Sep 2026.'},
    {company: 'Google', metric: 'cloud', quarter: '2026 Q3', estimate: 28.7519, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 30.709, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: Google Cloud segment revenue, up 103%.'},
    {company: 'Google', metric: 'fcf', quarter: '2026 Q3', estimate: -3.3064, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -9.065, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: operating cash flow $42.290B minus purchases of property and equipment $51.355B.'},
    // Waiting on the report. Estimates frozen from the Oct 16 workbook.
    {company: 'Amazon', metric: 'capex', quarter: '2026 Q3', estimate: 58.5355, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'Amazon', metric: 'cloud', quarter: '2026 Q3', estimate: 45.5366, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'Amazon', metric: 'fcf', quarter: '2026 Q3', estimate: 24.1964, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'Oracle', metric: 'capex', quarter: '2026 Q4', estimate: 20.2412, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'cloud', quarter: '2026 Q4', estimate: 9.0593, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'fcf', quarter: '2026 Q4', estimate: -15.0304, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
  ],
  // Each company's latest total capex guide, from its own earnings call.
  // period: CY2026 = calendar 2026; FY2027 = the company's fiscal year (fiscalYear matches the page's fiscal tags);
  // a quarter ("2026 Q4") is a one-quarter guide. low/high in $B; approx = "about"; change = how it moved from the last guide.
  // pageComparable: false when the guide covers more than the page tracks (SpaceX: whole company vs AI unit).
  guidance: [
    {company: 'Meta', period: 'CY2026', low: 135, high: 145, guided: '2026-10-21', change: 'was $130B to $145B',
      source: 'Meta Q3 2026 call, Oct 21. Includes finance lease principal; the page counts only purchases of property and equipment (Q3 lease principal was $0.96B). No 2027 number yet.'},
    {company: 'SpaceX', period: '2026 Q4', low: 35, high: 40, guided: '2026-10-20', change: 'first guide', pageComparable: false,
      source: 'SpaceX Q3 2026 call, Oct 20: fourth-quarter capex for the whole company. No full-year guide. With $48.1B spent in the first nine months, 2026 lands near $83B to $88B. The page tracks the AI unit only ($18.6B estimate for Q4).'},
    {company: 'Microsoft', period: 'CY2026', low: 170, high: 170, approx: true, guided: '2026-10-28', change: 'was about $175B',
      source: 'Microsoft FY27 Q1 call, Oct 28: over $50B for Oct to Dec 2026 and about $170B for the calendar year, lower because some third-party capacity deliveries moved into 2027. CNBC printed "calendar 2027", but the quarters only add up for 2026 ($31.9B + $41.0B + $45.2B + over $50B). About 75% of capex now goes to short-lived assets like chips. Capex to speed up in Jan to Jun 2027.'},
    {company: 'Google', period: 'CY2026', low: 195, high: 205, guided: '2026-10-28', change: 'kept',
      source: 'Alphabet Q3 2026 call, Oct 28: kept $195B to $205B for 2026. 2027 capex to "increase significantly", with details on the Q4 call. Purchase commitments reached $924B; started using third-party compute late in Q3.'},
    {company: 'Amazon', period: 'CY2026', low: 220, high: 220, approx: true, guided: '2026-07-30', change: 'was about $200B',
      source: 'Amazon Q2 2026 call, Jul 30: about $220B of cash capex in 2026, up from about $200B on higher memory costs.'},
    {company: 'Oracle', period: 'FY2027', fiscalYear: 'FY27', low: 90, high: 95, guided: '2026-10-28', change: 'kept, peak FY27 to FY28',
      source: 'Oracle FY27 Q1 call (Sep 10) set $90B to $95B for fiscal 2027 (Jun 2026 to May 2027); no more than $70B is net cash capex after customer prepayments. Investor day, Oct 28: capex peaks in fiscal 2027 and 2028 and steps down in fiscal 2029; free cash flow turns positive in the second half of fiscal 2028 and tops $30B in fiscal 2029; new capital raises capped at $20B through fiscal 2030. No new dollar capex figure.'},
  ],
  // Reported quarters missing from the workbook, taken from filings.
  backfill: [
    {company: 'Oracle', metric: 'capex', quarter: '2024 Q1', value: 1.674, fiscal: 'FY24 Q3',
      source: 'Oracle 10-Q, quarter ended Feb 29, 2024: nine-month capex $4.068B minus six-month $2.394B.'},
    {company: 'SpaceX', metric: 'capex', quarter: '2025 Q3', value: 4.76, fiscal: 'FY25 Q3',
      source: 'SpaceX 10-Q for Sep 30, 2026, segment table: SI segment capex, three months to Sep 30, 2025.'},
    {company: 'SpaceX', metric: 'aiRevenue', quarter: '2025 Q3', value: 0.813, fiscal: 'FY25 Q3',
      source: 'SpaceX 10-Q for Sep 30, 2026, segment table: SI segment revenue, three months to Sep 30, 2025.'},
    {company: 'SpaceX', metric: 'fcf', quarter: '2025 Q3', value: -3.112, fiscal: 'FY25 Q3',
      source: 'SpaceX 10-Q filings: operating cash flow $3.769B minus property and equipment $6.881B (nine-month less six-month, 2025).'},
  ],
};
