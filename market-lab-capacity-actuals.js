// Reported actuals vs the estimate this page showed before each report.
// The comps workbook re-export overwrites estimates, so the pre-report estimate is
// frozen here. Add the actual (and reported date + source) when a company reports;
// the charts and tables then draw that quarter as reported and show the estimate beside it.
// metric: capex | fcf | cloud ($B, same basis as market-lab-capacity-comps-data.js)
//         capacity (GW added in the quarter)
// company: the company name used on the page (Microsoft, Google, Amazon, Oracle, Meta, SpaceX).
// quarter: calendar quarter, "2026 Q3".
window.capacityActuals = {
  updatedAt: '2026-10-28',
  entries: [
    {company: 'Meta', metric: 'capex', quarter: '2026 Q3', estimate: 40.9682, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 33.942, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: purchases of property and equipment. Including finance lease principal ($0.96B) it was $34.91B. FY26 capex guide (with finance leases) $135B to $145B, was $130B to $145B.'},
    {company: 'Meta', metric: 'fcf', quarter: '2026 Q3', estimate: -9.1367, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -1.156, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: operating cash flow $32.786B minus purchases of property and equipment $33.942B. Meta\'s own definition (also minus finance lease principal) gives -$2.12B.'},
    {company: 'Oracle', metric: 'capacity', quarter: '2026 Q3', estimate: 1.0, estimateFrom: 'capacity workbook, Sep 1 (implied)', actual: 0.85, reported: '2026-09-11',
      source: 'Your update, Sep 11: Oracle Q3 2026 landed at 0.85 GW.'},

    // Waiting on the report. Estimates frozen from the Oct 16 workbook.
    {company: 'Microsoft', metric: 'capex', quarter: '2026 Q3', estimate: 51.7974, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Microsoft', metric: 'cloud', quarter: '2026 Q3', estimate: 32.2504, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Microsoft', metric: 'fcf', quarter: '2026 Q3', estimate: 8.4098, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Google', metric: 'capex', quarter: '2026 Q3', estimate: 55.7226, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Google', metric: 'cloud', quarter: '2026 Q3', estimate: 28.7519, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Google', metric: 'fcf', quarter: '2026 Q3', estimate: -3.3064, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-28'},
    {company: 'Amazon', metric: 'capex', quarter: '2026 Q3', estimate: 58.5355, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'Amazon', metric: 'cloud', quarter: '2026 Q3', estimate: 45.5366, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'Amazon', metric: 'fcf', quarter: '2026 Q3', estimate: 24.1964, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: '2026-10-30'},
    {company: 'SpaceX', metric: 'capex', quarter: '2026 Q3', estimate: 16.8834, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'SpaceX', metric: 'fcf', quarter: '2026 Q3', estimate: -11.616, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'capex', quarter: '2026 Q4', estimate: 20.2412, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'cloud', quarter: '2026 Q4', estimate: 9.0593, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'fcf', quarter: '2026 Q4', estimate: -15.0304, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
  ],
};
