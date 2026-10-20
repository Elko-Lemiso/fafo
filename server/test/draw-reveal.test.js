"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the actual browser controllers without starting the game, sockets, or audio.
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
function fixture() {
  let now = 10000;
  const context = vm.createContext({
    Date: { now: () => now }, console,
    SFX: { play() {}, cutRiser() {} },
    EACH_KINDS: [], SECRET_PHASES: ["dw"], MODES: ["draw"], SPICE: [["off"]], DIFFS: [["normal"]], INTRO_SECS: 5,
    drawMatch: (a, b) => a === b ? 2 : 0,
    esc: x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    photoSrc: x => "/photos/" + x, face: p => `<span>${p.name}</span>`, fmt: String,
    cleanName: String, SHARE: { chain: () => Promise.resolve(null) },
    paint: (el, sig, markup) => { el.sig = sig; el.innerHTML = markup; return true; },
  });
  const helper = html.match(/function drawRevealProgress\(rv\) \{[\s\S]*?\n\}/)[0];
  const tvSource = html.match(/const TV = \{[\s\S]*?\n\};/)[0];
  const phoneSource = html.match(/const PH = \{[\s\S]*?\n\};/)[0];
  vm.runInContext(`${helper}\n${tvSource}\n${phoneSource}\nthis.TV = TV; this.PH = PH; this.progress = drawRevealProgress;`, context);
  const players = Object.fromEntries(["a", "b", "c"].map(pid => [pid, { pid, name: pid.toUpperCase(), score: 0, photos: [] }]));
  const chain = { p: "a corn cob harmonica", items: [
    { k: "d", pid: "a", v: "first-drawing" },
    { k: "g", pid: "b", v: "a corn cob harmonica" },
    { k: "d", pid: "c", v: "second-drawing" },
    { k: "g", pid: "a", v: "a koala at the gym" },
  ] };
  const tv = Object.assign(Object.create(context.TV), {
    H: { gid: "game", r: 1, R: 1, ph: "dw", rk: "game-1", players, modes: ["draw"], photos: {}, order: [],
      cur: { t: "draw", ci: 0, S: 4, step: 3, order: ["a", "b", "c"], chains: [chain, { p: "second chain", items: [] }] } },
    save() { this.saved = JSON.parse(JSON.stringify(this.H)); }, render() {}, push() {}, sound() {}, speak() {},
    curOwner: () => null, scorersHtml: () => "POINTS", sipHtml: () => "", endRound() { this.finished = true; },
    fresh: () => ({ modes: ["draw"], players: {}, photos: {} }), unpause() {},
  });
  return { tv, context, step: () => { now += 500; tv.advance(); } };
}

test("a drawing reveal starts at its original prompt and has no automatic deadline", () => {
  const { tv } = fixture();
  tv.reveal();
  assert.equal(tv.H.ph, "rev");
  assert.equal(tv.H.phaseEnds, 0);
  assert.equal(tv.H.phDur, 0);
  assert.equal(tv.H.rv.shown, 0);
  assert.equal(tv.H.rv.p, "a corn cob harmonica");
  assert.equal(tv.revEv, null, "do not announce the verdict early");
});

test("host advances one card at a time, rejects double taps, and scores a chain only once", () => {
  const { tv, step } = fixture();
  tv.reveal();
  const scores = JSON.stringify(tv.H.players);
  step();
  assert.equal(tv.H.rv.shown, 1);
  tv.advance();
  assert.equal(tv.H.rv.shown, 1);
  for (let i = 2; i <= 4; i++) { step(); assert.equal(tv.H.rv.shown, i); }
  assert.equal(JSON.stringify(tv.H.players), scores);
  assert.equal(tv.H.players.a.score, 1000);
  assert.equal(tv.H.players.b.score, 1000);
  step();
  assert.equal(tv.H.rv.ci, 1);
  assert.equal(tv.H.rv.shown, 0);
  assert.equal(tv.H.rv.p, "second chain");
  assert.equal(tv.H.phaseEnds, 0);
  for (let i = 0; i < 5; i++) step();
  assert.equal(tv.finished, true);
});

