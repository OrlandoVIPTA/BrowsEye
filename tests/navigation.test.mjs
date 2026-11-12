import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeadzone, gamepadNavigationFrame, movementIntent } from '../src/navigation.js';

test('deadzone removes controller drift and rescales remaining input', () => {
  assert.equal(applyDeadzone(.12, .16), 0);
  assert.ok(applyDeadzone(.58, .16) > .49);
  assert.equal(applyDeadzone(-.12, .16), 0);
});

test('normalises a standard controller into walking, looking and flying intentions', () => {
  const frame = gamepadNavigationFrame({ connected: true, axes: [.5, -.75, .25, -.5], buttons: [{ value: 1 }, {}, {}, {}, {}, { value: .1 }, { value: .2 }, { value: .8 }] });
  assert.equal(frame.connected, true);
  assert.ok(frame.moveX > 0);
  assert.ok(frame.forward > 0);
  assert.ok(frame.lookX > 0);
  assert.ok(frame.lookY < 0);
  assert.ok(frame.rise > 0);
  assert.equal(frame.sprint, true);
});

test('supports D-pad walking and standard left-stick-click sprint', () => {
  const buttons = Array.from({ length: 16 }, () => ({ value: 0 }));
  buttons[12] = { value: 1 }; buttons[15] = { value: 1 }; buttons[10] = { value: 1 };
  const frame = gamepadNavigationFrame({ connected: true, axes: [0, 0, .7, -.3], buttons });
  assert.equal(frame.moveX, 1);
  assert.equal(frame.forward, 1);
  assert.ok(frame.lookX > 0);
  assert.ok(frame.lookY < 0);
  assert.equal(frame.sprint, true);
});

test('diagonal walking is normalised and walk mode remains on the ground', () => {
  const walk = movementIntent({ moveX: 1, forward: 1, rise: 1 }, { speed: 4, deltaSeconds: .5, fly: false });
  assert.ok(Math.abs(Math.hypot(walk.right, walk.forward) - 2) < 1e-9);
  assert.equal(walk.up, 0);
  const fly = movementIntent({ rise: 1 }, { speed: 4, deltaSeconds: .5, fly: true });
  assert.equal(fly.up, 2);
});
