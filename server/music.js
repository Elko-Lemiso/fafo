"use strict";
// Songs for the music rounds, from Deezer's free API: 30-second clips, cover art and its editors' playlists.
// Clip links expire after about half an hour, so the TV asks /api/music/play/:id for a fresh one each time.
const DEEZER = "https://api.deezer.com";
const cache = new Map(); // path -> { at, data }

async function dz(path, ttl = 10 * 60e3) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const r = await fetch(DEEZER + path, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  if (j.error) throw new Error("Deezer: " + (j.error.message || j.error.type || "error"));
  cache.set(path, { at: Date.now(), data: j });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return j;
}

// "Song (feat. X) [Radio Edit]" -> "Song", so the answer options read cleanly.
const tidy = s => String(s || "").replace(/\p{C}/gu, "")
  .replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster|remastered|edit|version|mix|live|mono|stereo|from|radio|acoustic|demo)\b[^)\]]*[)\]]/gi, "")
  .replace(/\s+-\s+.*\b(remaster|remastered|edit|version|mix|live|mono|single)\b.*$/i, "")
  .replace(/\s+/g, " ").trim();
// Deezer gives every artist a photo; ones it has no photo for come back with an empty image id.
const artistPic = a => { const u = a?.picture_xl || a?.picture_big || ""; return /\/images\/artist\/[0-9a-f]{32}\//.test(u) ? u : ""; };
const song = t => ({ id: String(t.id), t: tidy(t.title_short || t.title), a: t.artist?.name || "", art: t.album?.cover_medium || "", ap: artistPic(t.artist) });
const playable = t => t && t.readable !== false && t.preview && t.id && (t.title_short || t.title) && t.artist?.name;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Real photos of artists. Deezer's artist pictures are sometimes just album art, so the reveal prefers Wikipedia:
// the hand-picked faces list first, then a lookup by name that only counts pages describing a musician.
const UA = "fafo-party-game/1.0 (https://github.com/Elko-Lemiso/fafo)";
const MUSICAL = /singer|musician|rapper|band|group|duo|trio|saxophonist|trumpeter|pianist|composer|disc jockey|\bdj\b|producer|vocalist|songwriter|guitarist|drummer|bassist|violinist|cellist|jazz|orchestra|bandleader|music|choir|recording artist|entertainer/i;
const faceByName = new Map(require("./data/faces.json").people.map(p => [p.n.toLowerCase(), p.img]));
const photoCache = new Map(); // lowercase name -> photo url, or "" when there's none

async function wikiPhotos(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", redirects: "1", prop: "pageimages|pageprops|description",
      piprop: "thumbnail", pithumbsize: "640", pilicense: "free", ppprop: "disambiguation", titles: batch.join("|") });
    const r = await fetch("https://en.wikipedia.org/w/api.php?" + params, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    const q = (await r.json()).query || {};
    const hop = new Map([...(q.normalized || []), ...(q.redirects || [])].map(x => [x.from, x.to]));
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) {
      let k = t; for (let n = 0; n < 3 && hop.has(k); n++) k = hop.get(k);
      const p = pages.get(k);
      if (p && !p.missing && !p.pageprops?.disambiguation && p.thumbnail?.source && MUSICAL.test(p.description || "")) out[t] = p.thumbnail.source;
    }
  }
  return out;
}

module.exports = function music(app) {
  app.get("/api/music/photos", async (req, res) => {
    const names = [...new Set(String(req.query.names || "").split("|").map(s => s.trim()).filter(s => s && s.length <= 80))].slice(0, 60);
    const out = {};
    let todo = [];
    for (const n of names) {
      const k = n.toLowerCase();
      if (faceByName.has(k)) out[n] = faceByName.get(k);
      else if (photoCache.has(k)) { if (photoCache.get(k)) out[n] = photoCache.get(k); }
      else todo.push(n);
    }
    try {
      // "Drake" is a disambiguation page; "Drake (musician)" is the right one.
      for (const suffix of ["", " (musician)", " (singer)", " (rapper)", " (band)"]) {
        if (!todo.length) break;
        const found = await wikiPhotos(todo.map(n => n + suffix));
        const rest = [];
        for (const n of todo) { const img = found[n + suffix]; if (img) { out[n] = img; photoCache.set(n.toLowerCase(), img); } else rest.push(n); }
        todo = rest;
      }
      for (const n of todo) photoCache.set(n.toLowerCase(), "");
    } catch (e) { console.warn("  Artist photos:", e.message); }
    res.json(out);
  });

  // Phones search for the songs they want in "Whose song?".
  app.get("/api/music/search", async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (!q) return res.json([]);
    try {
      const j = await dz(`/search?q=${encodeURIComponent(q)}&limit=15`);
      res.json((j.data || []).filter(playable).map(song).slice(0, 12));
    } catch (e) { console.warn("  Music search:", e.message); res.status(502).json({ error: "search failed" }); }
  });

  // A set of songs for "Name that tune": today's chart, an editor playlist that matches the words, or a plain search.
  app.get("/api/music/mix", async (req, res) => {
    const q = String(req.query.q || "charts").trim().slice(0, 80) || "charts";
    try {
      let title = "", tracks = [];
      if (q === "charts") {
        title = "Today's top songs";
        tracks = (await dz("/chart/0/tracks?limit=100")).data || [];
      } else {
        const lists = ((await dz(`/search/playlist?q=${encodeURIComponent(q)}&limit=15`)).data || []).filter(p => p.nb_tracks >= 15);
        const pick = lists.find(p => /deezer/i.test(p.user?.name || "")) || lists.sort((a, b) => b.nb_tracks - a.nb_tracks)[0];
        if (pick) { title = pick.title; tracks = (await dz(`/playlist/${pick.id}/tracks?limit=200`)).data || []; }
        if (tracks.filter(playable).length < 8) { title = `Songs matching "${q}"`; tracks = (await dz(`/search?q=${encodeURIComponent(q)}&limit=100`)).data || []; }
      }
      const seen = new Set(), out = [];
      for (const t of tracks.filter(playable).map(song)) {
        const k = (t.t + "|" + t.a).toLowerCase();
        if (!t.t || seen.has(k)) continue;
        seen.add(k); out.push(t);
      }
      if (out.length < 4) return res.status(404).json({ error: "not enough songs" });
      res.set("Cache-Control", "no-store").json({ title, tracks: shuffle(out).slice(0, 80) });
    } catch (e) { console.warn("  Music mix:", e.message); res.status(502).json({ error: "mix failed" }); }
  });

  // Send the browser to a fresh clip for this song.
  app.get("/api/music/play/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!/^\d{1,15}$/.test(id)) return res.status(400).end();
    try {
      const t = await dz(`/track/${id}`, 10 * 60e3);
      if (!t.preview) return res.status(404).end();
      res.set("Cache-Control", "no-store").redirect(302, t.preview);
    } catch (e) { res.status(502).end(); }
  });
};
