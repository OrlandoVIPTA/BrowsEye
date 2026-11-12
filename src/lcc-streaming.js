/**
 * XGRIDS LCC / LCC2 streaming boundary for BrowsEye.
 *
 * LCC scenes are URL-addressable scene packages, not files to be read with
 * File.arrayBuffer(). The official XGRIDS Web SDK owns their LOD selection,
 * on-demand requests and host/GPU cache. Keeping this integration isolated
 * means the normal local-file import path stays small and predictable.
 */

export const LCC_EXTENSIONS = Object.freeze(['lcc', 'lcc2']);
export const DEFAULT_XGRIDS_MODULE_URL = '/vendor/xgrids/lcc-sdk-three.js';

export class LccStreamingError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'LccStreamingError';
    if (cause) this.cause = cause;
  }
}

export class LccSdkUnavailableError extends LccStreamingError {
  constructor(moduleUrl, cause) {
    super(`Das offizielle XGRIDS LCC Web SDK wurde nicht gefunden (${moduleUrl}). ` +
      'LCC/LCC2-Szenen benötigen das von XGRIDS lizenzierte SDK als lokale BrowsEye-Erweiterung.', cause);
    this.name = 'LccSdkUnavailableError';
  }
}

export const lccExtension = value => {
  const pathname = String(value || '').split(/[?#]/, 1)[0];
  const last = pathname.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  return dot < 0 ? '' : last.slice(dot + 1).toLowerCase();
};

export const isLccStreamingPath = value => LCC_EXTENSIONS.includes(lccExtension(value));

/**
 * A browser File/blob cannot be sufficient for LCC2: the SDK needs the scene
 * URL in order to request its companion LOD chunks. Only a URL is accepted.
 */
export function validateLccStreamingPath(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new LccStreamingError('Für LCC/LCC2 wird eine URL zum Szenenpaket benötigt.');
  }
  const path = value.trim();
  if (/^(blob:|data:|file:)/i.test(path)) {
    throw new LccStreamingError('Eine lokale Einzeldatei reicht für LCC/LCC2 nicht aus. Bitte die Szene über einen lokalen HTTP-Server oder eine HTTPS-URL öffnen, damit Detailbereiche nachgeladen werden können.');
  }
  if (!isLccStreamingPath(path)) {
    throw new LccStreamingError('Die Streaming-URL muss auf .lcc oder .lcc2 enden.');
  }
  return path;
}

function findLccRender(candidate) {
  const sdk = candidate?.LCCRender || candidate?.default?.LCCRender || candidate?.default || candidate;
  if (!sdk || typeof sdk.load !== 'function' || typeof sdk.update !== 'function') return null;
  return sdk;
}

/**
 * Resolves the official module lazily, so normal BrowsEye builds do not need
 * proprietary XGRIDS files. Tests and host applications can supply importModule.
 */
export async function loadXgridsLccSdk({ moduleUrl = DEFAULT_XGRIDS_MODULE_URL, importModule } = {}) {
  try {
    const imported = await (importModule ? importModule(moduleUrl) : import(/* @vite-ignore */ moduleUrl));
    const sdk = findLccRender(imported);
    if (!sdk) throw new Error('LCCRender.load/update export fehlt.');
    return sdk;
  } catch (error) {
    if (error instanceof LccSdkUnavailableError) throw error;
    throw new LccSdkUnavailableError(moduleUrl, error);
  }
}

/** A non-throwing probe for UI code before offering an LCC scene picker. */
export async function getXgridsLccAvailability(options = {}) {
  try {
    const sdk = await loadXgridsLccSdk(options);
    return { available: true, sdk, error: null };
  } catch (error) {
    return { available: false, sdk: null, error };
  }
}

const finitePositive = value => Number.isFinite(value) && value > 0;
const callIfPresent = (object, method, ...args) => typeof object?.[method] === 'function' ? object[method](...args) : undefined;

/**
 * One active streamed LCC scene. `update()` must be called from BrowsEye's
 * animation loop before Three.js renders the scene.
 */
export class LccStreamingSession {
  constructor({ sdk, THREE, renderer, scene, camera, canvas, appKey, onProgress, onError, useEnv = true, useIndexDB = true, useLoadingEffect = true, maxHostCacheSize, maxGpuCacheSize } = {}) {
    if (!findLccRender(sdk)) throw new LccStreamingError('LCCStreamingSession benötigt LCCRender aus dem offiziellen XGRIDS Web SDK.');
    if (!THREE || !renderer || !scene || !camera) throw new LccStreamingError('LCCStreamingSession benötigt Three.js, Renderer, Szene und Kamera.');
    this.sdk = findLccRender(sdk);
    this.THREE = THREE;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas || renderer.domElement;
    this.appKey = appKey;
    this.onProgress = onProgress || (() => {});
    this.onError = onError || (() => {});
    this.options = { useEnv, useIndexDB, useLoadingEffect, maxHostCacheSize, maxGpuCacheSize };
    this.object = null;
    this.path = null;
    this.loading = null;
    this.disposed = false;
  }

  async load(dataPath, overrides = {}) {
    if (this.disposed) throw new LccStreamingError('Diese LCC-Streaming-Sitzung wurde bereits beendet.');
    if (this.loading) throw new LccStreamingError('Eine LCC-Szene wird bereits geladen.');
    if (this.object) this.unload();
    const path = validateLccStreamingPath(dataPath);
    const options = { ...this.options, ...overrides };
    this.path = path;
    this.loading = new Promise((resolve, reject) => {
      let completed = false;
      const fail = error => {
        if (completed) return;
        completed = true;
        const reason = error instanceof Error ? error : new LccStreamingError('Die LCC/LCC2-Szene konnte nicht geladen werden.');
        this.loading = null;
        this.onError(reason);
        reject(reason);
      };
      const succeed = model => {
        if (completed) return;
        completed = true;
        // Some SDK releases return the scene object from load(); others pass
        // it only through this callback. Keep either form as the active one.
        this.object = model || this.object;
        this.model = this.object;
        this.loading = null;
        resolve(this);
      };
      const progress = value => {
        const normalized = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
        this.onProgress(normalized);
      };
      const params = {
        camera: this.camera,
        scene: this.scene,
        renderer: this.renderer,
        renderLib: this.THREE,
        dataPath: path,
        canvas: this.canvas,
        useEnv: options.useEnv !== false,
        useIndexDB: options.useIndexDB !== false,
        useLoadingEffect: options.useLoadingEffect !== false,
      };
      if (options.appKey || this.appKey) params.appKey = options.appKey || this.appKey;
      if (finitePositive(options.maxHostCacheSize)) params.maxHostCacheSize = options.maxHostCacheSize;
      if (finitePositive(options.maxGpuCacheSize)) params.maxGpuCacheSize = options.maxGpuCacheSize;
      try {
        const returned = this.sdk.load(params, succeed, progress, fail);
        // Do not overwrite an object delivered by a synchronous callback with
        // an undefined return value.
        if (returned && !this.object) this.object = returned;
      } catch (error) {
        fail(error);
      }
    });
    return this.loading;
  }

  update() {
    if (!this.disposed && this.object) this.sdk.update();
  }

  setCamera(camera) {
    if (!camera) throw new LccStreamingError('Eine gültige Three.js-Kamera wird benötigt.');
    this.camera = camera;
    callIfPresent(this.sdk, 'setCamera', camera);
  }

  setQuality({ startLod, endLod, maxSplats, maxNodeSplats, maxDistance } = {}) {
    if (!this.object) return;
    if (Number.isInteger(startLod) && startLod >= 0) callIfPresent(this.object, 'setStartLod', startLod);
    if (Number.isInteger(endLod) && endLod >= 0) callIfPresent(this.object, 'setEndLod', endLod);
    if (finitePositive(maxSplats)) callIfPresent(this.object, 'setMaxSplats', maxSplats);
    if (finitePositive(maxNodeSplats)) callIfPresent(this.object, 'setMaxNodeSplats', maxNodeSplats);
    if (finitePositive(maxDistance)) callIfPresent(this.object, 'setMaxDistance', maxDistance);
  }

  hasCollision() { return Boolean(callIfPresent(this.object, 'hasCollision')); }
  intersectsCapsule(...args) { return callIfPresent(this.object, 'intersectsCapsule', ...args); }
  lowerToBottom(...args) { return callIfPresent(this.object, 'lowerToBottom', ...args); }
  getBounds() { return callIfPresent(this.object, 'getBounds'); }

  unload() {
    if (this.object) {
      if (typeof this.sdk.dispose === 'function') this.sdk.dispose(this.object);
      else callIfPresent(this.sdk, 'unload', this.object);
      if (typeof this.sdk.dispose !== 'function' && typeof this.sdk.unload !== 'function') callIfPresent(this.object, 'dispose');
    }
    this.object = null;
    this.model = null;
    this.path = null;
    this.loading = null;
  }

  dispose() {
    this.unload();
    this.disposed = true;
  }
}

/**
 * Turns the XGRIDS capsule API into BrowsEye's small, renderer-independent
 * walking-collision contract. Collision availability is checked on each move,
 * because XGRIDS may stream collision LODs shortly after the visual LODs.
 */
export function createLccCollisionProvider(session) {
  if (!session || typeof session.hasCollision !== 'function' || typeof session.intersectsCapsule !== 'function') return null;
  return Object.freeze({
    hasCollision: () => Boolean(session.hasCollision()),
    resolveMove({ position, delta, radius, eyeHeight }) {
      if (!position?.clone || !delta || !Number.isFinite(radius) || !Number.isFinite(eyeHeight)) return position;
      const candidate = position.clone().add(delta);
      // Collision LODs can arrive slightly after visual LODs. Until then
      // preserve the intended walking move and check again on the next frame.
      if (!session.hasCollision()) return candidate;
      const result = session.intersectsCapsule({
        start: { x: candidate.x, y: candidate.y - eyeHeight, z: candidate.z },
        end: { x: candidate.x, y: candidate.y, z: candidate.z },
        radius,
        noDelta: false,
      });
      if (!result?.hit) return candidate;
      const correction = result.delta;
      if (!correction || ![correction.x, correction.y, correction.z].every(Number.isFinite)) return position;
      return candidate.set(candidate.x + correction.x, candidate.y + correction.y, candidate.z + correction.z);
    },
  });
}

/**
 * Convenience entry point for application UI: resolve the licensed SDK, make
 * one session, and start streaming a remote or local-HTTP LCC scene.
 */
export async function loadXgridsScene({ dataPath, moduleUrl, importModule, loadOptions, ...sessionOptions } = {}) {
  const sdk = sessionOptions.sdk || await loadXgridsLccSdk({ moduleUrl, importModule });
  const session = new LccStreamingSession({ ...sessionOptions, sdk });
  await session.load(dataPath, loadOptions);
  return session;
}
