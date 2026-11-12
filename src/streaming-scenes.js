/**
 * Spatial streaming foundation for BrowsEye.
 *
 * A streaming scene is deliberately a package of small, independently
 * loadable tiles. It is not a promise that a large source file can be made
 * small by a viewer. Source data must first be exported as a tiled/LOD scene
 * (for example LCC2, COPC, 3D Tiles, or tiled glTF).
 */
export const STREAMING_SCENE_SCHEMA = 'browseye-streaming-scene/1';

export class StreamingSceneValidationError extends Error {
  constructor(message) { super(message); this.name = 'StreamingSceneValidationError'; }
}

const MAX_TILES = 100_000;
const MAX_ASSET_BYTES = 4 * 1024 * 1024 * 1024;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value);
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);

function asObject(value, field) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new StreamingSceneValidationError(`${field} muss ein Objekt sein.`);
  return value;
}

function string(value, field, { max = 300, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new StreamingSceneValidationError(`${field} fehlt.`);
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new StreamingSceneValidationError(`${field} ist ungültig.`);
  return value.trim();
}

export function streamingRelativeAssetPath(value, field = 'Dateipfad') {
  const text = string(value, field, { max: 700 });
  if (text.includes('\0')) throw new StreamingSceneValidationError(`${field} ist ungültig.`);
  const path = text.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || path.split('/').includes('..')) {
    throw new StreamingSceneValidationError(`${field} muss innerhalb des Szenenpakets liegen.`);
  }
  return path;
}

function vector(value, field) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finiteNumber)) throw new StreamingSceneValidationError(`${field} muss drei endliche Zahlen enthalten.`);
  return value.map(Number);
}

export function validateStreamingBounds(value, field = 'bounds') {
  const bounds = asObject(value, field);
  const min = vector(bounds.min, `${field}.min`);
  const max = vector(bounds.max, `${field}.max`);
  if (min.some((number, index) => number >= max[index])) throw new StreamingSceneValidationError(`${field} benötigt ein gültiges Minimum und Maximum.`);
  return Object.freeze({ min, max });
}

function tile(value, index) {
  const raw = asObject(value, `tiles[${index}]`);
  const id = string(raw.id, `tiles[${index}].id`, { max: 160 });
  if (!validId(id)) throw new StreamingSceneValidationError(`tiles[${index}].id enthält unzulässige Zeichen.`);
  const region = string(raw.region || id, `tiles[${index}].region`, { max: 160 });
  if (!validId(region)) throw new StreamingSceneValidationError(`tiles[${index}].region enthält unzulässige Zeichen.`);
  if (!Number.isInteger(raw.lod) || raw.lod < 0 || raw.lod > 32) throw new StreamingSceneValidationError(`tiles[${index}].lod muss eine Ganzzahl zwischen 0 und 32 sein.`);
  if (!finiteNumber(raw.maxDistance) || raw.maxDistance <= 0 || raw.maxDistance > 100_000_000) throw new StreamingSceneValidationError(`tiles[${index}].maxDistance ist ungültig.`);
  const bytes = raw.bytes === undefined ? undefined : Number(raw.bytes);
  if (bytes !== undefined && (!Number.isInteger(bytes) || bytes < 0 || bytes > MAX_ASSET_BYTES)) throw new StreamingSceneValidationError(`tiles[${index}].bytes ist ungültig.`);
  const priority = raw.priority === undefined ? 0 : Number(raw.priority);
  if (!finiteNumber(priority) || priority < -1_000_000 || priority > 1_000_000) throw new StreamingSceneValidationError(`tiles[${index}].priority ist ungültig.`);
  const kind = string(raw.kind || 'glb', `tiles[${index}].kind`, { max: 40 });
  return Object.freeze({
    id,
    region,
    lod: raw.lod,
    asset: streamingRelativeAssetPath(raw.asset, `tiles[${index}].asset`),
    kind,
    bounds: validateStreamingBounds(raw.bounds, `tiles[${index}].bounds`),
    maxDistance: Number(raw.maxDistance),
    bytes,
    priority,
  });
}

/** Validate a portable, streaming-ready BrowsEye scene package manifest. */
export function validateStreamingScene(value) {
  const raw = asObject(value, 'Streaming-Szene');
  if (raw.schema !== STREAMING_SCENE_SCHEMA) throw new StreamingSceneValidationError(`Dieses Paket benötigt schema „${STREAMING_SCENE_SCHEMA}“.`);
  const id = string(raw.id, 'id', { max: 160 });
  if (!validId(id)) throw new StreamingSceneValidationError('id enthält unzulässige Zeichen.');
  if (!Array.isArray(raw.tiles) || !raw.tiles.length || raw.tiles.length > MAX_TILES) throw new StreamingSceneValidationError(`tiles benötigt zwischen 1 und ${MAX_TILES} Einträgen.`);
  const tiles = raw.tiles.map(tile);
  const ids = new Set();
  for (const entry of tiles) {
    if (ids.has(entry.id)) throw new StreamingSceneValidationError(`Die Kachel-ID „${entry.id}“ ist doppelt vorhanden.`);
    ids.add(entry.id);
  }
  const result = {
    schema: STREAMING_SCENE_SCHEMA,
    id,
    version: string(raw.version || '1.0.0', 'version', { max: 80 }),
    units: string(raw.units || 'meter', 'units', { max: 40 }),
    bounds: validateStreamingBounds(raw.bounds, 'bounds'),
    spawn: raw.spawn === undefined ? undefined : vector(raw.spawn, 'spawn'),
    collision: raw.collision === undefined ? undefined : streamingRelativeAssetPath(raw.collision, 'collision'),
    tiles,
  };
  return Object.freeze(result);
}

