#!/usr/bin/env node
/* Builds levels.js: 100 fixed levels, each with exactly one answer.

   For every level: grow a window out of panes that already follow the rules (that is
   the answer), then let the solver look for a second answer. While one exists, add
   a clue the second answer breaks (a fixed line, or a number when the level uses
   numbers). Finally drop every clue the puzzle doesn't need.

   Usage: node tools/make-levels.js [first] [last]   (default 1 100)
   Same input, same output: each level has its own random seed. */
"use strict";
const fs = require("fs"), path = require("path");
const GK = require("../core.js");
const { key, unkey, DIRS, SHAPES, POLY, orientations, canon, allowedPolys, wallsOf, solve, encodeMap, decodeLevel } = GK;

/* ---------- seeded random ---------- */
let seed = 1;
const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (a) => a[ri(0, a.length - 1)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ---------- the level plan ---------- */
const sizes = (a, b) => ({ type: "sizes", set: range(a, b) });
const R = (t, extra) => Object.assign({ type: t }, extra || {});
const CHAPTERS = [
  "First panes", "Numbers", "Dots", "Look-alikes", "Neighbours",
  "Mirrors", "Mixed I", "Mixed II", "Mixed III", "Mixed IV",
];
function plan(n) {
  const P = (rules, target) => ({ rules, target });
  const fixed = {
    1: P([R("shapes", { shapes: [SHAPES.I3] })], 9),
    2: P([R("shapes", { shapes: [SHAPES.I3] })], 12),
    3: P([R("shapes", { shapes: [SHAPES.L3] })], 12),
    4: P([R("shapes", { shapes: [SHAPES.I3, SHAPES.L3] })], 15),
    5: P([R("size", { n: 4 })], 16),
    6: P([R("shapes", { shapes: [SHAPES.I4, SHAPES.O4, SHAPES.L4] })], 20),
    7: P([sizes(2, 4)], 18),
    8: P([R("size", { n: 4 }), R("distinct")], 20),
    9: P([R("size", { n: 5 })], 20),
    10: P([sizes(3, 5), R("count")], 24),
    // Numbers
    11: P([sizes(2, 4), R("numbers")], 15), 12: P([sizes(2, 4), R("numbers")], 18), 13: P([sizes(2, 5), R("numbers")], 20),
    14: P([sizes(2, 5), R("numbers")], 24), 15: P([sizes(3, 5), R("numbers")], 25), 16: P([sizes(2, 5), R("numbers")], 28),
    17: P([sizes(1, 5), R("numbers")], 28), 18: P([sizes(2, 6), R("numbers")], 30), 19: P([sizes(2, 6), R("numbers")], 32),
    20: P([sizes(1, 6), R("numbers")], 36),
    // Dots
    21: P([sizes(2, 4), R("dots")], 15), 22: P([sizes(2, 4), R("dots")], 18), 23: P([sizes(2, 5), R("dots")], 20),
    24: P([sizes(2, 5), R("dots")], 24), 25: P([sizes(2, 5), R("dots"), R("rect")], 24), 26: P([sizes(2, 6), R("dots"), R("rect")], 28),
    27: P([sizes(3, 5), R("dots"), R("norect")], 25), 28: P([sizes(2, 6), R("dots")], 30), 29: P([sizes(3, 5), R("dots"), R("norect")], 30),
    30: P([sizes(2, 6), R("dots"), R("rect")], 34),
    // Look-alikes
    31: P([R("size", { n: 4 }), R("same")], 16), 32: P([R("size", { n: 4 }), R("same")], 24), 33: P([R("size", { n: 5 }), R("same")], 20),
    34: P([sizes(3, 5), R("distinct")], 24), 35: P([R("size", { n: 4 }), R("nbshape")], 24), 36: P([sizes(3, 4), R("nbshape"), R("numbers")], 26),
    37: P([R("size", { n: 5 }), R("same")], 30), 38: P([sizes(3, 5), R("distinct"), R("numbers")], 30), 39: P([R("size", { n: 5 }), R("nbshape")], 30),
    40: P([sizes(3, 5), R("nbshape"), R("dots")], 34),
    // Neighbours
    41: P([sizes(1, 3), R("nbsize")], 15), 42: P([sizes(1, 4), R("nbsize")], 18), 43: P([sizes(2, 4), R("nbsize"), R("numbers")], 22),
    44: P([sizes(2, 5), R("edge")], 20), 45: P([sizes(2, 5), R("edge"), R("numbers")], 24), 46: P([sizes(1, 4), R("nbsize"), R("dots")], 24),
    47: P([sizes(2, 5), R("nbsize"), R("numbers")], 28), 48: P([sizes(2, 5), R("edge"), R("dots")], 28), 49: P([sizes(1, 5), R("nbsize"), R("numbers")], 32),
    50: P([sizes(2, 5), R("nbsize"), R("edge")], 30),
    // Mirrors
    51: P([sizes(2, 5), R("symmetric")], 18), 52: P([sizes(3, 5), R("symmetric"), R("numbers")], 22), 53: P([R("size", { n: 5 }), R("no2x2")], 20),
    54: P([sizes(3, 6), R("no2x2"), R("numbers")], 26), 55: P([sizes(3, 5), R("norect"), R("numbers")], 24), 56: P([sizes(3, 5), R("symmetric"), R("dots")], 28),
    57: P([R("size", { n: 6 }), R("no2x2")], 24), 58: P([sizes(3, 6), R("symmetric"), R("numbers")], 30), 59: P([sizes(4, 6), R("norect"), R("no2x2"), R("dots")], 30),
    60: P([sizes(3, 6), R("symmetric"), R("nbsize")], 32),
  };
  if (fixed[n]) return fixed[n];
  // 61–100: mixes, getting bigger
  const t = Math.min(28 + Math.floor((n - 61) / 4) * 2, 46);
  const mixes = [
    () => [sizes(2, 5), R("numbers"), R("nbsize")],
    () => [sizes(2, 6), R("numbers")],
    () => [sizes(2, 5), R("dots"), R("nbshape")],
    () => [sizes(3, 5), R("distinct"), R("numbers")],
    () => [sizes(3, 6), R("symmetric"), R("numbers")],
    () => [sizes(2, 6), R("dots"), R("rect")],
    () => [R("size", { n: pick([4, 5]) }), R("same")],
    () => [sizes(3, 6), R("no2x2"), R("dots")],
    () => [sizes(2, 5), R("edge"), R("numbers")],
    () => [sizes(3, 5), R("norect"), R("nbshape")],
    () => [sizes(1, 6), R("numbers")],
    () => [sizes(2, 4), R("nbsize"), R("dots")],
  ];
  return P(mixes[(n * 7) % mixes.length](), t);
}

/* ---------- growing a window out of an answer ---------- */
function grow(rules, target) {
  const has = (t) => rules.some((r) => r.type === t);
  let pool = allowedPolys(rules).filter(([, c]) => c.length >= 1);
  if (has("same")) pool = [pick(pool.filter(([, c]) => c.length >= 2))];
  const ones = pool.filter(([, c]) => c.length === 1), others = pool.filter(([, c]) => c.length > 1);
  const distinct = has("distinct"), nbsize = has("nbsize"), nbshape = has("nbshape");
  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const owner = new Map(), panes = [], kinds = [], used = new Set();
    let filled = 0;
    const tryPlace = (abs, k) => {
      if (abs.some((c) => owner.has(key(...c)))) return false;
      for (const [x, y] of abs) for (const [dx, dy] of DIRS) {
        const o = owner.get(key(x + dx, y + dy)); if (o === undefined) continue;
        if (nbsize && panes[o].length === abs.length) return false;
        if (nbshape && kinds[o] === k) return false;
      }
      const id = panes.length; panes.push(abs); kinds.push(k); abs.forEach((c) => owner.set(key(...c), id));
      used.add(k); filled += abs.length; return true;
    };
    // single squares are allowed by some rules but make dull puzzles: use them rarely
    const choose = () => { const a = (rand() < 0.08 && ones.length ? ones : others).filter(([k]) => !distinct || !used.has(k)); return a.length ? pick(a) : null; };
    { const c0 = choose(); if (!c0) break; tryPlace(pick(orientations(c0[1])), c0[0]); }
    let fails = 0;
    while (filled < target && fails < 500) {
      const front = new Map();
      for (const k of owner.keys()) { const [x, y] = unkey(k);
        for (const [dx, dy] of DIRS) { const nk = key(x + dx, y + dy); if (!owner.has(nk)) front.set(nk, (front.get(nk) || 0) + 1); } }
      const fr = [...front.entries()]; fr.sort((p, q) => q[1] - p[1] || rand() - 0.5);
      const [ek] = rand() < 0.75 ? fr[ri(0, Math.min(3, fr.length - 1))] : pick(fr);
      const [ex, ey] = unkey(ek), c = choose(); if (!c) break;
      const o = pick(orientations(c[1])), [ax, ay] = pick(o);
      const abs = o.map(([x, y]) => [x - ax + ex, y - ay + ey]);
      if (filled + abs.length > target + 1 || !tryPlace(abs, c[0])) fails++;
    }
    const score = Math.abs(filled - target);
    if (!best || score < best.score) best = { panes, score };
    if (score <= 1) break;
  }
  const all = best.panes.flat(), mx = Math.min(...all.map((c) => c[0])), my = Math.min(...all.map((c) => c[1]));
  return best.panes.map((p) => p.map(([x, y]) => [x - mx, y - my]));
}

