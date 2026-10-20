"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
function fixture() {
  let now = 10000;
  const timers = [], sounds = [], box = {
    children: [],
    get firstElementChild() { return this.children[0]; },
    appendChild(el) { this.children.push(el); },
  };
  const context = vm.createContext({
    Date: { now: () => now }, APP: "wiw", PER_PLAYER: 5, EMOJI_OK: true,
    isPid: value => /^p[a-z0-9]{6,15}$/.test(value), cleanName: String,
    face: p => `<span class="avatar" data-player="${p.pid}">existing avatar</span>`,
    $: selector => selector === "#reacts" ? box : null,
    SFX: { play: sound => sounds.push(sound) },
    setTimeout: fn => { timers.push(fn); },
    document: { createElement: () => ({
      style: { setProperty(key, value) { this[key] = value; } },
      remove() { const i = box.children.indexOf(this); if (i >= 0) box.children.splice(i, 1); },
    }) },
  });
  const definitions = [
    html.match(/^const REACTS = .+$/m)[0],
    html.match(/^const REACTION_MAX_CHARS = .+$/m)[0],
    html.match(/function normalizeReactionText\(value\) \{[\s\S]*?\n\}/)[0],
    html.match(/^const esc = .+$/m)[0],
    html.match(/const TV = \{[\s\S]*?\n\};/)[0],
  ].join("\n");
  vm.runInContext(definitions + "\nthis.TV = TV; this.normalize = normalizeReactionText;", context);
  const tv = Object.assign(Object.create(context.TV), {
    H: { code: "TEST", ph: "rev", cur: { t: "draw" }, vip: "pother12", players: {
      pfox123: { pid: "pfox123", name: "Fox", online: true, photos: [], cmdSeen: [] },
      powl123: { pid: "powl123", name: "Owl", online: false, photos: [], cmdSeen: [] },
    } },
    players() { return Object.values(this.H.players); },
    save() {}, render() {}, push() {}, waitFor: () => false,
  });
  return { tv, box, context, timers, sounds, after: (ms = 400) => { now += ms; } };
}

test("custom text collapses whitespace, removes unsafe invisible controls, and stays plain text", () => {
  const { context: { normalize } } = fixture();
  assert.equal(normalize("  nice\n\t one \u0001 team\u202e  "), "nice one team");
  assert.equal(normalize('<img src=x onerror="alert(1)">'), '<img src=x onerror="alert(1)">');
  assert.equal(normalize("cafe\u0301 👩‍🎨"), "café 👩‍🎨");
  for (const value of [null, undefined, 2, {}, [], "", " \n\t ", "\u0000\u202e", "\u200b\u200d\ufe0f", "\ud800"])
    assert.equal(normalize(value), "");
});

test("the 40-character limit counts Unicode code points without cutting surrogate pairs", () => {
  const { context: { normalize } } = fixture();
  assert.equal(normalize("🔥".repeat(45)), "🔥".repeat(40));
  assert.equal(normalize("a".repeat(39) + "🔥end"), "a".repeat(39) + "🔥");
  assert.equal(Array.from(normalize("🔥".repeat(45))).length, 40);
  assert.ok(("react-text:" + normalize("🔥".repeat(45))).length <= 400);
});

test("a non-host player's custom command renders escaped text with the existing avatar, once", () => {
  const { tv, box, after } = fixture();
  const peers = [{ presence: { app: "wiw", role: "p", code: "TEST", pid: "pfox123", nm: "Fox",
    cq: [{ k: "message1", a: "react-text:<img src=x onerror=alert(1)> & wow" }] } }];
  tv.sync(peers);
  assert.equal(box.children.length, 1);
  const el = box.children[0];
  assert.equal(el.className, "rx word custom");
  assert.match(el.innerHTML, /class="avatar" data-player="pfox123"/);
  assert.match(el.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt; &amp; wow/);
  assert.doesNotMatch(el.innerHTML, /<img/);
  assert.ok(parseFloat(el.style["--x"]) >= 35 && parseFloat(el.style["--x"]) <= 65);
  after(); tv.sync(peers);
  assert.equal(box.children.length, 1, "repeated presence must not replay an old command");
});

test("presets remain compatible and share the per-player throttle with typed reactions", () => {
  const { tv, box, context, after } = fixture();
  tv.react("pfox123", 0);
  assert.equal(box.children[0].className, "rx");
  assert.match(box.children[0].innerHTML, /😂/);
  tv.react("pfox123", "too quick");
  assert.equal(box.children.length, 1);
  tv.react("powl123", "another player");
  assert.equal(box.children.length, 2);
  after(350); tv.react("pfox123", "now allowed");
  assert.equal(box.children.length, 3);
  context.EMOJI_OK = false;
  after(); tv.react("pfox123", 0);
  assert.equal(box.children[3].className, "rx word");
  assert.match(box.children[3].innerHTML, /<b>LOL<\/b>/);
});

test("invalid reactions, unknown senders, lobby and pause do not render or consume the throttle", () => {
  const { tv, box } = fixture();
  for (const value of [-1, 999, 0.5, NaN, {}, null, undefined, "  \n "])
    tv.react("pfox123", value);
  tv.react("punknown", "hello");
  tv.H.ph = "lobby"; tv.react("pfox123", "hello");
  tv.H.ph = "rev"; tv.H.pause = { at: 10 }; tv.react("pfox123", "hello");
  assert.equal(box.children.length, 0);
  tv.H.pause = null; tv.react("pfox123", "hello");
  assert.equal(box.children.length, 1);
});

test("host bounds the active reaction count and removes reactions when their animation expires", () => {
  const { tv, box, timers, after } = fixture();
  for (let i = 0; i < 30; i++) { tv.react("pfox123", "message " + i); after(); }
  assert.equal(box.children.length, 24);
  assert.match(box.children[0].innerHTML, /message 6<\/b>/);
  timers.forEach(fn => fn());
  assert.equal(box.children.length, 0);
});

test("malformed preset commands cannot become preset zero", () => {
  const { tv, box } = fixture();
  tv.sync([{ presence: { app: "wiw", role: "p", code: "TEST", pid: "pfox123", nm: "Fox",
    cq: [{ k: "empty", a: "react:" }, { k: "nan", a: "react:lol" }, { k: "long", a: "react-text:" + "x".repeat(401) }] } }]);
  assert.equal(box.children.length, 0);
});
