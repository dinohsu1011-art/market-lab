/* Model tab on the Financials page: the segment build sheets from a coverage Excel model,
   recalculated live in the page. Data comes from models/<T>.json (ops/models/export_model.py).
   References to sheets that are not shown (BBG, IS Est, ...) were frozen to Excel's saved values.
   Edits live in localStorage under equinox.fin.model.v1.<T>, keyed by sheet, row label and column header,
   so they survive a fresh export of the model. */
(function (root) {
  'use strict';

  // ---------- formula engine ----------
  class Err { constructor(c) { this.e = c; } toString() { return this.e; } }
  const DIV0 = new Err('#DIV/0!'), VALUE = new Err('#VALUE!'), REF = new Err('#REF!'), NAME = new Err('#NAME?'), NA = new Err('#N/A');
  const colNum = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };

  const TOK = /\s+|(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|("(?:[^"]|"")*")|((?:'(?:[^']|'')+'|[A-Za-z_][\w. ]*?)!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![\w(])|([A-Za-z_][\w.]*)\s*\(|(TRUE|FALSE)(?![\w(])|(<=|>=|<>|[-+*/^&=<>%(),:])|(\{[^}]*\})/gy;

  function lex(src) {
    const out = []; TOK.lastIndex = 0;
    while (TOK.lastIndex < src.length) {
      const at = TOK.lastIndex, m = TOK.exec(src);
      if (!m || m.index !== at) throw new Error(`cannot read formula at "${src.slice(at, at + 12)}"`);
      if (m[1] != null) out.push({t: 'n', v: Number(m[1])});
      else if (m[2] != null) out.push({t: 's', v: m[2].slice(1, -1).replace(/""/g, '"')});
      else if (m[4] != null) {
        const sh = m[3] ? m[3].slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : null;
        const [a, b] = m[4].replace(/\$/g, '').toUpperCase().split(':');
        const p = x => { const k = x.match(/^([A-Z]+)(\d+)$/); return [Number(k[2]), colNum(k[1])]; };
        const [r1, c1] = p(a), [r2, c2] = b ? p(b) : [r1, c1];
        out.push({t: 'r', sh, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2), rng: !!b});
      }
      else if (m[5] != null) out.push({t: 'f', v: m[5].toUpperCase()});
      else if (m[6] != null) out.push({t: 'b', v: m[6] === 'TRUE'});
      else if (m[7] != null) out.push({t: 'o', v: m[7]});
      else if (m[8] != null) out.push({t: 'a', v: m[8].slice(1, -1).split(/[,;]/).map(x => {   // fixed list, e.g. {1,2,"a",}
        x = x.trim(); if (x === '') return null; if (/^".*"$/.test(x)) return x.slice(1, -1).replace(/""/g, '"');
        if (/^(TRUE|FALSE)$/i.test(x)) return /^T/i.test(x); return Number(x);
      })});
    }
    return out;
  }

  function parse(src) {
    const tk = lex(src.replace(/^=/, '')); let i = 0;
    const peek = () => tk[i], isOp = (...v) => tk[i] && tk[i].t === 'o' && v.includes(tk[i].v);
    const need = v => { if (!isOp(v)) throw new Error(`expected ${v}`); i++; };
    const bin = (next, ops) => () => { let a = next(); while (isOp(...ops)) { const op = tk[i++].v; a = {t: 'bin', op, a, b: next()}; } return a; };
    const primary = () => {
      const x = tk[i++];
      if (!x) throw new Error('formula ends early');
      if (x.t === 'n' || x.t === 's' || x.t === 'b') return {t: 'lit', v: x.v};
      if (x.t === 'r') return {...x, t: 'ref'};
      if (x.t === 'a') return {t: 'arr', v: x.v};
      if (x.t === 'f') {
        const args = [];
        if (!isOp(')')) {
          const arg = () => (isOp(',', ')') ? {t: 'lit', v: null} : expr());
          args.push(arg());
          while (isOp(',')) { i++; args.push(arg()); }
        }
        need(')');
        return {t: 'fn', name: x.v, args};
      }
      if (x.t === 'o' && x.v === '(') { const e = expr(); need(')'); return e; }
      throw new Error(`unexpected ${x.v}`);
    };
    const pct = () => { let a = primary(); while (isOp('%')) { i++; a = {t: 'pct', a}; } return a; };
    const unary = () => { if (isOp('-', '+')) { const op = tk[i++].v; const a = unary(); return op === '-' ? {t: 'neg', a} : a; } return pct(); };
    const pow = bin(unary, ['^']), mul = bin(pow, ['*', '/']), add = bin(mul, ['+', '-']), cat = bin(add, ['&']);
    const cmp = bin(cat, ['=', '<>', '<', '>', '<=', '>=']);
    const expr = cmp;
    const e = expr();
    if (i < tk.length) throw new Error(`extra text after formula`);
    return e;
  }

  const isErr = v => v instanceof Err;
  function num(v) {
    if (typeof v === 'number') return v;
    if (v == null) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isErr(v)) throw v;
    if (Array.isArray(v)) throw VALUE;
    const t = String(v).trim();
    if (t !== '' && isFinite(Number(t))) return Number(t);
    throw VALUE;
  }
  const str = v => { if (isErr(v)) throw v; if (v == null) return ''; if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; if (typeof v === 'number') return String(Number(v.toPrecision(15))); return String(v); };
  const round15 = x => Number(x.toPrecision(15));
  function compare(a, b) {
    if (isErr(a)) throw a; if (isErr(b)) throw b;
    if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    const rank = v => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (typeof a === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
    if (typeof a === 'number') { a = round15(a); b = round15(b); }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  // values in a range argument (ranges skip text and booleans, like Excel), or the scalar itself
  const flat = (v, out) => { if (Array.isArray(v)) { for (const x of v) { if (isErr(x)) throw x; if (typeof x === 'number') out.push(x); } } else out.push(num(v)); return out; };
  const nums = args => args.reduce((o, v) => flat(v, o), []);
  const DAY = 86400000, BASE = Date.UTC(1899, 11, 30);
  const toDate = s => new Date(BASE + Math.floor(num(s)) * DAY);
  const toSerial = (y, m, d) => Math.round((Date.UTC(y, m, d) - BASE) / DAY);

  function matchCrit(val, crit) {
    if (isErr(val)) return false;
    if (typeof crit === 'string') {
      const m = crit.match(/^(<=|>=|<>|<|>|=)(.*)$/);
      if (m) {
        const op = m[1], rhsRaw = m[2], rhsNum = rhsRaw !== '' && isFinite(Number(rhsRaw)) ? Number(rhsRaw) : rhsRaw;
        if (val == null) return op === '=' ? rhsRaw === '' : op === '<>' ? rhsRaw !== '' : false;
        const c = compare(val, rhsNum);
        return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
      }
      if (/[*?]/.test(crit)) {
        const re = new RegExp('^' + crit.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        return re.test(val == null ? '' : String(val));
      }
    }
    if (val == null && (crit == null || crit === '')) return true;
    if (val == null || crit == null) return false;
    return compare(val, crit) === 0;
  }

  const FN = {
    SUM: a => nums(a).reduce((t, x) => t + x, 0),
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    AVERAGE: a => { const n = nums(a); if (!n.length) throw DIV0; return n.reduce((t, x) => t + x, 0) / n.length; },
    MEDIAN: a => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw VALUE; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
    COUNT: a => nums(a).length,
    COUNTA: a => a.reduce((t, v) => t + (Array.isArray(v) ? v.filter(x => x != null && x !== '').length : (v != null && v !== '' ? 1 : 0)), 0),
    N: a => { const v = Array.isArray(a[0]) ? a[0][0] : a[0]; if (isErr(v)) throw v; return typeof v === 'number' ? v : v === true ? 1 : 0; },
    INT: a => Math.floor(num(a[0])),
    ABS: a => Math.abs(num(a[0])),
    SIGN: a => Math.sign(num(a[0])),
    MOD: a => { const x = num(a[0]), y = num(a[1]); if (y === 0) throw DIV0; return x - y * Math.floor(x / y); },
    SQRT: a => { const x = num(a[0]); if (x < 0) throw VALUE; return Math.sqrt(x); },
    POWER: a => num(a[0]) ** num(a[1]),
    EXP: a => Math.exp(num(a[0])),
    LN: a => { const x = num(a[0]); if (x <= 0) throw VALUE; return Math.log(x); },
    LOG10: a => { const x = num(a[0]); if (x <= 0) throw VALUE; return Math.log10(x); },
    LOG: a => { const x = num(a[0]), b = a[1] != null ? num(a[1]) : 10; if (x <= 0 || b <= 0 || b === 1) throw VALUE; return Math.log(x) / Math.log(b); },
    ROUND: a => { const f = 10 ** Math.trunc(num(a[1] ?? 0)); return Math.round(num(a[0]) * f) / f; },
    ROUNDUP: a => { const f = 10 ** Math.trunc(num(a[1] ?? 0)), x = num(a[0]); return (x < 0 ? -Math.ceil(-x * f) : Math.ceil(x * f)) / f; },
    ROUNDDOWN: a => { const f = 10 ** Math.trunc(num(a[1] ?? 0)), x = num(a[0]); return Math.trunc(x * f) / f; },
    MROUND: a => { const x = num(a[0]), m = num(a[1]); if (m === 0) return 0; return Math.round(x / m) * m; },
    NOT: a => !num(a[0]),
    ISNUMBER: a => typeof a[0] === 'number' && isFinite(a[0]),
    ISBLANK: a => a[0] == null || a[0] === '',
    LEFT: a => str(a[0]).slice(0, a[1] != null ? Math.max(0, Math.trunc(num(a[1]))) : 1),
    RIGHT: a => { const s = str(a[0]), n = a[1] != null ? Math.max(0, Math.trunc(num(a[1]))) : 1; return n === 0 ? '' : s.slice(-n); },
    MID: a => { const s = str(a[0]), st = Math.max(1, Math.trunc(num(a[1]))), n = Math.max(0, Math.trunc(num(a[2]))); return s.slice(st - 1, st - 1 + n); },
    LEN: a => str(a[0]).length,
    TRIM: a => str(a[0]).trim().replace(/\s+/g, ' '),
    UPPER: a => str(a[0]).toUpperCase(),
    LOWER: a => str(a[0]).toLowerCase(),
    CONCATENATE: a => a.map(str).join(''),
    VALUE: a => { const s = str(a[0]).replace(/[$,\s]/g, ''); if (s === '') throw VALUE; const p = s.endsWith('%'); const n = Number(p ? s.slice(0, -1) : s); if (!isFinite(n)) throw VALUE; return p ? n / 100 : n; },
    NUMBERVALUE: a => { const dec = a[1] != null ? str(a[1]) : '.', grp = a[2] != null ? str(a[2]) : ','; let s = str(a[0]).replace(/\s/g, ''); if (grp) s = s.split(grp).join(''); if (dec && dec !== '.') s = s.replace(dec, '.'); const p = s.endsWith('%'); const n = Number(p ? s.slice(0, -1) : s); if (s === '' || !isFinite(n)) throw VALUE; return p ? n / 100 : n; },
    IF: null,   // handled lazily below
    IFERROR: null,
    IFNA: null,
    ISERROR: null,
    ISNA: null,
    YEAR: a => toDate(a[0]).getUTCFullYear(),
    MONTH: a => toDate(a[0]).getUTCMonth() + 1,
    DAY: a => toDate(a[0]).getUTCDate(),
    DAYS: a => Math.floor(num(a[0])) - Math.floor(num(a[1])),
    DATE: a => toSerial(num(a[0]), num(a[1]) - 1, num(a[2])),
    EOMONTH: a => { const d = toDate(a[0]); return toSerial(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(num(a[1])) + 1, 0); },
    TODAY: () => { const d = new Date(); return toSerial(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); },
    NOW: () => (Date.now() - BASE) / DAY,
    MATCH: a => {
      const key = a[0], arr = Array.isArray(a[1]) ? a[1] : [a[1]], mt = a[2] == null ? 1 : Math.trunc(num(a[2]));
      if (isErr(key)) throw key;
      if (mt === 0) {
        for (let k = 0; k < arr.length; k++) if (!isErr(arr[k]) && arr[k] != null && compare(arr[k], key) === 0) return k + 1;
        throw NA;
      }
      let best = -1;
      for (let k = 0; k < arr.length; k++) {
        if (isErr(arr[k]) || arr[k] == null) continue;
        const c = compare(arr[k], key);
        if (mt > 0 ? c <= 0 : c >= 0) best = k; else break;
      }
      if (best < 0) throw NA;
      return best + 1;
    },
    INDEX: a => {
      const arr = Array.isArray(a[0]) ? a[0] : [a[0]];
      const rows = arr._rows || 1, cols = arr._cols || arr.length;
      const ri = a[1] == null ? 0 : Math.trunc(num(a[1])), ci = a[2] == null ? 0 : Math.trunc(num(a[2]));
      if (ri === 0 && ci > 0) {
        if (ci < 1 || ci > cols) throw REF;
        const out = []; for (let r = 0; r < rows; r++) out.push(arr[r * cols + (ci - 1)]); out._rows = rows; out._cols = 1; return out;
      }
      if (ci === 0 && ri > 0) {
        if (rows === 1) { if (ri < 1 || ri > cols) throw REF; return arr[ri - 1]; }
        if (cols === 1) { if (ri < 1 || ri > rows) throw REF; return arr[ri - 1]; }
        if (ri < 1 || ri > rows) throw REF;
        const out = arr.slice((ri - 1) * cols, ri * cols); out._rows = 1; out._cols = cols; return out;
      }
      const r0 = ri || 1, c0 = ci || 1;
      if (r0 < 1 || r0 > rows || c0 < 1 || c0 > cols) throw REF;
      return arr[(r0 - 1) * cols + (c0 - 1)];
    },
    VLOOKUP: a => {
      const key = a[0], tbl = a[1], ci = Math.trunc(num(a[2])), approx = a[3] == null ? true : !!num(a[3]);
      if (isErr(key)) throw key;
      if (!Array.isArray(tbl)) throw NA;
      const rows = tbl._rows || 1, cols = tbl._cols || tbl.length;
      if (ci < 1 || ci > cols) throw REF;
      if (!approx) {
        for (let r = 0; r < rows; r++) { const v = tbl[r * cols]; if (!isErr(v) && v != null && compare(v, key) === 0) return tbl[r * cols + ci - 1]; }
        throw NA;
      }
      let best = -1;
      for (let r = 0; r < rows; r++) { const v = tbl[r * cols]; if (!isErr(v) && v != null && compare(v, key) <= 0) best = r; }
      if (best < 0) throw NA;
      return tbl[best * cols + ci - 1];
    },
    HLOOKUP: a => {
      const key = a[0], tbl = a[1], ri = Math.trunc(num(a[2])), approx = a[3] == null ? true : !!num(a[3]);
      if (isErr(key)) throw key;
      if (!Array.isArray(tbl)) throw NA;
      const rows = tbl._rows || 1, cols = tbl._cols || tbl.length;
      if (ri < 1 || ri > rows) throw REF;
      if (!approx) {
        for (let c = 0; c < cols; c++) { const v = tbl[c]; if (!isErr(v) && v != null && compare(v, key) === 0) return tbl[(ri - 1) * cols + c]; }
        throw NA;
      }
      let best = -1;
      for (let c = 0; c < cols; c++) { const v = tbl[c]; if (!isErr(v) && v != null && compare(v, key) <= 0) best = c; }
      if (best < 0) throw NA;
      return tbl[(ri - 1) * cols + best];
    },
    SUMIF: a => {
      const cr = Array.isArray(a[0]) ? a[0] : [a[0]], crit = a[1], sr = a[2] != null ? (Array.isArray(a[2]) ? a[2] : [a[2]]) : cr;
      let t = 0;
      for (let k = 0; k < cr.length; k++) if (matchCrit(cr[k], crit) && typeof sr[k] === 'number') t += sr[k];
      return t;
    },
    SUMIFS: a => {
      const sr = Array.isArray(a[0]) ? a[0] : [a[0]];
      let t = 0;
      for (let k = 0; k < sr.length; k++) {
        let okAll = true;
        for (let j = 1; j + 1 < a.length; j += 2) {
          const cr = Array.isArray(a[j]) ? a[j] : [a[j]];
          if (!matchCrit(cr[k], a[j + 1])) { okAll = false; break; }
        }
        if (okAll && typeof sr[k] === 'number') t += sr[k];
      }
      return t;
    },
    COUNTIF: a => {
      const cr = Array.isArray(a[0]) ? a[0] : [a[0]], crit = a[1];
      let n = 0;
      for (let k = 0; k < cr.length; k++) if (matchCrit(cr[k], crit)) n++;
      return n;
    },
    SUMPRODUCT: a => {
      const arr = a.map(v => Array.isArray(v) ? v : [v]);
      let t = 0;
      for (let k = 0; k < arr[0].length; k++) { let p = 1; for (const x of arr) { const v = x[k]; if (isErr(v)) throw v; p *= typeof v === 'number' ? v : 0; } t += p; }
      return t;
    },
    AND: a => { const n = a.flatMap(v => Array.isArray(v) ? v.filter(x => typeof x !== 'string' && x != null) : [v]); return n.every(v => !!num(v)); },
    OR: a => { const n = a.flatMap(v => Array.isArray(v) ? v.filter(x => typeof x !== 'string' && x != null) : [v]); return n.some(v => !!num(v)); },
  };

  const AGG = new Set(['SUM', 'MAX', 'MIN', 'AVERAGE', 'MEDIAN', 'COUNT', 'COUNTA', 'SUMPRODUCT', 'AND', 'OR']);
  function compile(ast, home, homeR = 1, homeC = 1) {
    switch (ast.t) {
      case 'lit': { const v = ast.v; return () => v; }
      case 'arr': { const v = ast.v; return () => v; }
      case 'ref': {
        const sh = ast.sh || home, {r1, c1, r2, c2} = ast;
        if (!ast.rng) return W => W.get(sh, r1, c1);
        const rows = r2 - r1 + 1, cols = c2 - c1 + 1;
        return W => { const out = []; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(W.get(sh, r, c)); out._rows = rows; out._cols = cols; return out; };
      }
      case 'neg': { const a = compile(ast.a, home, homeR, homeC); return W => -num(a(W)); }
      case 'pct': { const a = compile(ast.a, home, homeR, homeC); return W => num(a(W)) / 100; }
      case 'bin': {
        const a = compile(ast.a, home, homeR, homeC), b = compile(ast.b, home, homeR, homeC), op = ast.op;
        switch (op) {
          case '+': return W => num(a(W)) + num(b(W));
          case '-': return W => num(a(W)) - num(b(W));
          case '*': return W => num(a(W)) * num(b(W));
          case '/': return W => { const x = num(a(W)), y = num(b(W)); if (y === 0) throw DIV0; return x / y; };
          case '^': return W => num(a(W)) ** num(b(W));
          case '&': return W => str(a(W)) + str(b(W));
          case '=': return W => compare(a(W), b(W)) === 0;
          case '<>': return W => compare(a(W), b(W)) !== 0;
          case '<': return W => compare(a(W), b(W)) < 0;
          case '>': return W => compare(a(W), b(W)) > 0;
          case '<=': return W => compare(a(W), b(W)) <= 0;
          case '>=': return W => compare(a(W), b(W)) >= 0;
        }
        break;
      }
      case 'fn': {
        const fnName = ast.name.replace(/^_XLFN\./, '');
        if (fnName === 'ROW') { const r = ast.args[0] && ast.args[0].t === 'ref' ? ast.args[0].r1 : homeR; return () => r; }
        if (fnName === 'COLUMN') { const c = ast.args[0] && ast.args[0].t === 'ref' ? ast.args[0].c1 : homeC; return () => c; }
        const args = ast.args.map(x => compile(x, home, homeR, homeC));
        if (fnName === 'IF') return W => { const c = args[0](W); return (Array.isArray(c) ? VALUE : num(c)) ? (args[1] ? args[1](W) : true) : (args[2] ? args[2](W) : false); };
        if (fnName === 'IFERROR') return W => { try { const v = args[0](W); if (isErr(v)) return args[1](W); return v; } catch (e) { if (isErr(e)) return args[1](W); throw e; } };
        if (fnName === 'IFNA') return W => { try { const v = args[0](W); if (isErr(v) && v.e === '#N/A') return args[1](W); return v; } catch (e) { if (isErr(e) && e.e === '#N/A') return args[1](W); throw e; } };
        if (fnName === 'ISERROR') return W => { try { const v = args[0](W); return isErr(v); } catch (e) { if (isErr(e)) return true; throw e; } };
        if (fnName === 'ISNA') return W => { try { const v = args[0](W); return isErr(v) && v.e === '#N/A'; } catch (e) { if (isErr(e)) return e.e === '#N/A'; throw e; } };
        const f = FN[fnName];
        if (!f) return () => { throw NAME; };
        // in SUM, AVERAGE and the like a plain cell reference acts like a range: blanks and text are skipped
        if (AGG.has(fnName)) ast.args.forEach((x, k) => { if (x.t === 'ref' && !x.rng) { const g = args[k]; args[k] = W => [g(W)]; } });
        return W => f(args.map(g => g(W)));
      }
    }
    throw new Error('bad formula');
  }

  // A workbook: sheets of cells, each cell {v (saved value), src, fn, val, pass}
  class Book {
    constructor(doc) {
      this.sheets = new Map(); this.pass = 0; this.over = new Map(); this.bad = []; this.trace = null; this.reads = null; this.depth = 0;
      for (const s of doc.sheets) {
        const m = new Map();
        for (const [r, c, v, st, f, of] of s.cells) {
          const cell = {r, c, v, st, src: f || null, orig: of || f || null};
          if (f) { try { cell.fn = compile(parse(f), s.name, r, c); } catch (e) { this.bad.push(`${s.name}!${colName(c)}${r}: ${e.message}`); } }
          m.set(r * 1024 + c, cell);
        }
        this.sheets.set(s.name, m);
      }
    }
    cell(sh, r, c) { const m = this.sheets.get(sh); return m ? m.get(r * 1024 + c) : undefined; }
    get(sh, r, c) {
      const m = this.sheets.get(sh);
      if (!m) throw REF;
      const k = r * 1024 + c, ov = this.over.get(sh + '!' + k);
      if (this.reads && this.depth > 0) this.reads.add(sh + '!' + k);
      if (this.trace) { const tk = sh + '!' + k, p = this.trace.get(tk); if (p === undefined || this.depth < p) this.trace.set(tk, this.depth); }
      if (ov !== undefined) return ov;
      const x = m.get(k);
      if (!x) return null;
      if (!x.fn) return x.v;
      if (x.pass === this.pass) return x.val;
      if (x.busy) return x.v;   // a loop: fall back to Excel's saved value
      x.busy = true;
      let v;
      this.depth++;
      try { v = x.fn(this); if (Array.isArray(v)) v = v.length === 1 ? v[0] : VALUE; }
      catch (e) { if (isErr(e)) v = e; else { x.busy = false; this.depth--; throw e; } }
      this.depth--; x.busy = false; x.val = v == null ? 0 : v; x.pass = this.pass;   // a formula pointing at an empty cell shows 0
      return x.val;
    }
    setOver(sh, r, c, v) { const k = sh + '!' + (r * 1024 + c); if (v == null) this.over.delete(k); else this.over.set(k, v); }
    // every cell the formula at sh!r,c reads, near or far, with how many steps away it is
    precedents(sh, r, c) { this.trace = new Map(); this.depth = 0; this.pass++; try { this.get(sh, r, c); } finally { var t = this.trace; this.trace = null; } return t; }
    // every cell some formula reads (inputs nothing reads drive nothing)
    readSet() { this.reads = new Set(); try { this.recalc(); } finally { var r = this.reads; this.reads = null; } return r; }
    recalc() { this.pass++; for (const [sh, m] of this.sheets) for (const x of m.values()) if (x.fn) this.get(sh, x.r, x.c); }
    value(sh, r, c) { const x = this.cell(sh, r, c), ov = this.over.get(sh + '!' + (r * 1024 + c)); if (ov !== undefined) return ov; return !x ? null : x.fn ? (x.pass === this.pass ? x.val : this.get(sh, r, c)) : x.v; }
  }

  const Calc = {Book, parse, colName, Err};
  if (typeof module !== 'undefined' && module.exports) { module.exports = Calc; return; }

  // ---------- page ----------
  const KEY = t => `equinox.fin.model.v1.${t}`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
  const HEAD = /^(Q[1-4]|H[12]|FY|CY)\s?'?\d{2,4}|^\d{4}[A-Za-z]?$/;

  function fmt(v, st) {
    if (v == null || v === '') return '';
    if (isErr(v)) return v.e;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v !== 'number') return String(v);
    const n = st && st.n;
    if (!n) { const r = Math.round(v * 1e4) / 1e4; return Math.abs(r) >= 1e4 ? r.toLocaleString('en-US', {maximumFractionDigits: 4}) : String(r); }
    const [kind, dec, fl] = n;
    if (kind === 'd') { const d = new Date(BASE + Math.round(v) * DAY); return d.toLocaleDateString('en-US', {month: 'short', year: '2-digit', timeZone: 'UTC'}); }
    let x = kind === 'p' ? v * 100 : v;
    if (fl.includes('-') && Math.abs(x) < 0.5 * 10 ** -dec) return '-';
    const body = Math.abs(x).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: fl.includes(',') || Math.abs(x) >= 1e4});
    const s = (fl.includes('$') ? '$' : '') + body + (kind === 'p' ? '%' : kind === 'x' ? 'x' : '');
    if (Math.round(x * 10 ** dec) === 0) return s;
    return x < 0 ? (fl.includes('(') ? `(${s})` : `-${s}`) : s;
  }

  let M = null, B = null, T = null, view = {sheet: null, period: 'q'}, ov = {}, links = {}, layout = null, el = null, reads = null;
  // sub-tab order: visible build sheets first, the Excel "Segments" roll-up last (hidden feed sheets stay live in Book/feed)
  const ROLL = /^segments$/i;
  const order = () => { const a = M.sheets.filter(s => !s.hidden).map(s => s.name); return a.length > 1 ? [...a.filter(n => !ROLL.test(n)), ...a.filter(n => ROLL.test(n))] : a; };
  const tabName = n => ROLL.test(n) && M.sheets.length > 1 ? 'Segments roll-up' : n;

  // Each sheet: header row (quarter labels), the flag row under it (1 = actual), body rows.
  function shape(s) {
    const g = new Map(s.cells.map(c => [c[0] * 1024 + c[1], c]));
    let hr = 2;
    for (let r = 1; r <= 6; r++) {
      let hits = 0;
      for (let c = 2; c <= s.cols; c++) { const x = g.get(r * 1024 + c); if (x && typeof x[2] === 'string' && HEAD.test(x[2].trim())) hits++; }
      if (hits >= 3) { hr = r; break; }
    }
    const flagRow = [hr + 1].find(r => {
      let hasN = false, hasActEst = false;
      for (let c = 2; c <= s.cols; c++) {
        const x = g.get(r * 1024 + c);
        if (x && x[4] && /^=N\(/.test(x[4])) hasN = true;
        if (x && typeof x[2] === 'string' && /^(Actual|EST)$/i.test(x[2].trim())) hasActEst = true;
      }
      return hasN || hasActEst;
    });
    const hideC = new Set(s.hide_cols), hideR = new Set(s.hide_rows);
    const cols = [];
    for (let c = 2; c <= s.cols; c++) {
      if (hideC.has(c)) continue;
      const h = g.get(hr * 1024 + c), label = h ? String(h[2] ?? '').trim() : '';
      const any = s.cells.some(x => x[1] === c && x[0] > hr);
      if (!any && !label) continue;
      cols.push({c, label: label || colName(c), fy: /^(FY|CY)/.test(label) || /^\d{4}/.test(label)});
    }
    // unlabeled columns after the last dated one are side notes (GEV's Power sheet has 22 of them): leave them off
    const lastLab = cols.map(x => HEAD.test(x.label)).lastIndexOf(true);
    if (lastLab >= 0) cols.splice(lastLab + 1);
    const seen = {}, rows = [];
    const top = flagRow || hr;
    for (let r = top + 1; r <= s.rows; r++) {
      if (hideR.has(r)) continue;
      const a = g.get(r * 1024 + 1), label = a ? String(a[2] ?? '') : '';
      const n = (seen[label] = (seen[label] || 0) + 1);
      rows.push({r, label, key: label ? (n > 1 ? `${label.trim()}#${n}` : label.trim()) : `r${r}`, st: a ? M.styles[a[3]] : {}});
    }
    const UNIT = /\b(millions?|billions?|thousands?|USD|JPY|\$m|\$bn)\b/i;
    const head = (() => { const x = g.get(hr * 1024 + 1); return x && x[2] ? String(x[2]) : ''; })();
    const unit = (() => { const x = g.get((flagRow || hr) * 1024 + 1); return x && x[2] ? String(x[2]) : UNIT.test(head) ? head : ''; })();
    const title = head && !UNIT.test(head) ? head : s.name;
    return {s, hr, flagRow, cols, rows, unit, title};
  }

  // a quarter is an estimate when its flag is 0 or "EST"; a year column when its label ends in "e" or its flag names EST/Consensus
  const isEst = (L, col) => {
    if (/\d[eE]$/.test(col.label)) return true;
    if (!L.flagRow) return false;
    const v = B.value(L.s.name, L.flagRow, col.c);
    if (col.fy) return typeof v === 'string' && /\b(EST|Consensus)\b/i.test(v);
    return v === 0 || v === false || (typeof v === 'string' && /^EST$/i.test(v.trim()));
  };
  function sheetPeriods(L) {
    const hasQ = L.cols.some(c => !c.fy);
    const hasA = L.cols.some(c => c.fy);
    const mode = view.period === 'a' || view.period === 'both' ? view.period : 'q';
    const eff = mode === 'q' && !hasQ ? 'a'
      : mode === 'a' && !hasA ? 'q'
      : mode === 'both' && (!hasQ || !hasA) ? (hasA ? 'a' : 'q')
      : mode;
    const cols = eff === 'q' ? L.cols.filter(c => !c.fy) : eff === 'a' ? L.cols.filter(c => c.fy) : L.cols;
    return {hasQ, hasA, eff, cols};
  }
  const okey = (L, row, col) => `${L.s.name}|${row.key}|${col.label}`;

  function applyOv() {
    B.over.clear();
    for (const s of M.sheets) {
      const L = layout.get(s.name);
      for (const row of L.rows) for (const col of L.cols) { const v = ov[okey(L, row, col)]; if (v != null) B.setOver(s.name, row.r, col.c, v); }
    }
    B.recalc();
  }

  // the models' blend wrapper "=flag*(BBG)+(1-flag)*(0.4053)": in an estimate column the typed number is the input
  const TYPED = /\+\s*\(1-\$?[A-Z]+\$?\d+\)\*\(\s*(\(?-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\)?)\s*\)$/;
  const typedVal = x => { const m = x && x.fn && x.src && x.src.match(TYPED); return m ? Number(m[1].replace(/[()]/g, '')) : undefined; };

  // "Online Stores under Growth assumptions, Q4 2026e": the group heading tells apart rows that share a name
  const keyLabel = (k, here) => {
    const [sh, rk, col] = k.split('|'), L = layout.get(sh);
    const i = L ? L.rows.findIndex(x => x.key === rk) : -1;
    let grp = '';
    for (let j = i - 1; j >= 0; j--) { const g = L.rows[j]; if (g.label.trim() && !L.cols.some(c => B.cell(sh, g.r, c.c))) { grp = g.label.trim(); break; } }
    return `${rk.replace(/#\d+$/, '')}${grp ? ' under ' + grp : ''}, ${col}${sh === here ? '' : ' on ' + sh};`.replace(/;$/, '');
  };
  const fxTitle = (x, edited, lk, here) => lk ? `Set by changing ${keyLabel(lk, here)}. Clear to restore ${x.orig || ''}`
    : edited ? 'Typed over. Clear to restore ' + (x.orig || '') : (x.orig || '');

  // Typing over a formula works backward, like Excel's Goal Seek: find the nearest typed input in an
  // estimate column that the formula reads, and solve for the value that makes the formula show the
  // typed number. The formula stays live. Returns {key, x} or null when no input moves it.
  function seek(L, r, c, want) {
    const sh = L.s.name, home = sh + '!' + (r * 1024 + c);
    const cands = [];
    for (const [tk, d] of B.precedents(sh, r, c)) {
      if (tk === home) continue;
      const i = tk.lastIndexOf('!'), s2 = tk.slice(0, i), k = +tk.slice(i + 1), rr = Math.floor(k / 1024), c2 = k % 1024;
      const L2 = layout.get(s2); if (!L2) continue;
      const row2 = L2.rows.find(x => x.r === rr), col2 = L2.cols.find(x => x.c === c2);
      if (!row2 || !col2 || !isEst(L2, col2)) continue;
      const x2 = B.cell(s2, rr, c2);
      if (!x2 || !(x2.fn ? typedVal(x2) !== undefined : typeof x2.v === 'number')) continue;
      cands.push({s2, rr, c2, d, key: okey(L2, row2, col2), near: (s2 === sh ? 2 : 0) + (c2 === c ? 1 : 0)});
    }
    cands.sort((a, b) => a.d - b.d || b.near - a.near || a.rr - b.rr);
    const tol = 1e-9 * Math.max(1, Math.abs(want));
    for (const cd of cands.slice(0, 12)) {
      const ok = B.over.get(cd.s2 + '!' + (cd.rr * 1024 + cd.c2));
      const f = x => { B.setOver(cd.s2, cd.rr, cd.c2, x); B.pass++; const v = B.get(sh, r, c); return typeof v === 'number' && isFinite(v) ? v - want : NaN; };
      let x0 = B.value(cd.s2, cd.rr, cd.c2); if (typeof x0 !== 'number' || !isFinite(x0)) x0 = 0;
      let x1 = x0 + (Math.abs(x0) > 1e-9 ? Math.abs(x0) * 0.01 : 0.01), f0 = f(x0), f1 = f(x1), hit = null;
      for (let n = 0; n < 40 && isFinite(f0) && isFinite(f1); n++) {
        if (Math.abs(f1) <= tol) { hit = x1; break; }
        if (Math.abs(f1 - f0) < 1e-15) break;
        const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
        x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
      }
      B.setOver(cd.s2, cd.rr, cd.c2, ok);
      if (hit != null) return {key: cd.key, x: Number(hit.toPrecision(12))};
    }
    return null;
  }

  function table(L) {
    const {cols} = sheetPeriods(L);
    const mix = cols.some(c => !c.fy) && cols.some(c => c.fy);
    const est = cols.map(col => isEst(L, col));
    const firstEst = est.indexOf(true);
    const head = `<thead><tr><th class="lab" scope="col"${L.unit ? ` title="${esc(L.unit)}"` : ''}>${esc(L.title)}</th>${cols.map((col, k) =>
      `<th scope="col" class="${est[k] ? 'est' : ''}${k === firstEst ? ' first-est' : ''}${mix && col.fy ? ' fy' : ''}">${esc(col.label)}${est[k] && !/\d[eE]$/.test(col.label) ? 'E' : ''}</th>`).join('')}</tr></thead>`;
    const body = L.rows.map(row => {
      const st = row.st || {};
      const hasVals = L.cols.some(col => B.cell(L.s.name, row.r, col.c));
      if (!row.label.trim() && !hasVals) return `<tr class="gap"><td class="lab"></td><td colspan="${cols.length}"></td></tr>`;
      const lead = row.label.match(/^\s*/)[0].length;
      const ind = (st.in || 0) + Math.floor(lead / 2);
      const cls = [st.b ? 'total' : '', st.u ? 'rule' : '', !hasVals ? 'grp' : ''].filter(Boolean).join(' ');
      const tds = cols.map((col, k) => {
        const x = B.cell(L.s.name, row.r, col.c);
        const cc = [est[k] ? 'est' : '', k === firstEst ? 'first-est' : '', mix && col.fy ? 'fy' : ''];
        if (!x) return `<td class="${cc.join(' ')}"></td>`;
        const cst = M.styles[x.st] || {};
        const edited = ov[okey(L, row, col)] != null;
        if (cst.b) cc.push('b');
        if (cst.i) cc.push('i');
        const read = reads.has(L.s.name + '!' + (row.r * 1024 + col.c));
        if (est[k] && isInput(x) && (read || edited)) {
          cc.push('inp'); if (edited) cc.push('edited');
          return `<td class="${cc.join(' ')}" data-r="${row.r}" data-c="${col.c}" data-s="${esc(L.s.name)}"><input inputmode="decimal" aria-label="${esc(row.label.trim() || 'Row ' + row.r)}, ${esc(col.label)}" title="Driver input. Type a new value; clear it to undo"></td>`;
        }
        if (x.fn) cc.push('fx');
        const lk = links[okey(L, row, col)];
        if (edited || lk) cc.push('edited');
        return `<td class="${cc.join(' ')}" data-r="${row.r}" data-c="${col.c}" data-s="${esc(L.s.name)}" title="${esc(fxTitle(x, edited, lk, L.s.name))}"></td>`;
      }).join('');
      return `<tr class="${cls}"><td class="lab" style="padding-left:${12 + ind * 14}px">${esc(row.label.trim())}</td>${tds}</tr>`;
    }).join('');
    return `<div class="fin-wrap mdl-wrap"><table class="fin mdl">${head}<tbody>${body}</tbody></table></div>`;
  }

  function fill(flash) {
    const maps = new Map();
    el.querySelectorAll('td[data-r]').forEach(td => {
      let m = maps.get(td.dataset.s);
      if (!m) { const L = layout.get(td.dataset.s); m = {L, rk: new Map(L.rows.map(x => [x.r, x])), ck: new Map(L.cols.map(x => [x.c, x]))}; maps.set(td.dataset.s, m); }
      const {L, rk, ck} = m;
      const r = +td.dataset.r, c = +td.dataset.c, x = B.cell(L.s.name, r, c), v = B.value(L.s.name, r, c), st = M.styles[x.st] || {};
      const k = okey(L, rk.get(r), ck.get(c)); td.classList.toggle('edited', ov[k] != null || !!links[k]);
      const t = fmt(v, st);
      const inp = td.querySelector('input');
      if (inp) { if (document.activeElement !== inp) inp.value = t; return; }
      if (td.textContent !== t) { td.textContent = t; if (flash) { td.classList.remove('flash'); void td.offsetWidth; td.classList.add('flash'); } }
      td.classList.toggle('neg', typeof v === 'number' && v < 0 && Math.round(v * 1e6) !== 0);
    });
  }

  const isInput = x => x && (x.fn ? typedVal(x) !== undefined : typeof x.v === 'number');

  function draw() {
    const names = order();
    if (!names.includes(view.sheet)) view.sheet = names[0];
    const L = layout.get(view.sheet), {hasQ, hasA, eff} = sheetPeriods(L);
    const edits = Object.keys(ov).length;
    const pBtns = [
      ['q', 'Quarterly', !hasQ, 'This sheet has annual periods only'],
      ['a', 'Annual', !hasA, 'This sheet has quarterly periods only'],
      ['both', 'Both', !hasQ || !hasA, !hasQ ? 'This sheet has annual periods only' : 'This sheet has quarterly periods only'],
    ].map(([v, label, dis, tip]) =>
      `<button type="button" data-period="${v}" aria-pressed="${eff === v}"${dis ? ` disabled title="${tip}"` : ''}>${label}</button>`
    ).join('');
    el.innerHTML = `<div class="mdl-sheets"><div class="seg" role="group" aria-label="Driver sheet">${names.map(n =>
      `<button type="button" data-sheet="${esc(n)}" aria-pressed="${n === view.sheet}">${esc(tabName(n))}</button>`).join('')}</div></div>` +
      `<div class="mdl-bar"><div class="seg" role="group" aria-label="Period">${pBtns}</div>` +
      `<span class="mdl-key"><b>Blue</b> = driver you can change. Black = formula.</span><span class="spacer"></span>` +
      `<button type="button" data-backup title="Save every edit on the Financials page, all companies, to a file">Back up</button>` +
      `<button type="button" data-restore title="Load edits from a backup file">Restore</button>` +
      `<button type="button" data-reset${edits ? '' : ' disabled'} title="${esc(M.file)}, saved ${M.saved}">Reset edits</button></div>` + table(L);
    fill(false);
  }

  function parseIn(text, st) {
    const t = String(text).replace(/[,\s$x]/g, '');
    if (t === '') return null;
    const pct = /%$/.test(t) || (st && st.n && st.n[0] === 'p');
    const n = Number(t.replace(/%$/, '').replace(/^\((.*)\)$/, '-$1'));
    if (!isFinite(n)) return undefined;
    return pct ? n / 100 : n;
  }

  function commit(td, text) {
    const L = layout.get(td.dataset.s), r = +td.dataset.r, c = +td.dataset.c;
    const row = L.rows.find(x => x.r === r), col = L.cols.find(x => x.c === c), x = B.cell(L.s.name, r, c);
    const v = parseIn(text, M.styles[x.st]);
    if (v === undefined) { fill(false); return; }
    const k = okey(L, row, col), was = snap();
    const tv = typedVal(x), live = x.fn && !(isEst(L, col) && tv !== undefined);
    if (live) {
      // a formula cell: undo clears the input it moved; a number solves for that input
      const drop = ik => { for (const t in links) if (links[t] === ik) delete links[t]; };   // one input follows one target, the newest
      if (links[k]) { const ik = links[k]; if (v == null) delete ov[ik]; drop(ik); }
      delete ov[k]; applyOv();
      if (v != null) {
        const got = seek(L, r, c, v);
        if (got) { drop(got.key); ov[got.key] = got.x; links[k] = got.key; } else ov[k] = v;
      }
    } else {
      const base = x.fn ? tv : x.v, same = v != null && typeof base === 'number' && Math.abs(v - base) < 1e-12;
      if (v == null || same) delete ov[k]; else ov[k] = v;
      for (const t in links) if (links[t] === k) delete links[t];   // typed straight into an input: it no longer follows a target
    }
    mark(was);
    store.set(KEY(T), {ov, links});
    applyOv();
    if (x.fn) td.title = fxTitle(x, ov[k] != null, links[k], L.s.name);
    const rb = el.querySelector('[data-reset]'); if (rb) rb.disabled = !Object.keys(ov).length;
    fill(true);
  }

  function wire() {
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-sheet]');
      if (b) { view.sheet = b.dataset.sheet; store.set('equinox.fin.model.view', view); draw(); return; }
      const p = e.target.closest('[data-period]');
      if (p && !p.disabled) { view.period = p.dataset.period; store.set('equinox.fin.model.view', view); draw(); return; }
      if (e.target.closest('[data-reset]')) { const was = snap(); ov = {}; links = {}; mark(was); store.set(KEY(T), {ov, links}); applyOv(); draw(); return; }
      if (e.target.closest('[data-backup]')) { backup(); return; }
      if (e.target.closest('[data-restore]')) restore();
    });
    el.addEventListener('dblclick', e => {
      const td = e.target.closest('td.fx');
      if (!td || td.querySelector('input')) return;
      const L = layout.get(td.dataset.s), v = B.value(L.s.name, +td.dataset.r, +td.dataset.c);
      td.textContent = '';
      const inp = document.createElement('input');
      inp.setAttribute('inputmode', 'decimal');
      inp.value = typeof v === 'number' ? String(Number(v.toPrecision(10))) : '';
      td.classList.add('inp', 'live'); td.appendChild(inp); inp.focus(); inp.select();
      const done = keep => { if (!td.contains(inp)) return; const t = inp.value; inp.remove(); td.classList.remove('inp', 'live'); if (keep) commit(td, t); else fill(false); };
      inp.addEventListener('blur', () => done(true));
      inp.addEventListener('keydown', k => { if (k.key === 'Enter') { k.preventDefault(); inp.blur(); } else if (k.key === 'Escape') { inp.removeEventListener('blur', done); done(false); } });
    });
    el.addEventListener('change', e => { const td = e.target.closest('td.inp:not(.live)'); if (td) commit(td, e.target.value); });
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.matches('td.inp:not(.live) input')) return;
      e.preventDefault(); e.target.dispatchEvent(new Event('change', {bubbles: true}));
      const td = e.target.closest('td'), tr = td.parentElement, k = [...tr.children].indexOf(td);
      let nx = tr.nextElementSibling; while (nx && !(nx.children[k] && nx.children[k].querySelector('input'))) nx = nx.nextElementSibling;
      if (nx) nx.children[k].querySelector('input').focus();
    });
    el.addEventListener('focusin', e => { if (e.target.matches('td.inp input')) { e.target.dataset.v0 = e.target.value; e.target.select(); } });
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!(e.ctrlKey || e.metaKey) || e.altKey || (k !== 'z' && k !== 'y') || !el || el.hidden) return;
      const a = document.activeElement, typing = a && a.matches('input:not([type=checkbox]), textarea, select');
      if (typing && (!el.contains(a) || a.value !== a.dataset.v0)) return;   // text still being typed: the browser undoes the typing
      const redo = k === 'y' || e.shiftKey, from = redo ? RE : UN, to = redo ? UN : RE;
      if (!from.length) return;
      e.preventDefault();
      to.push(snap()); ({ov, links} = JSON.parse(from.pop())); store.set(KEY(T), {ov, links}); applyOv(); draw();
    });
    window.addEventListener('pagehide', () => { const a = document.activeElement; if (a && el.contains(a) && a.matches('td.inp input')) a.dispatchEvent(new Event(a.closest('.live') ? 'blur' : 'change', {bubbles: true})); });
  }

  // Back up and restore every saved Financials edit (model edits, typed future quarters, views) as one JSON file.
  const OURS = k => k.startsWith('equinox.fin.');
  function backup() {
    const data = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (OURS(k)) data[k] = localStorage.getItem(k); } } catch (_) {}
    const blob = new Blob([JSON.stringify({equinox: 'financials-edits', made: new Date().toISOString(), data}, null, 1)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `equinox-financials-edits-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function restore() {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'application/json,.json';
    f.addEventListener('change', async () => {
      const file = f.files && f.files[0]; if (!file) return;
      let doc; try { doc = JSON.parse(await file.text()); } catch (_) { alert('That file could not be read.'); return; }
      const data = doc && doc.equinox === 'financials-edits' && doc.data;
      if (!data || typeof data !== 'object') { alert('That is not an Equinox financials backup.'); return; }
      const keys = Object.keys(data).filter(k => OURS(k) && typeof data[k] === 'string');
      if (!confirm(`Load ${keys.length} saved item${keys.length === 1 ? '' : 's'} from this backup? Edits for the same companies are replaced.`)) return;
      try { keys.forEach(k => localStorage.setItem(k, data[k])); } catch (_) { alert('The browser would not save the backup.'); return; }
      location.reload();
    });
    f.click();
  }

  let wired = false;
  // Ctrl/Cmd+Z steps back through the edits made since this model was opened; Shift+Z or Ctrl+Y steps forward
  let UN = [], RE = [];
  const snap = () => JSON.stringify({ov, links});
  const mark = was => { if (was === snap()) return; UN.push(was); if (UN.length > 200) UN.shift(); RE = []; };
  // read the model's saved edits for this company (shared by the Drivers tab and the Financials tabs)
  function load(ticker, doc) {
    if (T !== ticker || M !== doc) {
      T = ticker; M = doc; B = new Book(doc);
      if (B.bad.length) console.warn('Model formulas not read:', B.bad.slice(0, 10));
      layout = new Map(doc.sheets.map(s => [s.name, shape(s)]));
      reads = B.readSet();
      const saved = store.get(KEY(T), {}); ov = saved.ov || {}; links = saved.links || {}; UN = []; RE = [];
      const mainPeriod = (store.get('equinox.fin.view', {}) || {}).period;
      view = Object.assign({sheet: null, period: mainPeriod === 'a' ? 'a' : 'q'}, store.get('equinox.fin.model.view', {}) || {});
      applyOv();
    }
  }
  function mount(target, ticker, doc) {
    el = target;
    if (!wired) { wire(); wired = true; }
    load(ticker, doc);
    draw();
  }

  // The Financials tabs read a segment's estimate from the driver-sheet rows it is linked to
  // (doc.links), plus optional income-statement (doc.is_links) and KPI (doc.kpi_links) feeds.
  // Returns null when the model has no links. get(name, fy, fq) gives the summed rows for that
  // fiscal quarter (or full year when fq is null), with the model's edits applied.
  function feed(ticker, doc) {
    const lk = doc && doc.links;
    if (!lk || !Object.keys(lk).length) return null;
    const isLk = (doc && doc.is_links) || {}, kpiLk = (doc && doc.kpi_links) || {};
    const cache = new Map();
    const where = ref => {
      if (cache.has(ref)) return cache.get(ref);
      const i = ref.indexOf('|'), sh = ref.slice(0, i), rk = ref.slice(i + 1);
      const L0 = layout.get(sh);
      const row = L0 && L0.rows.find(x => x.key === rk);
      const cols = new Map(L0 ? L0.cols.map(c => [c.label.replace(/[eE]$/, ''), c.c]) : []);
      const w = row ? {sh, r: row.r, cols} : null;
      cache.set(ref, w); return w;
    };
    const readOne = (ref, fy, fq) => {
      if (!ref) return null;
      if (T !== ticker || M !== doc) load(ticker, doc);
      const w = where(ref), key = fq == null ? `FY ${fy}` : `Q${fq} ${fy}`, c = w && w.cols.get(key);
      if (!c) return null;
      const v = B.value(w.sh, w.r, c);
      return typeof v === 'number' && isFinite(v) ? v : null;
    };
    const readSpec = (spec, fy, fq) => {
      if (!spec) return null;
      if (typeof spec === 'string') return readOne(spec, fy, fq);
      const arr = Array.isArray(spec) ? spec : (spec.from || []);
      if (!arr.length) return null;
      let t = 0;
      for (const ref of arr) {
        const v = readOne(ref, fy, fq);
        if (v == null) return null;
        t += v;
      }
      const sc = !Array.isArray(spec) && typeof spec.scale === 'number' ? spec.scale : 1;
      return t * sc;
    };
    return {
      links: lk,
      is_links: isLk,
      is_extra: (doc && doc.is_extra) || null,
      kpi_links: kpiLk,
      fcst_quarters: (doc && doc.fcst_quarters) || null,
      get(name, fy, fq) {
        const l = lk[name]; if (!l) return null;
        return readSpec(l.from, fy, fq);
      },
      getLine(key, fy, fq) { return readSpec(isLk[key], fy, fq); },
      getKpi(name, fy, fq) { return readSpec(kpiLk[name], fy, fq); },
    };
  }

  root.EquinoxModel = {mount, feed, Calc};
})(typeof window !== 'undefined' ? window : globalThis);
