"use strict";
// Data for the country rounds (flags, maps, capitals, which is bigger) and trivia.
// The country data ships in node_modules, so those rounds work on a Wi-Fi with no internet; trivia needs internet
// for fresh questions and falls back to a built-in set.
const path = require("path");
const express = require("express");
const FALLBACK = require("./data/trivia-fallback.json");
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Open Trivia DB categories that are too niche for a mixed party crowd.
const SKIP = /Anime|Cartoon|Comics|Board Games|Gadgets|Video Games/i;
// Theme -> Open Trivia DB category, and the matching built-in questions.
const TRIVIA_CATS = { music: [12, /Music/], screen: [11, /Film|Television|Art|Books/], sport: [21, /Sports/], world: [23, /History|Geography/], africa: [22, /Geography/] };

module.exports = function quiz(app, MODULES) {
  const atlasFile = path.join(MODULES, "world-atlas/countries-50m.json");
  const atlas = require(atlasFile);
  const inAtlas = new Set(atlas.objects.countries.geometries.map(g => g.id));
  // UN members only. `m` marks countries big enough to recognise from their outline.
  const countries = require("world-countries")
    .filter(c => c.unMember && c.cca2)
    .map(c => ({ c: c.cca2.toLowerCase(), n: c.name.common, r: c.region, s: c.subregion || c.region, id: c.ccn3, m: inAtlas.has(c.ccn3) && c.area >= 25000 ? 1 : 0, k: (c.capital || [])[0] || "", ar: Math.round(c.area || 0) }))
    .sort((a, b) => a.n.localeCompare(b.n));
  const countriesJson = JSON.stringify(countries);

  app.get("/api/countries", (req, res) => res.type("json").set("Cache-Control", "public, max-age=86400").send(countriesJson));
  app.get("/data/world.json", (req, res) => res.sendFile(atlasFile, { maxAge: "7d" }));
  app.use("/flags", express.static(path.join(MODULES, "flag-icons/flags/4x3"), { maxAge: "7d" }));
  const vendor = { "d3-array": "d3-array/dist/d3-array.min.js", "d3-geo": "d3-geo/dist/d3-geo.min.js", "topojson": "topojson-client/dist/topojson-client.min.js" };
  for (const [name, file] of Object.entries(vendor)) app.get(`/vendor/${name}.js`, (req, res) => res.sendFile(path.join(MODULES, file), { maxAge: "7d" }));

  // Open Trivia DB allows one request per 5 seconds per address, so requests queue behind each other.
  let nextSlot = 0;
  async function openTrivia(cat) {
    const wait = nextSlot - Date.now();
    nextSlot = Math.max(Date.now(), nextSlot) + 5200;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const r = await fetch(`https://opentdb.com/api.php?amount=50&type=multiple&encode=base64${cat ? "&category=" + cat : ""}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    if (j.response_code !== 0) throw new Error("Open Trivia DB answered " + j.response_code);
    const d = s => Buffer.from(String(s), "base64").toString("utf8").trim();
    return j.results
      .map(x => ({ q: d(x.question), a: d(x.correct_answer), w: x.incorrect_answers.map(d), cat: d(x.category).replace(/^(Entertainment|Science): /, ""), lv: d(x.difficulty) }))
      .filter(x => !SKIP.test(x.cat) && x.q.length <= 200 && x.w.length === 3 && [x.a, ...x.w].every(s => s && s.length <= 48));
  }
  app.get("/api/trivia", async (req, res) => {
    const n = Math.max(1, Math.min(30, Number(req.query.n) || 10));
    const [cat, match] = TRIVIA_CATS[req.query.theme] || [0, null];
    // Easy: only easy questions. Normal: easy and medium. Hard: medium and hard.
    const ok = { easy: ["easy"], hard: ["medium", "hard"] }[req.query.diff] || ["easy", "medium"];
    let pick = [];
    try { pick = shuffle((await openTrivia(cat)).filter(x => ok.includes(x.lv))).slice(0, n); } catch (e) { console.warn("  Trivia: using the built-in questions (" + e.message + ")"); }
    if (pick.length < n) {
      const spare = FALLBACK.filter(x => !match || match.test(x.cat));
      pick = pick.concat(shuffle(spare.length >= n - pick.length ? spare : FALLBACK.slice()).slice(0, n - pick.length));
    }
    res.set("Cache-Control", "no-store").json(shuffle(pick).map(x => ({ q: x.q, a: x.a, w: x.w.slice(0, 3), cat: x.cat })));
  });
};
