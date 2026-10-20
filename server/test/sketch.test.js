const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(width = 320, height = 400, options = {}) {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const source = html.slice(html.indexOf('const SKETCH = {'), html.indexOf('// Downscale a picked photo'));
  const calls = [], context = {};
  for (const name of ['beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'rect', 'ellipse', 'fillRect']) {
    context[name] = (...args) => calls.push({ name, args, colour: context.strokeStyle || context.fillStyle });
  }
  const makeCanvas = (w, h) => ({
    getContext: () => context, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    getAttribute: () => 'false', setPointerCapture() {}, releasePointerCapture() {},
    toDataURL: () => 'data:image/jpeg;base64,picture',
  });
  const saved = options.saved || new Map(), listeners = {}, controls = options.controls || [];
  const localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const document = { querySelector: () => null, querySelectorAll: selector => selector === '.draw-tools button' ? controls : [], addEventListener: (name, fn) => { listeners[name] = fn; } };
  const scope = vm.createContext({ DRAW_W: 640, DRAW_H: 480, PH: options.identity || { code: 'ABCD', pid: 'fox' }, document, localStorage, addEventListener: (name, fn) => { listeners[name] = fn; } });
  vm.runInContext(source + '\nthis.sketch = SKETCH;', scope);
  const s = scope.sketch, cv = makeCanvas(width, height);
  s.mount(cv, options.step || 'step1');
  const event = (x, y, id = 1, extras = {}) => ({ clientX: x, clientY: y, pointerId: id, isPrimary: true, button: 0, preventDefault() {}, ...extras });
  const stroke = (tool, from = [20, 30], to = [100, 120]) => {
    s.tool = tool; cv.onpointerdown(event(...from)); cv.onpointermove(event(...to)); cv.onpointerup(event(...to));
  };
  return { s, cv, calls, event, stroke, makeCanvas, saved, listeners, document, scope };
}

test('portrait drawing uses the space and retains its geometry after remount or rotation', () => {
  const { s, stroke, makeCanvas } = setup();
  assert.equal(s.height, 800);
  stroke('rect');
  const history = JSON.stringify(s.strokes);
  const rotated = makeCanvas(640, 320);
  s.mount(rotated, 'step1');
  assert.equal(rotated.height, 800);
  assert.equal(JSON.stringify(s.strokes), history);
  s.mount(rotated, 'step2');
  assert.equal(s.strokes.length, 0);
  assert.equal(s.height, 320);
});

test('shape preview only commits one command and all shapes work in reverse drag direction', () => {
  for (const [tool, operation] of [['line', 'lineTo'], ['rect', 'rect'], ['ellipse', 'ellipse']]) {
    const { s, cv, event, calls } = setup();
    s.tool = tool;
    cv.onpointerdown(event(120, 150));
    cv.onpointermove(event(20, 30));
    assert.equal(s.strokes.length, 0);
    assert.ok(calls.some(c => c.name === operation));
    cv.onpointerup(event(20, 30));
    assert.equal(s.strokes.length, 1);
    assert.equal(s.strokes[0].p.length, 2);
    if (tool === 'ellipse') assert.ok(calls.filter(c => c.name === 'ellipse').every(c => c.args[2] >= 0 && c.args[3] >= 0));
  }
});

test('eraser can be undone, redone and replaced by a new stroke', () => {
  const { s, stroke } = setup();
  stroke('pen'); stroke('eraser');
  assert.equal(s.strokes[1].c, '#FFFFFF');
  s.undo(); assert.equal(s.strokes.length, 1);
  s.redo(); assert.equal(s.strokes[1].t, 'eraser');
  s.undo(); stroke('line');
  assert.equal(s.future.length, 0);
  assert.equal(s.strokes[1].t, 'line');
});

test('clear is reversible and a blank or eraser-only drawing cannot be sent', () => {
  const { s, stroke } = setup();
  assert.equal(s.hasInk(), false);
  stroke('eraser'); assert.equal(s.hasInk(), false);
  stroke('pen'); assert.equal(s.hasInk(), true);
  s.clear(); assert.equal(s.hasInk(), false);
  s.undo(); assert.equal(s.hasInk(), true);
  s.redo(); assert.equal(s.hasInk(), false);
});

test('a second finger cannot hijack or finish the active stroke; cancellation removes the preview', () => {
  const { s, cv, event } = setup();
  cv.onpointerdown(event(20, 30));
  cv.onpointerdown(event(200, 200, 2, { isPrimary: false }));
  cv.onpointermove(event(200, 200, 2));
  cv.onpointerup(event(200, 200, 2));
  assert.equal(s.pointer, 1);
  assert.equal(s.cur.p.length, 1);
  cv.onpointercancel(event(20, 30));
  assert.equal(s.cur, null);
  assert.equal(s.strokes.length, 0);
});

test('rotated letterbox margins do not draw and coordinates map to the visible picture', () => {
  const { s, event, makeCanvas } = setup();
  const cv = makeCanvas(640, 320);
  s.mount(cv, 'step1');
  cv.onpointerdown(event(10, 100)); assert.equal(s.cur, null);
  cv.onpointerdown(event(320, 160));
  assert.equal(s.cur.p[0][0], 320);
  assert.equal(s.cur.p[0][1], 400);
  cv.onpointerup(event(320, 160));
});

test('export finishes the current stroke and empty coalesced events still draw', () => {
  const { s, cv, event } = setup();
  cv.onpointerdown(event(20, 30));
  cv.onpointermove(event(40, 60, 1, { getCoalescedEvents: () => [] }));
  assert.equal(s.cur.p.length, 2);
  assert.equal(s.jpeg(), 'picture');
  assert.equal(s.strokes.length, 1);
  assert.equal(s.cur, null);
});

test('new blank steps return to Pen while the same draft keeps its selected tool and updates toolbar state', () => {
  const pressed = {};
  const controls = ['pen', 'eraser'].map(tool => ({ dataset: { tool }, classList: { toggle() {} }, setAttribute: (name, value) => { pressed[tool] = value; } }));
  const { s, stroke, makeCanvas } = setup(320, 400, { controls });
  stroke('eraser');
  s.mount(makeCanvas(320, 400), 'step1');
  assert.equal(s.tool, 'eraser');
  assert.equal(pressed.eraser, 'true');
  s.mount(makeCanvas(320, 400), 'step2');
  assert.equal(s.tool, 'pen');
  assert.equal(pressed.pen, 'true');
  assert.equal(pressed.eraser, 'false');
});

test('refresh restores matching draft dimensions, strokes, redo history, and selection', () => {
  const first = setup();
  first.stroke('pen'); first.stroke('ellipse'); first.s.undo();
  first.s.color = '#2342C6'; first.s.size = 28; first.s.tool = 'eraser';
  first.listeners.pagehide();
  const refreshed = setup(640, 320, { saved: first.saved });
  assert.equal(refreshed.s.height, 800);
  assert.equal(JSON.stringify(refreshed.s.strokes), JSON.stringify(first.s.strokes));
  assert.equal(refreshed.s.future[0].t, 'ellipse');
  assert.equal(refreshed.s.tool, 'eraser');
  assert.equal(refreshed.s.color, '#2342C6');
  assert.equal(refreshed.s.size, 28);
  refreshed.s.redo();
  assert.equal(refreshed.s.strokes.length, 2);
});

test('drafts never restore into another player, room, or step', () => {
  const first = setup(); first.stroke('rect');
  for (const options of [{ identity: { code: 'WXYZ', pid: 'fox' } }, { identity: { code: 'ABCD', pid: 'owl' } }, { step: 'step2' }]) {
    const next = setup(320, 400, { saved: first.saved, ...options });
    assert.equal(next.s.strokes.length, 0);
    assert.equal(next.s.tool, 'pen');
  }
});

test('corrupt, oversized and invalid drawing commands are ignored safely', () => {
  const first = setup(); first.stroke('pen');
  const valid = JSON.parse(first.saved.get('wiw.draw-draft'));
  const invalid = [
    '{broken', 'x'.repeat(600001), JSON.stringify({ ...valid, height: 0 }),
    JSON.stringify({ ...valid, strokes: [{ t: 'rect', c: '#123456', w: 12, p: [[null, 2]] }] }),
    JSON.stringify({ ...valid, strokes: [{ t: 'ellipse', c: '#123456', w: 12, p: [[1, 2], [3, 4], [5, 6]] }] }),
    JSON.stringify({ ...valid, future: Array(1001).fill({ t: 'clear' }) }),
  ];
  for (const raw of invalid) {
    const restored = setup(320, 400, { saved: new Map([['wiw.draw-draft', raw]]) });
    assert.equal(restored.s.strokes.length, 0);
    assert.equal(restored.s.tool, 'pen');
  }
});

test('hiding the page commits a partial gesture, without saving every pointer movement', () => {
  const { s, cv, event, listeners, saved, document } = setup();
  cv.onpointerdown(event(20, 30)); cv.onpointermove(event(50, 60));
  assert.equal(saved.size, 0);
  document.visibilityState = 'hidden'; listeners.visibilitychange();
  assert.equal(s.cur, null);
  assert.equal(s.strokes.length, 1);
  assert.equal(JSON.parse(saved.get('wiw.draw-draft')).strokes[0].p.length, 2);
});

test('dense saved paths are bounded while preserving stroke endpoints', () => {
  const { s, saved } = setup();
  s.strokes = [{ t: 'pen', c: '#1D140F', w: 12, p: Array.from({ length: 50000 }, (_, i) => [i / 100, i / 100]) }];
  s.saveDraft();
  const raw = saved.get('wiw.draw-draft'), d = JSON.parse(raw);
  assert.ok(raw.length <= 600000);
  assert.ok(d.strokes[0].p.length <= 12000);
  assert.deepEqual(d.strokes[0].p[0], [0, 0]);
  assert.deepEqual(d.strokes[0].p.at(-1), [500, 500]);
  const restored = setup(320, 400, { saved });
  assert.equal(restored.s.strokes.length, 1);
});
