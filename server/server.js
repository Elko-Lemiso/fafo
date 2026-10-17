"use strict";
// Who's Who over local Wi-Fi. Serves the page, relays live state between the TV and the phones,
// and keeps uploaded photos in memory. The TV page still owns the game; this server only passes messages.
const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const START_PORT = Number(process.env.PORT) || 3000;
// Hosted (e.g. Railway): phones join through the public address, and only see the room they asked for.
const PUBLIC_URL = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
const PUBLIC = path.join(__dirname, "public");
const MODULES = path.join(__dirname, "node_modules");
// Phones send photos shrunk to a few hundred KB; the caps keep a public server from filling its memory.
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024, MAX_STORED = 400, MAX_TOTAL_BYTES = 200 * 1024 * 1024, MAX_PRESENCE = 32 * 1024;

const isPid = s => typeof s === "string" && /^p[a-z0-9]{6,15}$/.test(s);
const isFid = s => typeof s === "string" && /^f[a-z0-9]{6,15}$/.test(s);
const isCode = s => typeof s === "string" && /^[A-Z]{4}$/.test(s);

// ---------- LAN address ----------
// Pick the address phones on the same Wi-Fi can reach: a private IPv4 on a real network card,
// not a VPN tunnel, VM bridge or link-local address. HOST_IP overrides the guess.
function lanAddresses() {
  const skip = /^(lo|docker|br-|veth|vbox|vmnet|utun|tun|tap|llw|awdl|anpi|ap\d|gif|stf|zt|tailscale|wg)/i;
  const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== "IPv4" && a.family !== 4) || a.internal || a.address.startsWith("169.254.")) continue;
      const score = (skip.test(name) ? 0 : 4) + (isPrivate(a.address) ? 2 : 0) + (/^(en|eth|wl|wlan)/i.test(name) ? 1 : 0);
      out.push({ name, address: a.address, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------- photos (in memory) ----------
const photos = new Map(); // id -> { buf, pid, code, at }
let photoBytes = 0;
function forget(id) { const p = photos.get(id); if (p) { photoBytes -= p.buf.length; photos.delete(id); } }

// ---------- http ----------
const app = express();
app.disable("x-powered-by");
let joinBase = "", lanOk = false;
const hosted = !!PUBLIC_URL;

app.get("/config.js", (req, res) => {
  res.type("js").set("Cache-Control", "no-store").send(`window.WIW=${JSON.stringify({ joinBase, lan: lanOk, hosted })};`);
});
app.get("/vendor/qrcode.js", (req, res) => res.sendFile(path.join(MODULES, "qrcode-generator/dist/qrcode.js")));
for (const f of ["bungee", "barlow", "barlow-condensed"]) {
  app.use(`/fonts/${f}`, express.static(path.join(MODULES, "@fontsource", f), { maxAge: "7d" }));
}
// Flag, map and famous-face rounds, and music.
require("./quiz")(app, MODULES);
require("./music")(app);
app.get("/data/faces.json", (req, res) => res.sendFile(path.join(__dirname, "data", "faces.json"), { maxAge: "1d" }));
app.get("/data/imposter.json", (req, res) => res.sendFile(path.join(__dirname, "data", "imposter.json"), { maxAge: "1h" }));

app.post("/api/photos/:id", express.raw({ type: () => true, limit: MAX_PHOTO_BYTES }), (req, res) => {
  const id = req.params.id, pid = req.get("x-pid"), code = req.get("x-code"), buf = req.body;
  if (!isFid(id) || !isPid(pid) || !isCode(code)) return res.status(400).json({ error: "bad request" });
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(415).json({ error: "send a JPEG" });
  const have = photos.get(id);
  if (have && have.pid !== pid) return res.status(409).json({ error: "taken" });
  forget(id);
  photos.set(id, { buf, pid, code, at: Date.now() });
  photoBytes += buf.length;
  // Oldest photos go first when the server is full.
  while (photos.size > MAX_STORED || photoBytes > MAX_TOTAL_BYTES) forget(photos.keys().next().value);
  res.status(201).json({ ok: true });
});
app.get("/photos/:id", (req, res) => {
  const p = photos.get(req.params.id);
  if (!p) return res.status(404).end();
  res.type("jpeg").set("Cache-Control", "private, max-age=86400, immutable").send(p.buf);
});

app.get(["/", "/tv"], (req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(PUBLIC, "index.html")));
app.use((req, res) => res.status(404).type("text").send("Not found"));

// ---------- live state relay ----------
// Every page publishes one small JSON "presence" object. The TV sees the phones in its room;
// phones see the TVs. Each client gets the list of peers it may see whenever that list changes.
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 15000, maxHttpBufferSize: 64 * 1024 });
const clients = new Map(); // socket.id -> { sock, presence, at, sent }

