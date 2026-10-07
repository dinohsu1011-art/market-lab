/* Shared, deterministic regime rules. Only observations on/before the chosen date are used. */
(() => {
  'use strict';
  const WINDOWS = [8, 21, 50, 100, 200];
  const clamp = v => Math.max(-2, Math.min(2, v));
  const mean = a => a.length > 0 && a.every(Number.isFinite) ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const average = (a, i, n) => i >= n - 1 ? mean(a.slice(i - n + 1, i + 1)) : null;
  const pct = v => Number.isFinite(v) ? v.toFixed(1) + '%' : 'unavailable';
  const signed = v => (v > 0 ? '+' : '') + v.toFixed(1);
  function label(score) {
    if (!Number.isFinite(score)) return 'Not enough data';
    return score <= -1.2 ? 'Bearish' : score <= -.4 ? 'Neutral-bearish' : score < .4 ? 'Neutral' : score < 1.2 ? 'Neutral-bullish' : 'Bullish';
  }
  const component = (id, title, score, reason) => ({id, title, score, label: label(score), reason, weight: .25});
  function calculate(analytics, breadth, universe, date = analytics.as_of) {
    const i = analytics.dates.indexOf(date), b = breadth?.dates?.indexOf(date) ?? -1;
    const group = analytics.universes.find(g => g.id === universe);
    const bg = breadth?.universes?.find(g => g.id === universe);
    if (!group || i < 0) return {date, universe, score: null, displayScore: null, label: label(null), components: []};
    const s = group.series, at = key => s[key]?.[i];

    // Breadth's five-day change follows its own session calendar, never array positions from another file.
    const levels = WINDOWS.map(w => bg?.windows?.[w]?.pct?.[b]);
    const changes = WINDOWS.map((w, n) => {
      const prior = bg?.windows?.[w]?.pct?.[b - 5];
      return Number.isFinite(levels[n]) && Number.isFinite(prior) ? levels[n] - prior : null;
    });
    const breadthLevel = mean(levels), breadthChange = mean(changes);
    const participation = Number.isFinite(breadthLevel) && Number.isFinite(breadthChange)
      ? mean([clamp((breadthLevel - 50) / 25), clamp(breadthChange / 10)]) : null;
    const buyingShare = at('thrust'), volumeShare = at('dollars_pressure20');
    const buying = Number.isFinite(buyingShare) && Number.isFinite(volumeShare)
      ? mean([clamp((buyingShare - 50) / 10), clamp((volumeShare - 50) / 10)]) : null;

    const nearHigh = mean([at('dd0'), at('dd1')]);
    const deep = mean([at('dd3'), at('dd4')]);
    const netHistory = i < 19 ? [] : analytics.dates.slice(i - 19, i + 1).map((_, offset) => {
      const j = i - 19 + offset, eligible = s.highlow_eligible?.[j];
      return eligible > 0 && Number.isFinite(s.highs?.[j]) && Number.isFinite(s.lows?.[j])
        ? 100 * (s.highs[j] - s.lows[j]) / eligible : null;
    });
    const netHighs = netHistory.length === 20 ? mean(netHistory) : null;
    const damage = [nearHigh, deep, netHighs].every(Number.isFinite)
      ? mean([clamp((2 * nearHigh - 2 * deep) / 25), clamp(netHighs / 2)]) : null;

    const price = at('price'), ma50 = average(s.price, i, 50), ma200 = average(s.price, i, 200);
    const old50 = average(s.price, i - 20, 50), old200 = average(s.price, i - 20, 200);
    const index = [price, ma50, ma200, old50, old200].every(Number.isFinite)
      ? mean([price - ma50, price - ma200, ma50 - old50, ma200 - old200].map(v => 2 * Math.sign(v))) : null;
    const components = [
      component('participation', 'Trend participation', participation, Number.isFinite(participation)
        ? `On average, ${pct(breadthLevel)} of stocks are above their moving averages. Participation changed ${signed(breadthChange)} percentage points over five trading sessions.`
        : 'All five moving-average readings and five earlier trading sessions are needed.'),
      component('buying', 'Buying vs. selling', buying, Number.isFinite(buying)
        ? `The recent share of rising stocks is ${pct(buyingShare)}. Over 20 sessions, ${pct(volumeShare)} of trading activity in stocks that moved up or down was in the rising stocks.`
        : 'The advancing-stock reading and 20-session directional volume are needed.'),
      component('damage', 'Market damage', damage, Number.isFinite(damage)
        ? `${pct(2 * nearHigh)} of stocks are within 10% of their yearly high; ${pct(2 * deep)} are at least 20% below it. New highs ${netHighs >= 0 ? 'outnumber' : 'trail'} new lows by ${pct(Math.abs(netHighs))} of eligible stocks per day, averaged over 20 sessions.`
        : 'Drawdown bands and 20 complete sessions of new highs and lows are needed.'),
      component('index', 'Index trend', index, Number.isFinite(index)
        ? `The index is ${price === ma50 ? 'at' : price > ma50 ? 'above' : 'below'} its 50-day average and ${price === ma200 ? 'at' : price > ma200 ? 'above' : 'below'} its 200-day average. The 50-day average is ${ma50 === old50 ? 'unchanged' : ma50 > old50 ? 'rising' : 'falling'} and the 200-day average is ${ma200 === old200 ? 'unchanged' : ma200 > old200 ? 'rising' : 'falling'} over 20 sessions.`
        : 'At least 220 consecutive index closing prices are needed.')
    ];
    // Missing inputs do not become neutral votes or silently redistribute the weights.
    const score = mean(components.map(c => c.score));
    return {date, universe, name: group.label || group.name || group.id, score,
      displayScore: Number.isFinite(score) ? Math.round(score * 50) : null,
      label: label(score), components, context: {correlation: at('correlation'), dispersion: at('dispersion')},
      observations: {breadthLevel, breadthChange, buyingShare, volumeShare, nearHigh: nearHigh == null ? null : 2 * nearHigh,
        deep: deep == null ? null : 2 * deep, netHighs, price, ma50, ma200}};
  }
  const api = {calculate, label, WINDOWS};
  if (typeof window !== 'undefined') window.MarketLabRegime = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
