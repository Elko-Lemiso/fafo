"use strict";
// The watcher: what's going on in the games right now, for whoever runs the server. A short log of rooms, phases,
// joins and leaves, screens that clash over a room, TVs that reload mid-game, and errors from the pages, kept in
// memory (the last few thousand events) and printed to the server's output. It never records names, answers, photos
// or anything anyone typed: players show as a short tag made from their id.
//
// /watch shows it live. On a laptop it's open; on a public server it needs WATCH_KEY: /watch?key=<WATCH_KEY>.
// /api/watch?key=…&code=ABCD gives the same as JSON, for one room or all of them.
const crypto = require("crypto");
const MAX_EVENTS = 4000, MAX_CLIENT_LOGS_PER_MIN = 30;

module.exports = function watch(app, express, { hosted }) {
  const KEY = process.env.WATCH_KEY || "";
  const events = [], rooms = new Map(); // code -> summary
  const started = Date.now();
  const tag = pid => (typeof pid === "string" ? crypto.createHash("sha1").update(pid).digest("hex").slice(0, 6) : "");
  function note(ev, data = {}) {
    const e = { at: Date.now(), ev, ...data };
    events.push(e);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    console.log(`[watch] ${new Date(e.at).toISOString()} ${ev} ${JSON.stringify(data)}`);
    if (data.code && rooms.has(data.code)) rooms.get(data.code).last = e.at;
  }
  function room(code) {
    if (!rooms.has(code)) rooms.set(code, { code, since: Date.now(), last: Date.now(), tv: false, ph: null, r: 0, R: 0, kind: null, gid: null, players: 0, online: 0, games: 0, reloads: 0, clashes: 0, errors: 0 });
    return rooms.get(code);
  }
  // Rooms nobody has touched for a few hours go.
  setInterval(() => { for (const [code, r] of rooms) if (!r.tv && Date.now() - r.last > 6 * 3600e3) rooms.delete(code); }, 600e3).unref();

  // A TV's presence changed: a new game, a new phase, players coming and going.
  function tv(p, prev) {
    const r = room(p.code), pl = Array.isArray(p.pl) ? p.pl : [];
    r.tv = true;
    if (!prev || prev.code !== p.code) note("tv-on", { code: p.code, ph: p.ph, r: p.r });
    if (prev && prev.code === p.code && prev.gid !== p.gid) { r.games++; note("new-game", { code: p.code, gid: p.gid }); }
    if (!prev || prev.ph !== p.ph || prev.r !== p.r || prev.rk !== p.rk) {
      if (p.ph !== "lobby" || prev?.ph !== "lobby") note("phase", { code: p.code, ph: p.ph, r: p.r, R: p.R, kind: p.kind || null, rk: p.rk || null });
    }
    const online = pl.filter(x => x?.[4]).length;
    if (r.players !== pl.length || r.online !== online) note("players", { code: p.code, players: pl.length, online });
    Object.assign(r, { ph: p.ph, r: p.r, R: p.R, kind: p.kind || null, gid: p.gid, players: pl.length, online });
  }
  // A phone's presence: joining a room, and any commands it sends (start, play again, pause…).
  function phone(c, p, prev) {
    if (!p.code || !p.pid) return;
    if (!prev || prev.code !== p.code || prev.pid !== p.pid) note("phone-on", { code: p.code, who: tag(p.pid) });
    const seen = (c.cmdSeen ||= new Set()), first = !prev;
    for (const k of Array.isArray(p.cq) ? p.cq : []) {
      if (!k || typeof k.k !== "string" || seen.has(k.k)) continue;
      seen.add(k.k);
      const a = String(k.a || "").split(":")[0];
      if (!first && a !== "react") note("command", { code: p.code, who: tag(p.pid), a: String(k.a || "").slice(0, 40) });
    }
  }
  function gone(p) {
    if (!p?.code) return;
    if (p.role === "h") { const r = rooms.get(p.code); if (r) r.tv = false; note("tv-off", { code: p.code, ph: p.ph, r: p.r }); }
    else if (p.role === "p" && p.pid) note("phone-off", { code: p.code, who: tag(p.pid) });
  }
  function clash(code, what) { room(code).clashes++; note(what, { code }); }

  // Pages report errors and TV reloads here. Each address gets a few a minute.
  const perIp = new Map();
  setInterval(() => perIp.clear(), 60e3).unref();
  const ua = s => {
    s = String(s || "");
    const dev = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? (/Mobile/.test(s) ? "Android phone" : "Android") : /Tizen|SmartTV|Web0S|webOS|BRAVIA|AFT|CrKey|Android TV/i.test(s) ? "TV" : /Mac OS X/.test(s) ? "Mac" : /Windows/.test(s) ? "Windows" : "other";
    const br = /CriOS|Chrome\//.test(s) && !/Edg/.test(s) ? "Chrome" : /Edg/.test(s) ? "Edge" : /Firefox|FxiOS/.test(s) ? "Firefox" : /Safari/.test(s) ? "Safari" : "browser";
    return dev + " " + br;
  };
  app.post("/api/log", express.json({ limit: "4kb" }), (req, res) => {
    const ip = req.ip || "", n = (perIp.get(ip) || 0) + 1;
    perIp.set(ip, n);
    if (n > MAX_CLIENT_LOGS_PER_MIN) return res.status(429).end();
    const b = req.body || {}, s = (v, len = 200) => (typeof v === "string" ? v.slice(0, len) : typeof v === "number" ? v : undefined);
    const ev = ["error", "tv-reload", "tv-fresh"].includes(b.ev) ? b.ev : "client";
    const code = typeof b.code === "string" && /^[A-Z]{4}$/.test(b.code) ? b.code : undefined;
    if (code && ev === "error") room(code).errors++;
    if (code && ev === "tv-reload") room(code).reloads++;
    note(ev, { code, mode: s(b.mode, 10), ph: s(b.ph, 12), r: s(b.r), msg: s(b.msg), src: s(b.src, 80), line: s(b.line), dev: ua(req.get("user-agent")) });
    res.status(204).end();
  });

  // ---------- the watcher ----------
  const allowed = req => (KEY ? req.query.key === KEY : !hosted);
  app.get("/api/watch", (req, res) => {
    if (!allowed(req)) return res.status(404).type("text").send("Not found");
    const code = typeof req.query.code === "string" ? req.query.code.toUpperCase() : null;
    res.set("Cache-Control", "no-store").json({
      now: Date.now(), up: Date.now() - started,
      rooms: [...rooms.values()].filter(r => !code || r.code === code).sort((a, b) => b.last - a.last),
      events: events.filter(e => !code || e.code === code).slice(-400).reverse(),
    });
  });
  app.get("/watch", (req, res) => {
    if (!allowed(req)) return res.status(404).type("text").send("Not found");
    res.set("Cache-Control", "no-store").type("html").send(PAGE);
  });
  return { note, tv, phone, gone, clash };
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>fafo watcher</title><style>
:root{--sun:#FFC53D;--ink:#1D140F;--soft:#5A4630;--paper:#FFFBF0;--tomato:#D93A26;--mint:#11704F;--cobalt:#2342C6}
*{box-sizing:border-box}body{margin:0;background:var(--sun);color:var(--ink);font:500 15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;padding:18px max(16px,env(safe-area-inset-left))}
h1{font:900 26px system-ui;margin:0 0 4px}.sub{color:var(--soft);margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-bottom:18px}
.room{background:var(--paper);border:3px solid var(--ink);border-radius:14px;padding:10px 12px;cursor:pointer}
.room.on{background:var(--ink);color:var(--paper)}.room b{font:900 22px system-ui;letter-spacing:.06em}
.room .st{font-size:13px;margin-top:4px}.flag{display:inline-block;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:800;margin:4px 4px 0 0;background:var(--tomato);color:var(--paper)}
.flag.ok{background:var(--mint)}.off{opacity:.55}
table{width:100%;border-collapse:collapse;background:var(--paper);border:3px solid var(--ink);border-radius:14px;overflow:hidden;font-size:13px}
td,th{text-align:left;padding:6px 10px;border-bottom:1px solid #e8dcc0;vertical-align:top}th{background:var(--ink);color:var(--paper)}
tr.bad td{background:#fde2dc}tr.warn td{background:#fff1c9}code{font:12px ui-monospace,Menlo,monospace}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}button{font:800 13px system-ui;border:2px solid var(--ink);border-radius:999px;background:var(--paper);padding:5px 12px;cursor:pointer}
</style></head><body><h1>fafo watcher</h1><p class="sub" id="sub">Loading…</p><div class="grid" id="rooms"></div>
<div class="bar"><b id="which">All rooms</b><button id="all" hidden>Show all rooms</button></div>
<table><thead><tr><th>Time</th><th>Room</th><th>What</th><th>Details</th></tr></thead><tbody id="ev"></tbody></table>
<script>
const key = new URLSearchParams(location.search).get("key") || "", esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let code = null;
const ago = ms => ms < 60e3 ? Math.round(ms / 1e3) + "s ago" : ms < 3600e3 ? Math.round(ms / 60e3) + "m ago" : Math.round(ms / 3600e3) + "h ago";
const WHAT = { "tv-on": "TV connected", "tv-off": "TV disconnected", "new-game": "New game", phase: "Phase", players: "Players", "phone-on": "Phone joined", "phone-off": "Phone left", command: "Command", clash: "Second screen blocked", takeover: "Screen took over", error: "Page error", "tv-reload": "TV reloaded mid-game", "tv-fresh": "TV opened" };
async function tick() {
  try {
    const d = await (await fetch("/api/watch?key=" + encodeURIComponent(key) + (code ? "&code=" + code : ""), { cache: "no-store" })).json();
    document.getElementById("sub").textContent = d.rooms.length + " rooms · server up " + ago(d.up).replace(" ago", "") + " · updates every 3 seconds";
    document.getElementById("rooms").innerHTML = d.rooms.map(r => '<div class="room ' + (r.code === code ? "on " : "") + (r.tv ? "" : "off") + '" data-code="' + r.code + '"><b>' + r.code + '</b> ' + (r.tv ? "" : "(TV gone)")
      + '<div class="st">' + esc(r.ph || "?") + (r.R ? " · round " + r.r + " of " + r.R : "") + (r.kind ? " · " + esc(r.kind) : "") + " · " + r.online + "/" + r.players + " online · " + ago(d.now - r.last) + "</div>"
      + (r.clashes ? '<span class="flag">' + r.clashes + " second screen" + (r.clashes > 1 ? "s" : "") + "</span>" : "") + (r.reloads ? '<span class="flag">' + r.reloads + " TV reload" + (r.reloads > 1 ? "s" : "") + "</span>" : "")
      + (r.errors ? '<span class="flag">' + r.errors + " error" + (r.errors > 1 ? "s" : "") + "</span>" : "") + (r.games ? '<span class="flag ok">' + (r.games + 1) + " games</span>" : "") + "</div>").join("");
    document.getElementById("ev").innerHTML = d.events.map(e => { const { at, ev, code: c, ...rest } = e, bad = ["error", "clash", "tv-reload"].includes(ev), warn = ["tv-off", "takeover", "new-game"].includes(ev);
      return '<tr class="' + (bad ? "bad" : warn ? "warn" : "") + '"><td>' + new Date(at).toLocaleTimeString() + "</td><td>" + esc(c || "") + "</td><td>" + esc(WHAT[ev] || ev) + "</td><td><code>" + esc(Object.entries(rest).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => k + "=" + v).join("  ")) + "</code></td></tr>"; }).join("");
  } catch (e) { document.getElementById("sub").textContent = "Can't reach the server: " + e.message; }
}
document.getElementById("rooms").addEventListener("click", e => { const r = e.target.closest("[data-code]"); if (!r) return; code = code === r.dataset.code ? null : r.dataset.code; document.getElementById("which").textContent = code ? "Room " + code : "All rooms"; document.getElementById("all").hidden = !code; tick(); });
document.getElementById("all").onclick = () => { code = null; document.getElementById("which").textContent = "All rooms"; document.getElementById("all").hidden = true; tick(); };
tick(); setInterval(tick, 3000);
</script></body></html>`;