export async function readStreamingSceneManifest(file) {
  let raw;
  try { raw = JSON.parse(await file.text()); }
  catch { throw new StreamingSceneValidationError('Das Streaming-Szenenmanifest ist kein gültiges JSON-Dokument.'); }
  return validateStreamingScene(raw);
}

function distanceToBounds(position, bounds) {
  let squared = 0;
  for (let index = 0; index < 3; index += 1) {
    const delta = position[index] < bounds.min[index] ? bounds.min[index] - position[index]
      : position[index] > bounds.max[index] ? position[index] - bounds.max[index] : 0;
    squared += delta * delta;
  }
  return Math.sqrt(squared);
}

/**
 * Select one appropriate LOD for every visible region.
 * `isVisible` can be connected to Three.js Frustum.intersectsBox by the viewer.
 */
export function planStreamingTiles(manifest, {
  position = [0, 0, 0],
  isVisible = () => true,
  maxTiles = 96,
  maxBytes = Infinity,
  unknownTileBytes = 0,
} = {}) {
  const scene = manifest?.schema === STREAMING_SCENE_SCHEMA ? manifest : validateStreamingScene(manifest);
  if (!Array.isArray(position) || position.length !== 3 || !position.every(finiteNumber)) throw new TypeError('position benötigt drei endliche Zahlen.');
  if (!Number.isInteger(maxTiles) || maxTiles < 1) throw new TypeError('maxTiles muss mindestens 1 sein.');
  if (!(maxBytes > 0)) throw new TypeError('maxBytes muss positiv sein.');
  if (!Number.isFinite(unknownTileBytes) || unknownTileBytes < 0) throw new TypeError('unknownTileBytes muss eine nicht-negative Zahl sein.');
  const byRegion = new Map();
  for (const entry of scene.tiles) {
    const distance = distanceToBounds(position, entry.bounds);
    if (distance > entry.maxDistance || !isVisible(entry, distance)) continue;
    const candidates = byRegion.get(entry.region) || [];
    candidates.push({ tile: entry, distance });
    byRegion.set(entry.region, candidates);
  }
  const preferred = [];
  for (const candidates of byRegion.values()) {
    // High LOD means more detail. If equal, use explicit priority then nearby data first.
    candidates.sort((a, b) => b.tile.lod - a.tile.lod || b.tile.priority - a.tile.priority || a.distance - b.distance);
    preferred.push(candidates[0]);
  }
  preferred.sort((a, b) => b.tile.priority - a.tile.priority || a.distance - b.distance || b.tile.lod - a.tile.lod);
  const selected = [];
  let bytes = 0;
  for (const candidate of preferred) {
    const estimate = candidate.tile.bytes ?? unknownTileBytes;
    if (selected.length >= maxTiles || (selected.length && bytes + estimate > maxBytes)) continue;
    selected.push(Object.freeze({ ...candidate, score: candidate.tile.priority * 1_000_000 - candidate.distance + candidate.tile.lod / 100 }));
    bytes += estimate;
  }
  return Object.freeze({ tiles: Object.freeze(selected), estimatedBytes: bytes, visibleRegions: byRegion.size });
}

