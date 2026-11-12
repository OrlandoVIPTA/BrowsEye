import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_XGRIDS_MODULE_URL,
  LccSdkUnavailableError,
  createLccCollisionProvider,
  LccStreamingError,
  LccStreamingSession,
  getXgridsLccAvailability,
  isLccStreamingPath,
  loadXgridsScene,
  loadXgridsLccSdk,
  validateLccStreamingPath,
} from '../src/lcc-streaming.js';

test('recognises LCC and LCC2 streaming paths without accepting neighbouring names', () => {
  assert.equal(isLccStreamingPath('/villa/meta.lcc2?token=abc'), true);
  assert.equal(isLccStreamingPath('scene.LCC'), true);
  assert.equal(isLccStreamingPath('scene.lcc2.zip'), false);
});

test('refuses local blobs because LCC companion chunks need URL addressing', () => {
  assert.throws(() => validateLccStreamingPath('blob:local-scene.lcc2'), LccStreamingError);
  assert.equal(validateLccStreamingPath('/scenes/villa/meta.lcc2'), '/scenes/villa/meta.lcc2');
});

test('uses an injected official SDK module and verifies its renderer API', async () => {
  const sdk = await loadXgridsLccSdk({
    moduleUrl: 'mock-sdk',
    importModule: async url => ({ LCCRender: { load() {}, update() {}, url } }),
  });
  assert.equal(typeof sdk.load, 'function');
  await assert.rejects(
    loadXgridsLccSdk({ importModule: async () => ({}) }),
    LccSdkUnavailableError,
  );
  assert.ok(DEFAULT_XGRIDS_MODULE_URL.endsWith('lcc-sdk-three.js'));
  const availability = await getXgridsLccAvailability({ importModule: async () => ({}) });
  assert.equal(availability.available, false);
});

test('passes cache controls to the SDK and releases its scene cleanly', async () => {
  const calls = [];
  const object = {
    setMaxSplats: value => calls.push(['splats', value]),
    setMaxDistance: value => calls.push(['distance', value]),
    hasCollision: () => true,
  };
  const sdk = {
    load(params, success, progress) {
      calls.push(['load', params]);
      progress(.25);
      queueMicrotask(() => success(object));
      return object;
    },
    update: () => calls.push(['update']),
    dispose: target => calls.push(['dispose', target]),
    setCamera: camera => calls.push(['camera', camera]),
  };
  const progress = [];
  const session = new LccStreamingSession({
    sdk, THREE: {}, scene: {}, camera: { name: 'camera-a' }, renderer: { domElement: {} },
    maxHostCacheSize: 256, maxGpuCacheSize: 128, onProgress: value => progress.push(value),
  });
  await session.load('/scenes/villa.lcc2');
  assert.equal(calls[0][1].dataPath, '/scenes/villa.lcc2');
  assert.equal(calls[0][1].maxHostCacheSize, 256);
  assert.equal(calls[0][1].maxGpuCacheSize, 128);
  assert.deepEqual(progress, [.25]);
  session.setQuality({ maxSplats: 2_000_000, maxDistance: 80 });
  assert.equal(session.hasCollision(), true);
  session.update();
  session.unload();
  assert.ok(calls.some(([kind]) => kind === 'update'));
  assert.ok(calls.some(([kind]) => kind === 'dispose'));
});

test('convenience loader constructs and starts a streamed scene', async () => {
  const object = {};
  const session = await loadXgridsScene({
    dataPath: '/scenes/villa.lcc', THREE: {}, scene: {}, camera: {}, renderer: { domElement: {} },
    importModule: async () => ({ LCCRender: {
      load(_params, success) { queueMicrotask(() => success(object)); return object; },
      update() {},
    }}),
  });
  assert.equal(session.object, object);
  session.dispose();
});

test('keeps a scene object supplied only through the SDK completion callback', async () => {
  const object = { dispose() {} };
  const session = new LccStreamingSession({
    sdk: { load(_params, success) { queueMicrotask(() => success(object)); }, update() {} },
    THREE: {}, scene: {}, camera: {}, renderer: { domElement: {} },
  });
  await session.load('/scenes/callback-only.lcc2');
  assert.equal(session.object, object);
});

test('uses the XGRIDS capsule correction for walk-through collisions', () => {
  const provider = createLccCollisionProvider({
    hasCollision: () => true,
    intersectsCapsule: query => {
      assert.deepEqual(query.start, { x: 1, y: 0, z: 0 });
      assert.deepEqual(query.end, { x: 1, y: 1.65, z: 0 });
      assert.equal(query.noDelta, false);
      return { hit: true, delta: { x: -.25, y: 0, z: 0 } };
    },
  });
  const vector = (x, y, z) => ({ x, y, z, clone() { return vector(this.x, this.y, this.z); }, add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; }, set(x1, y1, z1) { this.x = x1; this.y = y1; this.z = z1; return this; } });
  const moved = provider.resolveMove({ position: vector(0, 1.65, 0), delta: vector(1, 0, 0), radius: .25, eyeHeight: 1.65 });
  assert.deepEqual([moved.x, moved.y, moved.z], [.75, 1.65, 0]);
  const delayed = createLccCollisionProvider({ hasCollision: () => false, intersectsCapsule() { throw new Error('not ready'); } });
  assert.equal(delayed.hasCollision(), false);
  const unchanged = delayed.resolveMove({ position: vector(0, 1.65, 0), delta: vector(1, 0, 0), radius: .25, eyeHeight: 1.65 });
  assert.deepEqual([unchanged.x, unchanged.y, unchanged.z], [1, 1.65, 0]);
});
