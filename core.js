/* Glasskat core: shapes, rules, checking and the solver.
   Shared by the game (index.html) and the level builder (tools/make-levels.js). */
(function (root) {
"use strict";
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => x + "," + y;
const unkey = (k) => k.split(",").map(Number);

/* ---------- polyominoes ---------- */
function normalize(cells) {
  const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const rotate = (c) => normalize(c.map(([x, y]) => [-y, x]));
const flip = (c) => normalize(c.map(([x, y]) => [-x, y]));
const sig = (c) => normalize(c).map((p) => p.join(".")).join("|");
function orientations(cells) {
  const out = new Map(); let s = normalize(cells);
  for (let f = 0; f < 2; f++) { for (let r = 0; r < 4; r++) { out.set(sig(s), s); s = rotate(s); } s = flip(s); }
  return [...out.values()];
}
const canonCache = new Map();
function canon(c) {
  const s0 = sig(c); let v = canonCache.get(s0);
  if (v === undefined) { v = orientations(c).map(sig).sort()[0]; canonCache.set(s0, v); }
  return v;
}
function isRect(c) { const n = normalize(c); return (Math.max(...n.map((p) => p[0])) + 1) * (Math.max(...n.map((p) => p[1])) + 1) === c.length; }
// symmetrical = some mirror (vertical, horizontal or either diagonal) maps the shape onto itself
function isSym(c) {
  const s = sig(c); let r = normalize(c);
  for (let i = 0; i < 4; i++) { if (sig(flip(r)) === s) return true; r = rotate(r); }
  return false;
}
function has2x2(c) {
  const set = new Set(c.map((p) => key(p[0], p[1])));
  return c.some(([x, y]) => set.has(key(x + 1, y)) && set.has(key(x, y + 1)) && set.has(key(x + 1, y + 1)));
}

const POLY = new Map(); // every free polyomino up to 6 squares: canon -> cells
(function enumerate() {
  let layer = new Map([[canon([[0, 0]]), [[0, 0]]]]);
  for (const [k, v] of layer) POLY.set(k, v);
  for (let n = 2; n <= 6; n++) {
    const next = new Map();
    for (const cells of layer.values()) {
      const set = new Set(cells.map((c) => key(...c)));
      for (const [x, y] of cells) for (const [dx, dy] of DIRS) {
        if (set.has(key(x + dx, y + dy))) continue;
        const nc = normalize([...cells, [x + dx, y + dy]]), k = canon(nc);
        if (!next.has(k)) next.set(k, nc);
      }
    }
    for (const [k, v] of next) POLY.set(k, v);
    layer = next;
  }
})();
const S = (str) => canon(str.split(" ").map((p) => p.split(",").map(Number)));
const SHAPES = {
  I2: S("0,0 1,0"), I3: S("0,0 1,0 2,0"), L3: S("0,0 0,1 1,1"),
  I4: S("0,0 1,0 2,0 3,0"), O4: S("0,0 1,0 0,1 1,1"), T4: S("0,0 1,0 2,0 1,1"), S4: S("1,0 2,0 0,1 1,1"), L4: S("0,0 0,1 0,2 1,2"),
  P5: S("0,0 1,0 0,1 1,1 0,2"), plus: S("1,0 0,1 1,1 2,1 1,2"), U5: S("0,0 2,0 0,1 1,1 2,1"), L5: S("0,0 0,1 0,2 0,3 1,3"),
  T5: S("0,0 1,0 2,0 1,1 1,2"), V5: S("0,0 0,1 0,2 1,2 2,2"), W5: S("0,0 0,1 1,1 1,2 2,2"), Z5: S("0,0 1,0 1,1 1,2 2,2"),
};

/* ---------- rules ----------
   Per-pane rules are checked on each pane on its own. Some also need the board:
   numbers (a number is its pane's size), dots (one dot per pane), edge (touches the frame). */
const SHAPE_ONLY = new Set(["shapes", "size", "sizes", "rect", "norect", "symmetric", "no2x2"]);
const PER_PANE = new Set([...SHAPE_ONLY, "numbers", "dots", "edge"]);
const RANGE = (set) => set.length > 2 && set.every((v, i) => i === 0 || v === set[i - 1] + 1);

function ruleText(r) {
  switch (r.type) {
    case "shapes": return r.shapes.length === 1 ? "Every pane is this shape" : "Every pane is one of these shapes";
    case "size": return `Every pane has ${r.n} squares`;
    case "sizes": return RANGE(r.set) ? `Every pane has ${r.set[0]}–${r.set.at(-1)} squares`
      : `Every pane has ${r.set.slice(0, -1).join(", ")} or ${r.set.at(-1)} squares`;
    case "rect": return "Every pane is a rectangle";
    case "norect": return "No pane is a rectangle";
    case "symmetric": return "Every pane is symmetrical (it matches its mirror image)";
    case "no2x2": return "No pane contains a 2×2 block";
    case "numbers": return "A number shows the size of its pane";
    case "dots": return "Every pane has exactly one dot";
    case "edge": return "Every pane touches the frame";
    case "distinct": return "No two panes are the same shape";
    case "same": return "Every pane is the same shape";
    case "count": return `Exactly ${r.k} panes`;
    case "nbsize": return "Touching panes are different sizes";
    case "nbshape": return "Touching panes are different shapes";
  }
  return "";
}
function shapeOk(r, cells) {
  switch (r.type) {
    case "shapes": return cells.length <= 6 && r.shapes.includes(canon(cells));
    case "size": return cells.length === r.n;
    case "sizes": return r.set.includes(cells.length);
    case "rect": return isRect(cells);
    case "norect": return !isRect(cells);
    case "symmetric": return isSym(cells);
    case "no2x2": return !has2x2(cells);
  }
  return true;
}
// ctx: { cellSet: Set of "x,y", numbers: Map "x,y" -> n, dots: Set "x,y" }
function paneOk(r, cells, ctx) {
  if (SHAPE_ONLY.has(r.type)) return shapeOk(r, cells);
  if (r.type === "numbers") return cells.every(([x, y]) => { const n = ctx.numbers.get(key(x, y)); return n === undefined || n === cells.length; });
  if (r.type === "dots") return cells.filter(([x, y]) => ctx.dots.has(key(x, y))).length === 1;
  if (r.type === "edge") return cells.some(([x, y]) => DIRS.some(([dx, dy]) => !ctx.cellSet.has(key(x + dx, y + dy))));
  return true;
}
function maxSize(rules) {
  let m = 6;
  for (const r of rules) {
    if (r.type === "size") m = Math.min(m, r.n);
    if (r.type === "sizes") m = Math.min(m, Math.max(...r.set));
    if (r.type === "shapes") m = Math.min(m, Math.max(...r.shapes.map((s) => POLY.get(s).length)));
  }
  return m;
}
// every shape a pane could legally be, given the shape-only rules
function allowedPolys(rules) {
  const m = maxSize(rules), sr = rules.filter((r) => SHAPE_ONLY.has(r.type));
  return [...POLY.entries()].filter(([, c]) => c.length <= m && sr.every((r) => shapeOk(r, c)));
}

/* ---------- walls ---------- */
const edgeR = (x, y) => `${x},${y},r`, edgeD = (x, y) => `${x},${y},d`;
function edgeBetween(a, b) {
  const [ax, ay] = a, [bx, by] = b;
  if (ay === by && Math.abs(ax - bx) === 1) return edgeR(Math.min(ax, bx), ay);
  if (ax === bx && Math.abs(ay - by) === 1) return edgeD(ax, Math.min(ay, by));
  return null;
}
function wallsOf(panes) {
  const own = new Map(); panes.forEach((p, i) => p.forEach((c) => own.set(key(...c), i)));
  const out = [];
  for (const [k, i] of own) { const [x, y] = unkey(k);
    const r = own.get(key(x + 1, y)), d = own.get(key(x, y + 1));
    if (r !== undefined && r !== i) out.push(edgeR(x, y));
    if (d !== undefined && d !== i) out.push(edgeD(x, y)); }
  return out;
}

/* ---------- checking a board ----------
   regions: list of panes (arrays of [x,y]); regionOf: Map "x,y" -> region index;
   walls: every line on the board. A line must separate two panes: a pane with a
   line ending inside it ("stray") isn't finished. */
function strayWalls(walls, regionOf) {
  const out = [];
  for (const e of walls || []) { const [x, y, t] = e.split(","), a = key(+x, +y), b = t === "r" ? key(+x + 1, +y) : key(+x, +y + 1);
    const ra = regionOf.get(a); if (ra !== undefined && ra === regionOf.get(b)) out.push(e); }
  return out;
}
function evaluate(p, regions, regionOf, walls) {
  const ctx = p.ctx, perPane = p.rules.filter((r) => PER_PANE.has(r.type));
  const stray = strayWalls(walls, regionOf), strayIn = new Set(stray.map((e) => { const [x, y] = e.split(","); return regionOf.get(key(+x, +y)); }));
  const valid = regions.map((c, i) => !strayIn.has(i) && perPane.every((r) => paneOk(r, c, ctx)));
  const conflict = new Set(), status = [];
  const validCells = regions.reduce((s, c, i) => s + (valid[i] ? c.length : 0), 0);
  const allValid = valid.every(Boolean);
  const touching = (i, fn) => { for (const [x, y] of regions[i]) for (const [dx, dy] of DIRS) {
    const o = regionOf.get(key(x + dx, y + dy)); if (o !== undefined && o !== i && valid[o] && fn(o)) return true; } return false; };
  for (const r of p.rules) {
    let bad = false, extra = "";
    if (PER_PANE.has(r.type)) {
      // an unfinished region may still be split, so per-pane rules only ever turn green
    } else if (r.type === "distinct") {
      const seen = new Map();
      regions.forEach((c, i) => { if (!valid[i]) return; const k = canon(c);
        if (seen.has(k)) { conflict.add(i); conflict.add(seen.get(k)); bad = true; } else seen.set(k, i); });
    } else if (r.type === "same") {
      const ks = new Map(); regions.forEach((c, i) => { if (valid[i]) { const k = canon(c); ks.set(k, (ks.get(k) || 0) + 1); } });
      if (ks.size > 1) { const top = [...ks.entries()].sort((a, b) => b[1] - a[1])[0][0];
        regions.forEach((c, i) => { if (valid[i] && canon(c) !== top) conflict.add(i); }); bad = true; }
    } else if (r.type === "nbsize") {
      regions.forEach((c, i) => { if (valid[i] && touching(i, (o) => regions[o].length === c.length)) { conflict.add(i); bad = true; } });
    } else if (r.type === "nbshape") {
      regions.forEach((c, i) => { if (valid[i] && touching(i, (o) => canon(regions[o]) === canon(c))) { conflict.add(i); bad = true; } });
    } else if (r.type === "count") {
      const n = regions.filter((_, i) => valid[i]).length;
      extra = ` · ${n}/${r.k}`; bad = n > r.k;
    }
    const ok = !bad && allValid && (r.type !== "count" || regions.length === r.k);
    status.push({ state: bad ? "bad" : ok ? "ok" : "open", extra });
  }
  const win = allValid && conflict.size === 0 && status.every((s) => s.state === "ok");
  return { valid, conflict, status, validCells, win, stray };
}

/* ---------- solver ----------
   Counts the ways to split the board under the rules (stops at `limit`).
   Exact cover: always fill the first empty square, with every legal pane whose
   first square (in reading order) is that square. */
function solve(p, limit = 2, nodeLimit = 2e6) {
  const cells = p.cells.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const N = cells.length, idx = new Map(cells.map((c, i) => [key(...c), i]));
  const fixed = new Set(p.givens || []), ctx = p.ctx;
  const ctxRules = p.rules.filter((r) => r.type === "numbers" || r.type === "dots" || r.type === "edge");
  const byFirst = cells.map(() => []);
  for (const [k, base] of allowedPolys(p.rules)) {
    for (const o of orientations(base)) {
      const [ox, oy] = o[0];
      for (let i = 0; i < N; i++) {
        const [cx, cy] = cells[i], abs = o.map(([x, y]) => [x - ox + cx, y - oy + cy]);
        if (!abs.every((c) => idx.has(key(...c)))) continue;
        const set = new Set(abs.map((c) => key(...c)));
        let ok = true;
        for (const [x, y] of abs) {
          if (set.has(key(x + 1, y)) && fixed.has(edgeR(x, y))) { ok = false; break; }
          if (set.has(key(x, y + 1)) && fixed.has(edgeD(x, y))) { ok = false; break; }
        }
        if (!ok || !ctxRules.every((r) => paneOk(r, abs, ctx))) continue;
        byFirst[i].push({ cells: abs.map((c) => idx.get(key(...c))), size: abs.length, canon: k });
      }
    }
  }
  const nbrs = cells.map(([x, y]) => DIRS.map(([dx, dy]) => idx.get(key(x + dx, y + dy))).filter((v) => v !== undefined));
  const has = (t) => p.rules.some((r) => r.type === t);
  const distinct = has("distinct"), same = has("same"), nbsize = has("nbsize"), nbshape = has("nbshape");
  const countRule = p.rules.find((r) => r.type === "count"), K = countRule ? countRule.k : Infinity;
  const owner = new Int32Array(N).fill(-1), placed = [], used = new Map();
  const sols = []; let nodes = 0, aborted = false;
  function dfs(pos) {
    if (aborted || sols.length >= limit) return;
    if (++nodes > nodeLimit) { aborted = true; return; }
    while (pos < N && owner[pos] >= 0) pos++;
    if (pos === N) { if (placed.length === K || K === Infinity) sols.push(placed.map((pl) => pl.cells.map((i) => cells[i]))); return; }
    if (placed.length >= K) return;
    for (const pl of byFirst[pos]) {
      if (pl.cells.some((i) => owner[i] >= 0)) continue;
      if (distinct && used.get(pl.canon)) continue;
      if (same && placed.length && placed[0].canon !== pl.canon) continue;
      if (nbsize || nbshape) {
        let clash = false;
        for (const i of pl.cells) { for (const j of nbrs[i]) { const o = owner[j];
          if (o >= 0 && ((nbsize && placed[o].size === pl.size) || (nbshape && placed[o].canon === pl.canon))) { clash = true; break; } } if (clash) break; }
        if (clash) continue;
      }
      const id = placed.length; placed.push(pl); used.set(pl.canon, (used.get(pl.canon) || 0) + 1);
      for (const i of pl.cells) owner[i] = id;
      dfs(pos + 1);
      for (const i of pl.cells) owner[i] = -1;
      placed.pop(); used.set(pl.canon, used.get(pl.canon) - 1);
      if (aborted || sols.length >= limit) return;
    }
  }
  dfs(0);
  return { count: sols.length, aborted, sols, nodes };
}

/* ---------- level format ----------
   map: rows of characters, "." = not part of the window, any other character = the
   pane that square belongs to in the answer. */
function decodeLevel(L, number) {
  const cells = [], panes = new Map();
  L.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === ".") return; cells.push([x, y]);
    if (!panes.has(ch)) panes.set(ch, []); panes.get(ch).push([x, y]); }));
  const numbers = new Map((L.numbers || []).map(([x, y, n]) => [key(x, y), n]));
  const dots = new Set((L.dots || []).map(([x, y]) => key(x, y)));
  const cellSet = new Set(cells.map((c) => key(...c)));
  return { level: number, name: L.name || "", cells, rules: L.rules, givens: L.givens || [], solution: [...panes.values()],
    numbersList: L.numbers || [], dotsList: L.dots || [], ctx: { cellSet, numbers, dots } };
}
function encodeMap(cells, panes) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const W = Math.max(...cells.map((c) => c[0])) + 1, H = Math.max(...cells.map((c) => c[1])) + 1;
  const grid = Array.from({ length: H }, () => Array(W).fill("."));
  panes.forEach((p, i) => p.forEach(([x, y]) => { grid[y][x] = chars[i % chars.length]; }));
  return grid.map((r) => r.join(""));
}

const GK = { DIRS, key, unkey, normalize, rotate, flip, sig, orientations, canon, isRect, isSym, has2x2, POLY, SHAPES,
  SHAPE_ONLY, PER_PANE, ruleText, shapeOk, paneOk, maxSize, allowedPolys, edgeR, edgeD, edgeBetween, wallsOf,
  evaluate, strayWalls, solve, decodeLevel, encodeMap };
root.GK = GK;
if (typeof module !== "undefined" && module.exports) module.exports = GK;
})(typeof window !== "undefined" ? window : globalThis);
