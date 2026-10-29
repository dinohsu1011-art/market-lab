// Reported actuals vs the estimate this page showed before each report.
// The comps workbook re-export overwrites estimates, so the pre-report estimate is
// frozen here. priorGuide/priorText: what the company guided for this quarter on its prior call ('none' = no guide given);
// priorActual: the figure to compare with the guide when the guide covers more than the row (SpaceX whole company).
// Add the actual (and reported date + source) when a company reports;
// the charts and tables then draw that quarter as reported and show the estimate beside it.
// metric: capex | fcf | cloud | aiRevenue ($B, same basis as market-lab-capacity-comps-data.js)
//         capacity (GW added in the quarter)
// company: the company name used on the page (Microsoft, Google, Amazon, Oracle, Meta, SpaceX).
// quarter: calendar quarter, "2026 Q3".
window.capacityActuals = {
  updatedAt: '2026-10-30',
  entries: [
    {company: 'Meta', metric: 'capex', quarter: '2026 Q3', priorText: 'none', estimate: 40.9682, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 33.942, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: purchases of property and equipment. Including finance lease principal ($0.96B) it was $34.91B. FY26 capex guide (with finance leases) $135B to $145B, was $130B to $145B.'},
    {company: 'Meta', metric: 'fcf', quarter: '2026 Q3', priorText: 'none', estimate: -9.1367, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -1.156, reported: '2026-10-21',
      source: 'Meta 8-K Ex 99.1: operating cash flow $32.786B minus purchases of property and equipment $33.942B. Meta\'s own definition (also minus finance lease principal) gives -$2.12B.'},
    {company: 'Oracle', metric: 'capacity', quarter: '2026 Q3', priorGuide: 1.0, priorText: 'about 1 GW', estimate: 1.0, estimateFrom: 'capacity workbook, Sep 1 (implied)', actual: 0.85, reported: '2026-09-11',
      source: 'Your update, Sep 11: Oracle Q3 2026 landed at 0.85 GW. Prior guide: FY26 Q4 call (Jun 10), Q1 delivery approaching 1 GW.'},

    {company: 'SpaceX', metric: 'capex', quarter: '2026 Q3', priorGuide: 18.4, priorActual: 19.593, priorText: 'about $18.4B, whole co.', estimate: 16.8834, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 16.444, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22), segment table: SI (formerly AI) segment capex, three months to Sep 30. Whole-company capex was $19.59B. Prior guide: Q2 call (Aug 2026), the CFO said the next two quarters should be very similar to Q2 whole-company capex of about $18.4B. vs guide compares whole company: $19.59B.'},
    {company: 'SpaceX', metric: 'aiRevenue', quarter: '2026 Q3', priorText: 'none', estimate: 6.2752, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 7.56, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22), segment table: SI (formerly AI) segment revenue, three months to Sep 30. Includes Cursor from its acquisition.'},
    {company: 'SpaceX', metric: 'fcf', quarter: '2026 Q3', priorText: 'none', estimate: -11.616, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -9.962, reported: '2026-10-20',
      source: 'SpaceX 10-Q (filed Oct 22): operating cash flow $9.631B minus purchases of property and equipment $19.593B (nine-month less six-month figures). Whole company.'},
    {company: 'Microsoft', metric: 'capex', quarter: '2026 Q3', priorGuide: 50, priorText: 'over $50B', estimate: 51.7974, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 45.2, reported: '2026-10-28',
      source: 'Microsoft FY27 Q1 (Jul to Sep 2026), Oct 28: capex including finance leases, up 30% (earnings slides and call). Finance leases were $7.4B and cash paid for property and equipment $39.4B. Lower than planned because some third-party capacity deliveries slipped. About 75% went to short-lived assets (chips and servers). Prior guide: over $50B including the lease reclassification (FY26 Q4 call, Jul 2026).'},
    {company: 'Microsoft', metric: 'cloud', quarter: '2026 Q3', priorGuide: 32.49, priorText: 'about $32.5B', estimate: 32.2504, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 33.165, reported: '2026-10-28',
      source: 'Microsoft 8-K Ex 99.1: Azure revenue $33.165B, up 48% (first quarter Microsoft gave Azure in dollars). Guided 49% to 50% growth in constant currency for Oct to Dec. Prior guide: Azure growth of about 45% in constant currency (FY26 Q4 call, Jul 2026), about $32.5B on the year-ago base of $22.4B.'},
    {company: 'Microsoft', metric: 'fcf', quarter: '2026 Q3', priorText: 'none', estimate: 8.4098, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 18.633, reported: '2026-10-28',
      source: 'Microsoft 10-Q: operating cash flow $58.000B minus additions to property and equipment $39.367B. Down 27% from a year earlier.'},
    {company: 'Google', metric: 'capex', quarter: '2026 Q3', priorText: 'none', estimate: 55.7226, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 51.355, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: purchases of property and equipment, Jul to Sep 2026.'},
    {company: 'Google', metric: 'cloud', quarter: '2026 Q3', priorText: 'none', estimate: 28.7519, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 30.709, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: Google Cloud segment revenue, up 103%.'},
    {company: 'Google', metric: 'fcf', quarter: '2026 Q3', priorText: 'none', estimate: -3.3064, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -9.065, reported: '2026-10-28',
      source: 'Alphabet 8-K Ex 99.1: operating cash flow $42.290B minus purchases of property and equipment $51.355B.'},
    {company: 'Amazon', metric: 'capex', quarter: '2026 Q3', priorText: 'none', estimate: 58.5355, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 77.259, reported: '2026-10-29',
      source: 'Amazon 8-K Ex 99.1: purchases of property and equipment, Jul to Sep 2026, up 120% from $35.10B. Net of $1.38B proceeds and incentives it was $75.88B, the $75.9B "cash capex" on the call. Kept about $220B for 2026, which leaves about $48B for Oct to Dec after $172.2B net in the first nine months.'},
    {company: 'Amazon', metric: 'cloud', quarter: '2026 Q3', priorText: 'none', estimate: 45.5366, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: 45.984, reported: '2026-10-29',
      source: 'Amazon 8-K Ex 99.1: AWS segment net sales, up 39.3%, sixth straight quarter of faster growth. Run rate $184B, backlog $578B. Operating income $17.8B (38.7% margin). Andy Jassy expects AWS to grow over 40% in each of 2027 and 2028.'},
    {company: 'Amazon', metric: 'fcf', quarter: '2026 Q3', priorText: 'none', estimate: 24.1964, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: -34.837, reported: '2026-10-29',
      source: 'Amazon 8-K Ex 99.1: operating cash flow $42.422B minus purchases of property and equipment $77.259B. Amazon\'s own definition (net of proceeds and incentives) gives -$33.46B; trailing twelve months -$42.4B.'},
    {company: 'Oracle', metric: 'capex', quarter: '2026 Q4', priorText: 'none', estimate: 20.2412, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
    {company: 'Oracle', metric: 'cloud', quarter: '2026 Q4', priorText: 'no OCI guide', estimate: 9.0593, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null,
      source: 'FY27 Q1 call (Sep 10) guided total cloud revenue (OCI plus apps) up 65% to 71% for Sep to Nov, with no OCI-only figure.'},
    {company: 'Oracle', metric: 'fcf', quarter: '2026 Q4', priorText: 'none', estimate: -15.0304, estimateFrom: 'Hyperscaler Comps.xlsx, saved Oct 16', actual: null, due: null},
  ],
  // Each company's latest total capex guide, from its own earnings call.
  // period: CY2026 = calendar 2026; FY2027 = the company's fiscal year (fiscalYear matches the page's fiscal tags);
  // a quarter ("2026 Q4") is a one-quarter guide. low/high in $B; approx = "about"; change = how it moved from the last guide.
  // pageComparable: false when the guide covers more than the page tracks (SpaceX: whole company vs AI unit).
  // prevLow/prevHigh/prevApprox: the guide before this one. outlook rows are next-year color with no number yet: text says what was said.
  guidance: [
    {company: 'Meta', period: 'CY2026', low: 135, high: 145, prevLow: 130, prevHigh: 145, guided: '2026-10-21',
      source: 'Meta Q3 2026 call, Oct 21. Includes finance lease principal; the page counts only purchases of property and equipment (Q3 lease principal was $0.96B). No 2027 number yet.'},
    {company: 'Meta', period: 'CY2027', outlook: true, text: 'no guide yet', guided: '2026-10-21', change: 'number with Q4 results',
      source: 'Meta Q3 2026 call, Oct 21: no 2027 capex guide. CFO Susan Li said serving costs for the Muse model will rise as its users grow, and that Meta has kept underestimating its compute needs.'},
    {company: 'SpaceX', period: '2026 Q4', low: 35, high: 40, prevLow: 18.4, prevHigh: 18.4, prevApprox: true, guided: '2026-10-20', change: 'first number, whole company', pageComparable: false,
      source: 'SpaceX Q3 2026 call, Oct 20: fourth-quarter capex for the whole company. No full-year guide. With $48.1B spent in the first nine months, 2026 lands near $83B to $88B. The page tracks the AI unit only ($18.6B estimate for Q4). Prior: on the Q2 call (Aug 2026) the CFO said Q3 and Q4 should be very similar to Q2, about $18.4B.'},
    {company: 'Microsoft', period: 'CY2026', low: 170, high: 170, approx: true, prevLow: 175, prevHigh: 175, prevApprox: true, guided: '2026-10-28', change: 'third-party capacity slipped',
      source: 'Microsoft FY27 Q1 call, Oct 28 (Amy Hood): "In Q2, we expect CapEx spend will be over $50 billion. Therefore, for the calendar year, spend should be approximately $170 billion due to the 3P capacity delays." Capex to speed up in Jan to Jun 2027 as delayed third-party capacity arrives. About 75% of capex now goes to short-lived assets. Still free cash flow positive in FY27.'},
    {company: 'Microsoft', period: 'CY2027', outlook: true, text: 'speeds up Jan to Jun', guided: '2026-10-28', change: 'no number',
      source: 'Microsoft FY27 Q1 call, Oct 28 (Amy Hood): "In the second half of the fiscal year, we currently expect CapEx spend to accelerate primarily from CPUs, inclusive of higher memory and storage costs, and GPUs, as well as the 3P capacity deliveries that shifted to H2." Fiscal second half = Jan to Jun 2027, from a Q4 2026 base of over $50B.'},
    {company: 'Google', period: 'CY2026', low: 195, high: 205, prevLow: 195, prevHigh: 205, guided: '2026-10-28', change: 'kept',
      source: 'Alphabet Q3 2026 call, Oct 28: kept $195B to $205B for 2026. 2027 capex to "increase significantly", with details on the Q4 call. Purchase commitments reached $924B; started using third-party compute late in Q3.'},
    {company: 'Google', period: 'CY2027', outlook: true, text: 'up significantly', guided: '2026-10-28', change: 'number on Q4 call',
      source: 'Alphabet Q3 2026 call, Oct 28: "We continue to expect our CapEx to increase significantly in 2027 and will provide further details on our Q4 call."'},
    {company: 'Amazon', period: 'CY2026', low: 220, high: 220, approx: true, prevLow: 220, prevHigh: 220, prevApprox: true, guided: '2026-10-29', change: 'kept',
      source: 'Amazon Q3 2026 call, Oct 29 (Andy Jassy): "We still expect 2026 cash CapEx of approximately $220 billion, the majority for AWS." Cash capex is net of proceeds and incentives; the page counts gross purchases. Q2 call (Jul 30) raised it from about $200B on higher memory costs.'},
    {company: 'Amazon', period: 'CY2027', outlook: true, text: 'meaningfully more', guided: '2026-10-29', change: 'no number',
      source: 'Amazon Q3 2026 call, Oct 29 (Andy Jassy): expects "to spend meaningfully more in 2027 with a clear line of sight to attractive financial returns." AWS to grow over 40% in each of 2027 and 2028; very good visibility into 2027, 2028 and some of 2029, as large blocks of capacity (hundreds of MW to 1 GW) are reserved well ahead.'},
    {company: 'Oracle', period: 'FY2027', fiscalYear: 'FY27', low: 90, high: 95, prevLow: 90, prevHigh: 95, guided: '2026-10-28', change: 'kept',
      source: 'Oracle FY27 Q1 call (Sep 10) set $90B to $95B for fiscal 2027 (Jun 2026 to May 2027); no more than $70B is net cash capex. Investor day, Oct 28: capex peaks in fiscal 2027 and 2028 and steps down in fiscal 2029. About 7 GW more capacity over the next two years, about 10 GW by the end of fiscal 2028. A 1 GW site costs about $37B of capex and earns about $16B a year once running. Free cash flow positive in the second half of fiscal 2028 and over $30B in fiscal 2029. A final $20B raise ($10B equity, $10B debt) funds the rest of the build. RPO $664B. No new dollar capex figure.'},
    {company: 'Oracle', period: 'FY2028', fiscalYear: 'FY28', outlook: true, text: 'peak, with FY27', guided: '2026-10-28', change: 'falls in FY29',
      source: 'Oracle investor day, Oct 28: "a period of peak CapEx in fiscal 2027 and 2028, with our CapEx stepping down in fiscal 2029." Asked whether FY28 equals FY27, the CFO pointed to the $37B-per-GW example and said more of the new gigawatts ramp next year than this year. About 10 GW in place by the end of fiscal 2028.'},
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