function view(c) {
  const me = c.presence, tv = me?.role === "h", peers = [];
  for (const [id, o] of clients) {
    const p = o.presence;
    if (o === c || !p) continue;
    // On a public server a phone only sees the TV whose room code it scanned or typed, so room codes don't leak.
    const visible = tv ? p.role === "p" && p.code === me.code : p.role === "h" && (!hosted || (isCode(me?.code) && p.code === me.code));
    if (visible) peers.push({ id, presence: p, updatedAt: o.at });
  }
  return peers;
}
function send(c) {
  const peers = view(c), body = JSON.stringify(peers);
  if (body === c.sent) return;
  c.sent = body;
  c.sock.emit("peers", peers);
}
function broadcast() { for (const c of clients.values()) send(c); }

io.on("connection", sock => {
  const c = { sock, presence: null, at: 0, sent: "" };
  clients.set(sock.id, c);
  send(c);

  sock.on("presence", p => {
    if (!p || typeof p !== "object" || Array.isArray(p) || JSON.stringify(p).length > MAX_PRESENCE) return;
    c.presence = p; c.at = Date.now();
    broadcast();
  });
  // Which of these photos does the server still hold? Used after a reconnect.
  sock.on("have", (ids, ack) => {
    if (typeof ack !== "function") return;
    ack(Array.isArray(ids) ? ids.filter(id => isFid(id) && photos.has(id)) : []);
  });
  // Forget photos: a phone removing its own, or the TV clearing its room.
  sock.on("drop", ids => {
    if (!Array.isArray(ids)) return;
    const me = c.presence || {};
    for (const id of ids.slice(0, 50)) {
      const p = photos.get(id);
      if (p && (p.pid === me.pid || (me.role === "h" && p.code === me.code))) forget(id);
    }
  });
  // The TV sends one phone in its room something only that phone should see (an Imposter round's secret word).
  sock.on("whisper", msg => {
    const me = c.presence;
    if (me?.role !== "h" || !msg || !isPid(msg.to) || JSON.stringify(msg.data ?? null).length > 2000) return;
    for (const o of clients.values()) if (o.presence?.role === "p" && o.presence.code === me.code && o.presence.pid === msg.to) o.sock.emit("whisper", msg.data);
  });
  sock.on("disconnect", () => { clients.delete(sock.id); broadcast(); });
});

// ---------- start ----------
function listen(port, triesLeft) {
  const onError = err => {
    // Locally, step to the next port if this one is busy. When the host sets PORT, it must be exactly that.
    if (err.code === "EADDRINUSE" && triesLeft > 0 && !process.env.PORT) return listen(port + 1, triesLeft - 1);
    console.error(err.message);
    process.exit(1);
  };
  server.once("error", onError);
  server.listen(port, () => {
    server.off("error", onError);
    const addrs = lanAddresses();
    const ip = process.env.HOST_IP || addrs[0]?.address;
    lanOk = !!ip;
    joinBase = `http://${ip || "localhost"}:${port}/`;
    if (hosted) { joinBase = PUBLIC_URL.replace(/\/?$/, "/"); lanOk = true; }
    const line = (k, v) => console.log(`  ${k.padEnd(20)}${v}`);
    console.log("\n  Who's Who is running.\n");
    line("TV (this laptop):", hosted ? `${joinBase}tv` : `http://localhost:${port}/tv`);
    line("Phones join at:", ip ? `${joinBase}  (or scan the QR code on the TV)` : "no Wi-Fi address found");
    const others = addrs.filter(a => a.address !== ip);
    if (others.length) line("Other addresses:", others.map(a => `${a.address} (${a.name})`).join(", "));
    if (!ip) console.log("\n  Connect this laptop to Wi-Fi, then restart so phones can reach it.");
    console.log("\n  Open the TV link in a browser on the laptop that's plugged into the TV.");
    console.log("  Press Ctrl+C to stop. Photos only live in memory and vanish when you stop.\n");
  });
}
listen(START_PORT, 10);
