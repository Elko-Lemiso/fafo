"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
function fixture() {
  let now = 10000, nextTimer = 0;
  const sent = [], timers = new Map(), nodes = new Map();
  const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, x => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }[x]));
  const document = { activeElement: null };
  const foot = {
    dataset: {}, mounts: 0,
    set innerHTML(markup) {
      this.markup = markup; this.mounts++;
      for (const id of ["rx-input", "rx-count", "rx-send", "rx-feedback"]) nodes.delete(id);
      if (!markup.includes('id="rx-input"')) return;
      let value = "";
      const input = {
        selectionStart: 0, selectionEnd: 0,
        get value() { return value; },
        set value(text) { value = text; this.selectionStart = this.selectionEnd = value.length; },
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
        focus() { document.activeElement = this; },
      };
      input.value = decode(markup.match(/id="rx-input"[^>]*\bvalue="([^"]*)"/)[1]);
      nodes.set("rx-input", input);
      nodes.set("rx-count", { textContent: "0/40" });
      nodes.set("rx-send", { disabled: true });
      nodes.set("rx-feedback", { textContent: "" });
    },
    get innerHTML() { return this.markup; },
  };
  nodes.set("ph-foot", foot);
  const context = vm.createContext({
    Date: { now: () => now }, document, vibrate() {}, fnv: x => "hash:" + x,
    $: selector => nodes.get(selector.slice(1)) || null,
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const definitions = [
    html.match(/^const REACTS = .+$/m)[0],
    html.match(/^const REACTION_MAX_CHARS = .+$/m)[0],
    html.match(/function normalizeReactionText\(value\) \{[\s\S]*?\n\}/)[0],
    html.match(/^const esc = .+$/m)[0],
    html.match(/^function paint\(.+$/m)[0],
    html.match(/const PH = \{[\s\S]*?\n\};/)[0],
  ].join("\n");
  vm.runInContext(definitions + "\nthis.PH = PH;", context);
  const phone = Object.assign(context.PH, {
    pid: "pfox123", joined: true, host: { ph: "rev", rk: "round1", vip: "another-player" },
    me: () => ["pfox123", "Fox"], send: value => sent.push(value),
  });
  phone.renderFoot();
  return {
    phone, sent, foot, nodes, document,
    get input() { return nodes.get("rx-input"); },
    type(value, composing = false) { const input = nodes.get("rx-input"); input.value = value; input.oninput({ isComposing: composing }); },
    after(ms) {
      now += ms;
      for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
    },
  };
}

test("phone keyboard composition is neither truncated nor sent until composition ends", () => {
  const f = fixture(), text = "文".repeat(42);
  f.type(text, true);
  assert.equal(f.input.value, text);
  assert.equal(f.phone.rxDraft, text);
  assert.equal(f.nodes.get("rx-send").disabled, true);
  f.phone.sendReaction();
  assert.deepEqual(f.sent, []);
  f.input.oncompositionend();
  assert.equal(f.input.value, "文".repeat(40));
  assert.equal(f.nodes.get("rx-send").disabled, false);
  f.phone.sendReaction();
  assert.deepEqual(f.sent, ["react-text:" + "文".repeat(40)]);
});

test("Unicode limits preserve complete emoji and an editing selection in the middle of a draft", () => {
  const f = fixture();
  f.input.value = "🔥".repeat(42);
  f.input.setSelectionRange(8, 12);
  f.input.oninput({ isComposing: false });
  assert.equal(f.input.value, "🔥".repeat(40));
  assert.equal(f.input.selectionStart, 8);
  assert.equal(f.input.selectionEnd, 12);
  assert.equal(f.nodes.get("rx-count").textContent, "40/40");
  f.phone.sendReaction();
  assert.equal(f.sent[0], "react-text:" + "🔥".repeat(40));
});

test("blank or invisible drafts disable Send without consuming the rate limit", () => {
  const f = fixture();
  for (const value of ["", " \n\t ", "\u0000\u200b\u202e", "\u200d\ufe0f"]) {
    f.type(value);
    assert.equal(f.nodes.get("rx-send").disabled, true);
    f.phone.sendReaction();
  }
  assert.deepEqual(f.sent, []);
  f.type("hello"); f.phone.sendReaction();
  assert.deepEqual(f.sent, ["react-text:hello"]);
});

test("quick presets preserve a composing custom draft and share the 400ms sending guard", () => {
  const f = fixture();
  f.type("my unfinished reaction", true);
  f.phone.sendReaction(0);
  assert.equal(f.input.value, "my unfinished reaction");
  assert.equal(f.phone.rxDraft, "my unfinished reaction");
  assert.equal(f.phone.rxComposing, true);
  f.phone.sendReaction(1);
  assert.deepEqual(f.sent, ["react:0"]);
  f.input.oncompositionend();
  f.after(399); f.phone.sendReaction();
  assert.equal(f.sent.length, 1);
  f.after(1); f.phone.sendReaction();
  assert.deepEqual(f.sent, ["react:0", "react-text:my unfinished reaction"]);
});

test("custom send clears only the submitted draft and updates status without replacing the input", () => {
  const f = fixture(), input = f.input, mounts = f.foot.mounts;
  input.focus();
  f.type("  clever   drawing!  ");
  f.phone.renderFoot = () => { throw new Error("Sending must not remount the footer"); };
  f.phone.sendReaction();
  assert.deepEqual(f.sent, ["react-text:clever drawing!"]);
  assert.equal(f.input, input);
  assert.equal(f.document.activeElement, input);
  assert.equal(f.foot.mounts, mounts);
  assert.equal(f.input.value, "");
  assert.equal(f.phone.rxDraft, "");
  assert.equal(f.nodes.get("rx-send").disabled, true);
  assert.equal(f.nodes.get("rx-count").textContent, "0/40");
  assert.equal(f.nodes.get("rx-feedback").textContent, "“clever drawing!” sent");
  f.type("a newer draft"); input.setSelectionRange(3, 3);
  f.after(2200);
  assert.equal(f.nodes.get("rx-feedback").textContent, "");
  assert.equal(f.input.value, "a newer draft");
  assert.equal(f.phone.rxDraft, "a newer draft");
  assert.equal(f.input.selectionStart, 3);
  assert.equal(f.input, input);
});

test("unchanged renders preserve focus and caret; active turns hide reactions and retain drafts", () => {
  const f = fixture();
  f.type('the "same" draft & more');
  const input = f.input, mounts = f.foot.mounts;
  input.focus(); input.setSelectionRange(4, 4);
  for (let i = 0; i < 5; i++) f.phone.renderFoot();
  assert.equal(f.input, input);
  assert.equal(f.foot.mounts, mounts);
  assert.equal(f.document.activeElement, input);
  assert.equal(f.input.selectionStart, 4);
  f.phone.host.ph = "q";
  f.phone.renderFoot();
  assert.equal(f.input, undefined);
  assert.equal(f.phone.rxDraft, 'the "same" draft & more');
  f.phone.sendReaction(0);
  assert.deepEqual(f.sent, []);
  f.phone.g = { rk: "round1" };
  f.phone.renderFoot();
  assert.notEqual(f.input, input);
  assert.equal(f.input.value, 'the "same" draft & more');
  assert.equal(f.nodes.get("rx-send").disabled, false);
});

test("a previous feedback timeout cannot clear a newer confirmation or the next draft", () => {
  const f = fixture();
  f.type("first"); f.phone.sendReaction();
  f.after(1000);
  f.type("second"); f.phone.sendReaction();
  f.type("third draft");
  f.after(1200);
  assert.equal(f.nodes.get("rx-feedback").textContent, "“second” sent");
  assert.equal(f.input.value, "third draft");
  f.after(1000);
  assert.equal(f.nodes.get("rx-feedback").textContent, "");
  assert.equal(f.input.value, "third draft");
});

test("only joined players in idle states can send, including after submitting their drawing", () => {
  const f = fixture();
  for (const ph of ["intro", "rev", "lb", "end", "imp-clue"]) {
    f.phone.host.ph = ph; assert.equal(f.phone.canReact(), true);
  }
  for (const ph of ["lobby", "qw", "dw", "qv", "fk-ans", "q"]) {
    f.phone.host.ph = ph; assert.equal(f.phone.canReact(), false);
  }
  f.phone.host.ph = "dw";
  f.phone.dr = { rk: "old-round" }; assert.equal(f.phone.canReact(), false);
  f.phone.dr = { rk: "round1" }; assert.equal(f.phone.canReact(), true);
  f.phone.host.pause = { at: 1 }; assert.equal(f.phone.canReact(), false);
  f.phone.host.pause = null;
  f.phone.joined = false; assert.equal(f.phone.canReact(), false);
  f.phone.joined = true; f.phone.me = () => null; assert.equal(f.phone.canReact(), false);
});
