import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STREAMING_SCENE_SCHEMA,
  StreamingSceneController,
  StreamingSceneValidationError,
  StreamingTileCache,
  planStreamingTiles,
  validateStreamingScene,
} from '../src/streaming-scenes.js';

const scene = () => ({
  schema: STREAMING_SCENE_SCHEMA,
  id: 'villa.demo',
  units: 'meter',
  bounds: { min: [-100, 0, -100], max: [100, 30, 100] },
  spawn: [0, 1.7, 0],
  collision: 'collision/villa.glb',
  tiles: [
    { id: 'garden-far', region: 'garden', lod: 0, asset: 'tiles/garden-low.glb', kind: 'glb', bounds: { min: [-100, 0, -100], max: [0, 30, 0] }, maxDistance: 1000, bytes: 40, priority: 1 },
    { id: 'garden-near', region: 'garden', lod: 2, asset: 'tiles/garden-high.glb', kind: 'glb', bounds: { min: [-100, 0, -100], max: [0, 30, 0] }, maxDistance: 25, bytes: 80, priority: 1 },
    { id: 'house-far', region: 'house', lod: 0, asset: 'tiles/house-low.glb', kind: 'glb', bounds: { min: [0, 0, 0], max: [100, 30, 100] }, maxDistance: 1000, bytes: 50, priority: 2 },
  ],
});

test('validates a portable tiled scene and blocks path traversal', () => {
  const manifest = validateStreamingScene(scene());
  assert.equal(manifest.tiles.length, 3);
  const unsafe = scene(); unsafe.tiles[0].asset = '../private.glb';
  assert.throws(() => validateStreamingScene(unsafe), StreamingSceneValidationError);
});

test('selects near detail only inside its declared streaming range', () => {
  const manifest = validateStreamingScene(scene());
  const near = planStreamingTiles(manifest, { position: [-10, 1, -10] });
  assert.deepEqual(near.tiles.map(entry => entry.tile.id).sort(), ['garden-near', 'house-far']);
  const far = planStreamingTiles(manifest, { position: [70, 1, 70] });
  assert.deepEqual(far.tiles.map(entry => entry.tile.id).sort(), ['garden-far', 'house-far']);
});

test('plans visible tiles inside the declared decoded cache budget', () => {
  const manifest = validateStreamingScene(scene());
  const plan = planStreamingTiles(manifest, { position: [-10, 1, -10], maxBytes: 100 });
  // house-far wins on priority (50 bytes); the 80-byte garden detail does not
  // fit in the remaining budget and is deliberately deferred.
  assert.deepEqual(plan.tiles.map(entry => entry.tile.id), ['house-far']);
});

test('uses a pessimistic size for tiles whose manifest omitted bytes', () => {
  const raw = scene();
  raw.tiles.forEach(tile => delete tile.bytes);
  const controller = new StreamingSceneController({
    manifest: raw,
    maxCacheBytes: 80,
    defaultTileBytes: 64,
    loadTile: async tile => ({ value: { id: tile.id }, bytes: 64 }),
  });
  const plan = controller.update({ position: [-10, 1, -10] });
  assert.equal(plan.tiles.length, 1);
  controller.dispose();
});

test('uses an LRU cache without evicting currently pinned scene data', () => {
  const disposed = [];
  const cache = new StreamingTileCache({ maxBytes: 10, dispose: value => disposed.push(value.id) });
  cache.set('old', { id: 'old' }, 6);
  cache.set('keep', { id: 'keep' }, 6, { pinned: new Set(['keep']) });
  assert.equal(cache.has('old'), false);
  assert.equal(cache.has('keep'), true);
  assert.deepEqual(disposed, ['old']);
});

test('cancels and evicts tiles that are no longer needed', async () => {
  const ready = [], evicted = [];
  const controller = new StreamingSceneController({
    manifest: scene(),
    maxConcurrent: 2,
    loadTile: async tile => ({ value: { id: tile.id }, bytes: tile.bytes }),
    onTileReady: (tile, value) => ready.push(value.id),
    onTileEvicted: value => evicted.push(value.id),
  });
  controller.update({ position: [-10, 1, -10] });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(ready.sort(), ['garden-near', 'house-far']);
  controller.update({ position: [70, 1, 70] });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(evicted.includes('garden-near'));
  assert.ok(ready.includes('garden-far'));
  controller.dispose();
});

test('releases a tile that arrives after its scene was disposed', async () => {
  let resolveTile;
  const released = [];
  const controller = new StreamingSceneController({
    manifest: scene(),
    maxConcurrent: 1,
    loadTile: () => new Promise(resolve => { resolveTile = resolve; }),
    onTileEvicted: value => released.push(value.id),
  });
  controller.update({ position: [-10, 1, -10] });
  controller.dispose();
  resolveTile({ value: { id: 'late', dispose() { released.push('disposed-late'); } }, bytes: 1 });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(released.includes('disposed-late'));
  assert.equal(controller.cache.entries.size, 0);
});