test("stale or duplicate phone commands cannot skip reveals or advance a new chain", () => {
  const { tv, step } = fixture();
  tv.reveal();
  const first = `draw-next:${tv.H.rk}:0`;
  tv.command(first);
  assert.equal(tv.H.rv.shown, 1);
  step();
  tv.command(first);
  assert.equal(tv.H.rv.shown, 2);
  tv.command(`draw-next:${tv.H.rk}:4`);
  assert.equal(tv.H.rv.shown, 2);
  step(); step(); step();
  tv.command(first);
  assert.equal(tv.H.rv.ci, 1);
  assert.equal(tv.H.rv.shown, 0);
});

test("reloading the TV restores the revealed card without restarting or adding a timer", () => {
  const { tv, step, context } = fixture();
  tv.reveal(); step(); step();
  const restored = tv.revive(JSON.parse(JSON.stringify(tv.saved)));
  assert.equal(restored.ph, "rev");
  assert.equal(restored.rv.shown, 2);
  assert.equal(restored.phaseEnds, 0);
  assert.equal(restored.players.a.score, 1000);
  assert.equal(context.progress(restored.rv).next, "Reveal next drawing");
});

test("TV markup includes only revealed cards and withholds the final verdict and points", () => {
  const { tv, step } = fixture();
  tv.reveal();
  let markup = tv.drawRevealHtml();
  assert.match(markup, /a corn cob harmonica/);
  assert.doesNotMatch(markup, /first-drawing|second-drawing|a koala|POINTS|Lost in translation/);
  step(); markup = tv.drawRevealHtml();
  assert.match(markup, /first-drawing/);
  assert.doesNotMatch(markup, /second-drawing|a koala|POINTS/);
  step(); step(); step(); markup = tv.drawRevealHtml();
  assert.match(markup, /a koala at the gym/);
  assert.match(markup, /Lost in translation/);
  assert.match(markup, /POINTS/);
  assert.equal((markup.match(/class="dcard /g) || []).length, 5);
});

test("phones follow reveal progress; only the VIP advances and sharing waits for the complete chain", () => {
  const { tv, context, step } = fixture();
  tv.reveal();
  const main = {}, phone = Object.assign(Object.create(context.PH), {
    pid: "a", host: { kind: "draw", ph: "rev", rk: tv.H.rk, vip: "a", rv: tv.H.rv },
    shareReady: () => false, prepShare() { this.prepared = true; }, sipNote: () => "",
  });
  phone.rDrawReveal(main);
  assert.match(main.innerHTML, /Reveal next drawing/);
  assert.doesNotMatch(main.innerHTML, /Share this chain|Making the picture|1000 points/);
  assert.equal(phone.prepared, undefined);
  phone.pid = "b"; phone.rDrawReveal(main);
  assert.doesNotMatch(main.innerHTML, /data-act="draw-next"/);
  step(); step(); step(); step();
  phone.rDrawReveal(main);
  assert.equal(phone.prepared, true);
  assert.match(main.innerHTML, /1000 points/);
  assert.match(main.innerHTML, /data-act="share-chain"/);
});

test("shared chains preserve portrait, landscape, and legacy drawing proportions without cropping", async () => {
  const context = vm.createContext({
    photoSrc: x => x,
    document: { createElement: () => ({ getContext: () => ({}) }) },
  });
  vm.runInContext(html.match(/const SHARE = \{[\s\S]*?\n\};/)[0] + "\nthis.exporter = SHARE;", context);
  for (const [naturalWidth, naturalHeight] of [[400, 800], [800, 400], [800, 600]]) {
    const pic = { naturalWidth, naturalHeight }, drawn = [], cards = [];
    const x = { fillText() {}, drawImage: (...args) => drawn.push(args) };
    const exporter = Object.assign(Object.create(context.exporter), {
      fonts: async () => {}, img: async () => pic, base: () => [{}, x],
      wordmark() {}, wrap: (ctx, text) => [text], footer() {}, blob: async () => "exported",
      card: (...args) => cards.push(args),
    });
    await exporter.chain({ p: "a circle", by: "a", items: [{ k: "d", v: "drawing", pid: "a" }] }, { a: "Fox" });
    assert.equal(drawn.length, 1);
    const [image, left, top, width, height] = drawn[0], cardY = cards[1][2];
    assert.equal(image, pic);
    assert.ok(Math.abs(width / height - naturalWidth / naturalHeight) < 1e-9);
    assert.ok(width <= 900 && height <= 675);
    assert.equal(left + width / 2, 540, "center horizontally within drawing card");
    assert.equal(top + height / 2, cardY + 20 + 675 / 2, "center vertically above the artist label");
    assert.ok(width === 900 || height === 675, "fill available width or height without cropping");
  }
});
