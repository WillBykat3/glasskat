/**
 * Glasskat — Google Sheet backend.
 *
 * Paste this whole file into Extensions → Apps Script of an empty Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Put the web app URL into API_URL near the top of the <script> in index.html.
 *
 * The sheet gets three tabs, created on first use:
 *   Users     one row per username, with the level they've reached
 *   Results   one row per solved puzzle
 *   Progress  one row per username: the puzzle they're in the middle of
 *
 * There are no passwords: anyone who types a username uses that account.
 */

const TABS = {
  Users: ["Username", "Key", "Created", "Last seen", "Level", "Solved", "Fastest (s)"],
  Results: ["Time", "Username", "Level", "Seconds", "Panes", "Squares", "Rules", "Mode"],
  Progress: ["Key", "Updated", "State"]
};
// Columns kept as plain text, so Sheets never turns "007" into 7
const TEXT_COLS = { Users: "A:B", Results: "B:B", Progress: "A:A" };

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}

function handle_(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    switch (p.action) {
      case "login": return out_(login_(p));
      case "result": return out_(result_(p));
      case "progress": return out_(progress_(p));
      case "history": return out_(history_(p));
      default: return out_({ ok: false, error: "Unknown action" });
    }
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function tab_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(TEXT_COLS[name]).setNumberFormat("@");
    sh.appendRow(TABS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold");
  } else if (sh.getLastColumn() < TABS[name].length) {
    const head = sh.getRange(1, 1, 1, TABS[name].length);
    head.setValues([TABS[name]]);
    head.setFontWeight("bold");
  }
  return sh;
}
function rows_(name) {
  const sh = tab_(name);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, TABS[name].length).getValues() : [];
}

// Usernames: 2–24 characters, starting with a letter or number. This also
// keeps anything a spreadsheet would read as a formula out of the sheet.
function cleanName_(u) {
  u = String(u || "").trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,23}$/.test(u)) {
    throw new Error("Usernames are 2–24 letters or numbers (spaces, dots, dashes and underscores are fine inside).");
  }
  return u;
}
const key_ = (u) => u.toLowerCase();
const num_ = (x, max) => { const n = Number(x); return isFinite(n) ? Math.min(max || 1e7, Math.max(0, Math.round(n))) : 0; };
const text_ = (x, max) => String(x == null ? "" : x).replace(/^[=+\-@]+/, "").slice(0, max || 80);

function findUser_(key) {
  const data = rows_("Users");
  for (let i = 0; i < data.length; i++) if (String(data[i][1]) === key) return { row: i + 2, name: String(data[i][0]), level: Number(data[i][4]) || 1, solved: Number(data[i][5]) || 0, fastest: data[i][6] === "" ? null : Number(data[i][6]) };
  return null;
}
function profile_(u) { return { username: u.name, level: u.level, solved: u.solved, fastest: u.fastest }; }

function progressFor_(key) {
  const data = rows_("Progress");
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== key) continue;
    try { return { updated: data[i][1], state: JSON.parse(data[i][2]) }; } catch (err) { return null; }
  }
  return null;
}

function login_(p) {
  const name = cleanName_(p.username);
  const key = key_(name);
  const now = new Date();
  let user = findUser_(key), created = false;
  if (user) {
    tab_("Users").getRange(user.row, 4).setValue(now);
  } else {
    tab_("Users").appendRow([name, key, now, now, 1, 0, ""]);
    user = findUser_(key);
    created = true;
  }
  return Object.assign({ ok: true, created: created, progress: progressFor_(key) }, profile_(user));
}

function result_(p) {
  const user = findUser_(key_(cleanName_(p.username)));
  if (!user) throw new Error("No account with that username");
  const r = p.result || {};
  const level = Math.max(1, num_(r.level, 100000)), seconds = num_(r.seconds, 86400 * 30);
  tab_("Results").appendRow([new Date(), user.name, level, seconds, num_(r.panes, 1000), num_(r.squares, 10000), text_(r.rules, 120), text_(r.mode, 20)]);
  const sh = tab_("Users");
  const newLevel = Math.max(user.level, level + 1), solved = user.solved + 1;
  const fastest = user.fastest === null || isNaN(user.fastest) ? seconds : Math.min(user.fastest, seconds);
  sh.getRange(user.row, 4, 1, 4).setValues([[new Date(), newLevel, solved, fastest]]);
  return Object.assign({ ok: true, newFastest: user.fastest === null || seconds < user.fastest }, profile_({ name: user.name, level: newLevel, solved: solved, fastest: fastest }));
}

function progress_(p) {
  const user = findUser_(key_(cleanName_(p.username)));
  if (!user) throw new Error("No account with that username");
  const key = key_(user.name), sh = tab_("Progress"), data = rows_("Progress");
  let row = -1;
  for (let i = 0; i < data.length; i++) if (String(data[i][0]) === key) { row = i + 2; break; }
  if (!p.state) { if (row > 0) sh.deleteRow(row); return { ok: true }; }
  const json = JSON.stringify(p.state);
  if (json.length > 45000) throw new Error("Progress is too large to save");
  if (row > 0) sh.getRange(row, 2, 1, 2).setValues([[new Date(), json]]);
  else sh.appendRow([key, new Date(), json]);
  return { ok: true };
}

// Recent solves for one user, plus the top 10 players by level reached.
function history_(p) {
  const key = key_(cleanName_(p.username));
  const recent = rows_("Results")
    .filter((r) => key_(String(r[1])) === key)
    .map((r) => ({ time: r[0], level: r[2], seconds: r[3], panes: r[4], rules: r[6] }));
  const board = rows_("Users")
    .map((r) => ({ username: String(r[0]), level: Number(r[4]) || 1, solved: Number(r[5]) || 0 }))
    .filter((u) => u.solved > 0)
    .sort((a, b) => b.level - a.level || b.solved - a.solved)
    .slice(0, 10);
  return { ok: true, results: recent.slice(-15).reverse(), leaderboard: board };
}