/* ---------- making the answer the only answer ---------- */
const NODE_LIMIT = 3e6;
function build(n) {
  const spec = plan(n);
  for (let attempt = 0; attempt < 40; attempt++) {
    const rules = spec.rules.map((r) => ({ ...r }));
    const panes = grow(rules, spec.target);
    const cells = panes.flat();
    const cellSet = new Set(cells.map((c) => key(...c)));
    for (const r of rules) if (r.type === "count") r.k = panes.length;
    const has = (t) => rules.some((r) => r.type === t);
    // the edge rule only works if every pane in the answer reaches the frame
    if (has("edge") && !panes.every((p) => p.some(([x, y]) => DIRS.some(([dx, dy]) => !cellSet.has(key(x + dx, y + dy)))))) continue;
    const dots = has("dots") ? panes.map((p) => pick(p)) : [];
    const sizeOf = new Map(); panes.forEach((p) => p.forEach((c) => sizeOf.set(key(...c), p.length)));
    const solWalls = new Set(wallsOf(panes));
    const numbers = new Map(), givens = new Set();
    const puzzle = () => ({ cells, rules, givens: [...givens],
      ctx: { cellSet, numbers: new Map(numbers), dots: new Set(dots.map((c) => key(...c))) } });
    const isAnswer = (sol) => { const w = wallsOf(sol); return w.length === solWalls.size && w.every((e) => solWalls.has(e)); };

    let unique = false;
    for (let step = 0; step < 80; step++) {
      const res = solve(puzzle(), 2, NODE_LIMIT);
      if (res.count === 1 && !res.aborted) { if (!isAnswer(res.sols[0])) break; unique = true; break; }
      if (res.count === 0 && !res.aborted) break; // should never happen: the answer always fits
      const alt = res.sols.find((s) => !isAnswer(s));
      let added = false;
      if (alt && has("numbers")) {
        // a square whose pane size differs between the answer and the other answer
        const altSize = new Map(); alt.forEach((p) => p.forEach((c) => altSize.set(key(...c), p.length)));
        const diff = cells.filter((c) => !numbers.has(key(...c)) && altSize.get(key(...c)) !== sizeOf.get(key(...c)));
        if (diff.length) { const c = pick(diff); numbers.set(key(...c), sizeOf.get(key(...c))); added = true; }
      }
      if (!added) {
        const altWalls = alt ? new Set(wallsOf(alt)) : new Set();
        let cand = [...solWalls].filter((e) => !givens.has(e) && !altWalls.has(e));
        if (!cand.length && !alt) cand = [...solWalls].filter((e) => !givens.has(e));
        if (!cand.length && alt && has("numbers")) {
          const c = pick(cells.filter((c) => !numbers.has(key(...c)))); if (c) { numbers.set(key(...c), sizeOf.get(key(...c))); added = true; }
        }
        if (!added && !cand.length && !has("count")) {
          // the other answer only splits panes up (or joins them): a pane count rules that out
          rules.push({ type: "count", k: panes.length }); added = true;
        }
        if (!added) { if (!cand.length) break; givens.add(pick(cand)); }
      }
    }
    if (!unique) continue;

    // drop clues the puzzle doesn't need (numbers first, they're the friendlier clue)
    const clues = shuffle([...[...givens].map((e) => ["g", e]), ...[...numbers.keys()].map((k) => ["n", k])])
      .sort((a, b) => (a[0] === "g" ? 0 : 1) - (b[0] === "g" ? 0 : 1));
    for (const [t, v] of clues) {
      let back;
      if (t === "g") givens.delete(v); else { back = numbers.get(v); numbers.delete(v); }
      const res = solve(puzzle(), 2, NODE_LIMIT);
      if (!(res.count === 1 && !res.aborted)) { if (t === "g") givens.add(v); else numbers.set(v, back); }
    }
    // a level that starts nearly drawn in isn't a puzzle
    if (givens.size > solWalls.size * 0.6) continue;

    const out = { chapter: CHAPTERS[Math.floor((n - 1) / 10)], rules, map: encodeMap(cells, panes) };
    if (givens.size) out.givens = [...givens].sort();
    if (numbers.size) out.numbers = [...numbers.entries()].map(([k, v]) => [...unkey(k), v]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (dots.length) out.dots = dots.map((c) => c.slice()).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return out;
  }
  throw new Error("Couldn't build level " + n);
}

/* ---------- main ---------- */
const first = +(process.argv[2] || 1), last = +(process.argv[3] || 100);
const file = path.join(__dirname, "..", "levels.js");
let levels = [];
if (fs.existsSync(file)) { const m = fs.readFileSync(file, "utf8").match(/GK_LEVELS = (\[[\s\S]*\]);/); if (m) levels = JSON.parse(m[1]); }
for (let n = first; n <= last; n++) {
  seed = (n * 2654435761) >>> 0;
  const t0 = Date.now();
  levels[n - 1] = build(n);
  const L = levels[n - 1], d = decodeLevel(L, n);
  const check = solve({ cells: d.cells, rules: d.rules, givens: d.givens, ctx: d.ctx }, 2, 2e7);
  if (check.count !== 1 || check.aborted) throw new Error(`Level ${n} isn't unique`);
  console.log(`level ${String(n).padStart(3)}  ${String(d.cells.length).padStart(2)} squares  ${String(d.solution.length).padStart(2)} panes  ` +
    `${(L.givens || []).length} lines  ${(L.numbers || []).length} numbers  ${(L.dots || []).length} dots  ` +
    `${L.rules.map((r) => r.type).join("+")}  ${Date.now() - t0}ms`);
}
const body = "/* Generated by tools/make-levels.js. Each level has exactly one answer. */\n" +
  "window.GK_LEVELS = [\n" + levels.map((l) => "  " + JSON.stringify(l)).join(",\n") + "\n];\n";
fs.writeFileSync(file, body.replace("window.GK_LEVELS", "var GK_LEVELS = window.GK_LEVELS"));
