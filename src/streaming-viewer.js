import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from './geometry.js';
import {
  StreamingSceneController,
  StreamingSceneValidationError,
  validateStreamingScene,
} from './streaming-scenes.js';

export class BrowseyeStreamingLoadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'BrowseyeStreamingLoadError';
    if (cause) this.cause = cause;
  }
}

const MIB = 1024 * 1024;

/** Safe URL normalisation for a user-selected streaming scene manifest. */
export function streamingSceneUrl(value, base = globalThis.location?.href || 'http://localhost/') {
  if (typeof value !== 'string' || !value.trim()) throw new BrowseyeStreamingLoadError('Bitte geben Sie die URL zu einer Streaming-Szene an.');
  let url;
  try { url = new URL(value.trim(), base); }
  catch { throw new BrowseyeStreamingLoadError('Die Streaming-URL ist ungültig.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new BrowseyeStreamingLoadError('Streaming-Szenen müssen über HTTP oder HTTPS bereitgestellt werden.');
  return url;
}

const readBytes = response => {
  const value = Number(response.headers.get('content-length'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

function disposeTile(value) {
  if (!value || (typeof value === 'object' && value.browseyeDisposed)) return;
  if (typeof value === 'object') value.browseyeDisposed = true;
  if (value.object?.parent) value.object.parent.remove(value.object);
  if (typeof value.dispose === 'function') value.dispose();
  else if (value.object) disposeObject(value.object);
}

/**
 * Turns a portable `browseye-streaming-scene/1` manifest into a real Three.js
 * scene. Each GLB tile is decoded only after the LOD planner has selected it;
 * the controller evicts decoded GPU resources when the visitor walks away.
 */
export class BrowseyeStreamingScene {
  constructor({ manifest, manifestUrl, maxCacheBytes = 768 * MIB, maxTileBytes = 256 * MIB, maxConcurrent = 3, maxTiles = 80, onProgress = () => {} } = {}) {
    this.manifest = validateStreamingScene(manifest);
    this.manifestUrl = streamingSceneUrl(manifestUrl);
    this.maxTileBytes = maxTileBytes;
    this.root = new T.Group();
    this.root.name = `Streaming · ${this.manifest.id}`;
    this.collisionMesh = null;
    this.disposed = false;
    this.loadedCount = 0;
    this.onProgress = onProgress;
    this._frustum = new T.Frustum();
    this._projection = new T.Matrix4();
    this._box = new T.Box3();
    this._lastPosition = new T.Vector3(Infinity, Infinity, Infinity);
    this._lastPlan = 0;
    this.controller = new StreamingSceneController({
      manifest: this.manifest,
      maxCacheBytes,
      maxConcurrent,
      maxTiles,
      // An author should declare `tile.bytes` precisely. Until then plan
      // pessimistically: only a few unknown maximum-size tiles may be active.
      defaultTileBytes: maxTileBytes,
      loadTile: (tile, options) => this._loadTile(tile, options),
      onTileReady: (tile, value) => {
        if (this.disposed) return disposeTile(value);
        value.object.name = `LOD ${tile.lod} · ${tile.id}`;
        this.root.add(value.object);
        this.loadedCount += 1;
        this.onProgress({ loaded: this.loadedCount, active: this.controller.cache.entries.size, tile });
      },
      onTileEvicted: value => disposeTile(value),
    });
  }

  get bounds() {
    return new T.Box3(new T.Vector3(...this.manifest.bounds.min), new T.Vector3(...this.manifest.bounds.max));
  }

  get spawn() { return this.manifest.spawn ? [...this.manifest.spawn] : null; }

  async _loadTile(tile, { signal } = {}) {
    const path = new URL(tile.asset, this.manifestUrl);
    const suffix = path.pathname.split('.').pop()?.toLowerCase();
    if (tile.kind.toLowerCase() !== 'glb' || suffix !== 'glb') {
      throw new BrowseyeStreamingLoadError(`Streaming-Kachel „${tile.id}“ ist ${tile.kind}. Der offene BrowsEye-Streaming-Adapter lädt derzeit gekachelte GLB-Dateien; LCC/LCC2 verwendet den separaten XGRIDS-Adapter.`);
    }
    const response = await fetch(path, { signal });
    if (!response.ok) throw new BrowseyeStreamingLoadError(`Kachel „${tile.id}“ konnte nicht geladen werden (${response.status}).`);
    const declared = readBytes(response);
    if (declared && declared > this.maxTileBytes) throw new BrowseyeStreamingLoadError(`Kachel „${tile.id}“ ist ${(declared / MIB).toFixed(0)} MB groß. Bitte die Quelle in kleinere LOD-Kacheln aufteilen.`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > this.maxTileBytes) throw new BrowseyeStreamingLoadError(`Kachel „${tile.id}“ überschreitet das BrowsEye-Kachelbudget von ${(this.maxTileBytes / MIB).toFixed(0)} MB.`);
    if (signal?.aborted) throw new DOMException('Streaming-Kachel wurde nicht mehr benötigt.', 'AbortError');
    const gltf = await new GLTFLoader().parseAsync(buffer, path.href.slice(0, path.href.lastIndexOf('/') + 1));
    const object = gltf.scene;
    object.updateMatrixWorld(true);
    return {
      value: {
        object,
        dispose() { disposeObject(object); },
      },
      bytes: tile.bytes ?? buffer.byteLength,
    };
  }

  async loadCollision() {
    if (!this.manifest.collision) return null;
    const path = new URL(this.manifest.collision, this.manifestUrl);
    if (!path.pathname.toLowerCase().endsWith('.glb')) throw new BrowseyeStreamingLoadError('Das Kollisionsmodell muss derzeit als GLB bereitgestellt werden.');
    const response = await fetch(path);
    if (!response.ok) throw new BrowseyeStreamingLoadError(`Kollisionsmodell konnte nicht geladen werden (${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > this.maxTileBytes) throw new BrowseyeStreamingLoadError('Das Kollisionsmodell ist zu groß. Bitte eine einfache Navigationsgeometrie exportieren.');
    const gltf = await new GLTFLoader().parseAsync(buffer, path.href.slice(0, path.href.lastIndexOf('/') + 1));
    this.collisionMesh = gltf.scene;
    this.collisionMesh.updateMatrixWorld(true);
    return this.collisionMesh;
  }

  /** Plan at most ten times per second, or immediately after a meaningful move. */
  update(camera) {
    if (this.disposed || !camera) return;
    const now = performance.now();
    if (now - this._lastPlan < 100 && camera.position.distanceToSquared(this._lastPosition) < .04) return;
    this._lastPlan = now; this._lastPosition.copy(camera.position);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this._projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projection);
    this.controller.update({
      position: camera.position.toArray(),
      isVisible: tile => {
        this._box.min.fromArray(tile.bounds.min); this._box.max.fromArray(tile.bounds.max);
        return this._frustum.intersectsBox(this._box);
      },
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.dispose();
    if (this.collisionMesh) disposeObject(this.collisionMesh);
    this.collisionMesh = null;
  }
}

/** Fetch and validate a portable streaming manifest without loading its tiles. */
export async function loadBrowseyeStreamingScene(manifestPath, options = {}) {
  const manifestUrl = streamingSceneUrl(manifestPath);
  let response;
  try { response = await fetch(manifestUrl); }
  catch (error) { throw new BrowseyeStreamingLoadError('Streaming-Szenenmanifest konnte nicht erreicht werden. Prüfen Sie Server, Netzwerk und CORS-Freigabe.', error); }
  if (!response.ok) throw new BrowseyeStreamingLoadError(`Streaming-Szenenmanifest konnte nicht geladen werden (${response.status}).`);
  let raw;
  try { raw = await response.json(); }
  catch (error) { throw new BrowseyeStreamingLoadError('Streaming-Szenenmanifest ist kein gültiges JSON-Dokument.', error); }
  try { return new BrowseyeStreamingScene({ manifest: raw, manifestUrl: manifestUrl.href, ...options }); }
  catch (error) {
    if (error instanceof StreamingSceneValidationError || error instanceof BrowseyeStreamingLoadError) throw error;
    throw new BrowseyeStreamingLoadError('Streaming-Szene konnte nicht vorbereitet werden.', error);
  }
}
