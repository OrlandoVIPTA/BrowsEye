import test from 'node:test';
import assert from 'node:assert/strict';
import { handFrame, MuseumGestureController } from '../src/hand-gestures.js';

const hand = (x, y, handedness = 'Right', pinched = true) => ({ x, y, handedness, pinched, palm: .15 });

test('normalizes MediaPipe landmarks into a distance-independent pinch', () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: .5, y: .5 }));
  landmarks[0] = { x: .5, y: .8 }; landmarks[9] = { x: .5, y: .6 };
  landmarks[4] = { x: .45, y: .5 }; landmarks[8] = { x: .48, y: .5 };
  assert.equal(handFrame(landmarks, 'Right').pinched, true);
  landmarks[8] = { x: .8, y: .5 };
  assert.equal(handFrame(landmarks, 'Right').pinched, false);
});

test('an interrupted activation never inherits its earlier hold time', () => {
  const controller = new MuseumGestureController();
  controller.process([hand(.4, .5)], 0);
  controller.process([], 100);
  controller.process([hand(.4, .5)], 250);
  controller.process([hand(.4, .5)], 470);
  assert.equal(controller.mode, 'idle');
  controller.process([hand(.4, .5)], 510);
  assert.equal(controller.mode, 'orbit');
});

test('short tracking loss reanchors instead of applying a stale movement', () => {
  const movements = [];
  const controller = new MuseumGestureController({ onOrbit: move => movements.push(move) });
  controller.process([hand(.4, .5)], 0);
  controller.process([hand(.4, .5)], 300);
  controller.process([hand(.45, .5)], 340);
  assert.equal(movements.length, 1);
  controller.process([], 370);
  controller.process([hand(.53, .5)], 500);
  assert.equal(movements.length, 1);
  controller.process([hand(.56, .5)], 540);
  assert.equal(movements.length, 2);
  assert.ok(Math.abs(movements[1].dx) < .05);
});

test('ambiguous same-handedness candidates release an active visitor session', () => {
  const controller = new MuseumGestureController();
  controller.process([hand(.4, .5, 'Right')], 0);
  controller.process([hand(.4, .5, 'Right')], 300);
  controller.process([hand(.5, .5, 'Right'), hand(.51, .5, 'Right')], 340);
  assert.equal(controller.mode, 'idle');
});