/** A small LRU cache that keeps GPU/decoded resources within an explicit budget. */
export class StreamingTileCache {
  constructor({ maxBytes = 512 * 1024 * 1024, dispose = value => value?.dispose?.() } = {}) {
    if (!Number.isFinite(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes muss positiv sein.');
    this.maxBytes = maxBytes;
    this.dispose = dispose;
    this.entries = new Map();
    this.bytes = 0;
    this.clock = 0;
  }

  get(id) {
    const entry = this.entries.get(id);
    if (entry) entry.lastUsed = ++this.clock;
    return entry?.value;
  }

  has(id) { return this.entries.has(id); }

  set(id, value, bytes = 0, { pinned = new Set() } = {}) {
    if (!Number.isFinite(bytes) || bytes < 0) throw new TypeError('bytes muss eine nicht-negative Zahl sein.');
    this.delete(id);
    this.entries.set(id, { value, bytes, lastUsed: ++this.clock });
    this.bytes += bytes;
    this.evict(pinned);
    return value;
  }

  delete(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.entries.delete(id);
    this.bytes -= entry.bytes;
    this.dispose(entry.value);
    return true;
  }

  evict(pinned = new Set()) {
    const candidates = () => [...this.entries.entries()]
      .filter(([id]) => !pinned.has(id))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (this.bytes > this.maxBytes) {
      const victim = candidates()[0];
      if (!victim) break; // Visible data can temporarily exceed the budget rather than flicker away.
      this.delete(victim[0]);
    }
  }

  clear() { for (const id of [...this.entries.keys()]) this.delete(id); }
}

/**
 * Schedules only wanted tile loads, cancels stale requests and bounds decoded
 * resources through StreamingTileCache. The viewer supplies the actual decoder
 * (glTF, XGRIDS LCC2, COPC, etc.), keeping this module format-neutral.
 */
export class StreamingSceneController {
  constructor({
    manifest,
    loadTile,
    onTileReady = () => {},
    onTileEvicted = () => {},
    maxConcurrent = 4,
    maxCacheBytes = 512 * 1024 * 1024,
    maxTiles = 96,
    defaultTileBytes = 0,
  }) {
    if (typeof loadTile !== 'function') throw new TypeError('loadTile muss eine Funktion sein.');
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new TypeError('maxConcurrent muss mindestens 1 sein.');
    this.manifest = validateStreamingScene(manifest);
    this.loadTile = loadTile;
    this.onTileReady = onTileReady;
    this.onTileEvicted = onTileEvicted;
    this.maxConcurrent = maxConcurrent;
    this.maxTiles = maxTiles;
    this.maxCacheBytes = maxCacheBytes;
    if (!Number.isFinite(defaultTileBytes) || defaultTileBytes < 0) throw new TypeError('defaultTileBytes muss eine nicht-negative Zahl sein.');
    this.defaultTileBytes = defaultTileBytes;
    this.desired = new Set();
    this.queue = [];
    this.inflight = new Map();
    this.disposed = false;
    this.cache = new StreamingTileCache({ maxBytes: maxCacheBytes, dispose: value => this.onTileEvicted(value) });
  }

  update(options = {}) {
    if (this.disposed) return Object.freeze({ tiles: Object.freeze([]), estimatedBytes: 0, visibleRegions: 0 });
    const plan = planStreamingTiles(this.manifest, {
      ...options,
      maxTiles: options.maxTiles ?? this.maxTiles,
      maxBytes: options.maxBytes ?? this.maxCacheBytes,
      unknownTileBytes: options.unknownTileBytes ?? this.defaultTileBytes,
    });
    this.desired = new Set(plan.tiles.map(entry => entry.tile.id));
    for (const [id, request] of this.inflight) if (!this.desired.has(id)) request.controller.abort();
    for (const id of [...this.cache.entries.keys()]) if (!this.desired.has(id)) this.cache.delete(id);
    this.queue = plan.tiles.filter(entry => !this.cache.has(entry.tile.id) && !this.inflight.has(entry.tile.id));
    this.pump();
    return plan;
  }

  async pump() {
    if (this.disposed) return;
    while (this.inflight.size < this.maxConcurrent && this.queue.length) {
      const entry = this.queue.shift();
      const controller = new AbortController();
      this.inflight.set(entry.tile.id, { controller, entry });
      Promise.resolve(this.loadTile(entry.tile, { signal: controller.signal, distance: entry.distance }))
        .then(result => {
          const value = result?.value ?? result;
          if (this.disposed || !this.desired.has(entry.tile.id) || controller.signal.aborted) {
            value?.dispose?.();
            return;
          }
          const bytes = Number.isFinite(result?.bytes) ? result.bytes : (entry.tile.bytes || 0);
          this.cache.set(entry.tile.id, value, bytes, { pinned: this.desired });
          this.onTileReady(entry.tile, value);
        })
        .catch(error => {
          if (error?.name !== 'AbortError') console.warn(`BrowsEye Streaming: Kachel „${entry.tile.id}“ konnte nicht geladen werden.`, error);
        })
        .finally(() => {
          this.inflight.delete(entry.tile.id);
          this.pump();
        });
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const request of this.inflight.values()) request.controller.abort();
    this.inflight.clear();
    this.queue = [];
    this.desired.clear();
    this.cache.clear();
  }
}

/** Convenience loader for per-tile HTTP assets. It fetches a tile, never a whole scene package. */
export function createStreamingFetchLoader(baseUrl, { fetchImpl = globalThis.fetch, headers } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Eine fetch-Implementierung wird benötigt.');
  return async (tile, { signal } = {}) => {
    const url = new URL(tile.asset, baseUrl).toString();
    const response = await fetchImpl(url, { signal, headers });
    if (!response.ok) throw new Error(`Streaming-Kachel konnte nicht geladen werden (${response.status}).`);
    const buffer = await response.arrayBuffer();
    return { value: { url, buffer }, bytes: buffer.byteLength };
  };
}
