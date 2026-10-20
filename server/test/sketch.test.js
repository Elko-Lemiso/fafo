const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(width = 320, height = 400) {
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
  const scope = vm.createContext({ DRAW_W: 640, DRAW_H: 480, document: { querySelector: () => null } });
  vm.runInContext(source + '\nthis.sketch = SKETCH;', scope);
  const s = scope.sketch, cv = makeCanvas(width, height);
  s.mount(cv, 'step1');
  const event = (x, y, id = 1, extras = {}) => ({ clientX: x, clientY: y, pointerId: id, isPrimary: true, button: 0, preventDefault() {}, ...extras });
  const stroke = (tool, from = [20, 30], to = [100, 120]) => {
    s.tool = tool; cv.onpointerdown(event(...from)); cv.onpointermove(event(...to)); cv.onpointerup(event(...to));
  };
  return { s, cv, calls, event, stroke, makeCanvas };
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
