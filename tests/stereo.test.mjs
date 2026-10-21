import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeAspect, updateRig } from '../src/stereo.js';
import { PerspectiveCamera, StereoCamera } from 'three';

test('Half Side-by-Side retains the full display aspect for each eye', () => {
  // The final compositor halves the output width. Rendering each eye at a
  // half-width aspect would squash it a second time on a Side-by-Side display.
  assert.equal(eyeAspect(2560, 1440), 16 / 9);
  const camera = new PerspectiveCamera(42, 1, 0.01, 1000);
  const rig = new StereoCamera();
  updateRig(rig, camera, 2560, 1440, 0.06, 10);
  assert.equal(camera.aspect, 16 / 9);
});
