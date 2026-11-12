# BrowsEye LCC / LCC2 Streaming

## Purpose

BrowsEye keeps two deliberately separate paths:

1. **Direct import** for small and medium files such as IFC, STEP, GLB, LAS, PLY and SPZ.
2. **Streaming scenes** for XGRIDS LCC and LCC2. The XGRIDS SDK keeps only the currently useful LOD chunks in host and GPU cache.

An LCC2 scene is a URL-addressable package. Do not pass a multi-gigabyte `.lcc2` browser `File` to `arrayBuffer()` and do not zip its companion chunks into a single upload.

The integration follows the current [XGRIDS LCC Web SDK documentation](https://cdn-docs.xgrids.cloud/en-us/07-plugin-sdk/03-web/v0.6.4/001-introduction.html). The concrete SDK bundle, licence terms and real sample packages remain an XGRIDS/VIPTA acceptance item.

## Vendor SDK installation

The official LCC Web SDK is separately licensed and is therefore not committed to this public repository.

1. Obtain the current LCC Web SDK from XGRIDS using VIPTA's authorised account.
2. Confirm the intended distribution and attribution terms with XGRIDS before shipping a player.
3. Copy the delivered `lcc-sdk-three.js` plus every companion file it references into `public/vendor/xgrids/`.
4. The first build creates a local `browseye-xgrids.config.js` from the example. If XGRIDS provides an `appKey`, enter it there. That live configuration is deliberately ignored by Git.
5. Build BrowsEye. Vite copies the vendor folder unchanged to the local player and web build.

The adapter expects `LCCRender` with the official `load()` and `update()` APIs. It defaults to `/vendor/xgrids/lcc-sdk-three.js`; another location can be supplied through `loadXgridsLccSdk({ moduleUrl })`.

Do not put an unrestricted credential into a public web deployment. Use only an XGRIDS key approved for the intended web domain and distribution. For a Windows player, add the local configuration before packaging the player.

The Windows Player also reads an optional operator-side JSON override from:

```text
%USERPROFILE%\Documents\BrowsEye\browseye-xgrids.config.json
```

This makes it possible to provide an app key, cache values or a per-scene bounds/spawn override without changing the public source or repackaging the player. It has the same fields as the example configuration, expressed as JSON (without comments). The local JSON values take precedence over the bundled defaults.

For application code, `getXgridsLccAvailability()` returns an availability result without throwing. `loadXgridsScene({ dataPath, THREE, renderer, scene, camera, ... })` is the one-call convenience entry point; it returns an active `LccStreamingSession`.

## Using the adapter

```js
import * as THREE from 'three';
import { loadXgridsLccSdk, LccStreamingSession } from './lcc-streaming.js';

const sdk = await loadXgridsLccSdk();
const streaming = new LccStreamingSession({
  sdk, THREE, renderer, scene, camera,
  // Cache values are passed unchanged to the current XGRIDS SDK.
  maxHostCacheSize: 1_024,
  maxGpuCacheSize: 512,
  onProgress: value => updateLoadingUi(value),
});

await streaming.load('/scenes/villa/meta.lcc2');
streaming.setQuality({ maxSplats: 8_000_000, maxNodeSplats: 4_000_000, maxDistance: 200 });

renderer.setAnimationLoop(() => {
  streaming.update();
  renderer.render(scene, camera);
});
```

Call `streaming.setCamera(activeCamera)` after switching the BrowsEye camera and `streaming.dispose()` before loading another scene.

## Opening a local package in BrowsEye Player

The packaged Windows player has **Streaming-Szene → Lokalen Szenenordner wählen**. Select the package directory, not an individual 5-GB file. The desktop shell exposes only that directory through a private loopback URL and supports HTTP byte ranges, so the official SDK can request its LOD and collision companions normally. The renderer receives no general file-system permission.

For the browser development server, an SSD-resident package can be mounted intentionally:

```powershell
$env:BROWSEYE_SCENE_ROOT = 'D:\Scenes\Villa-01'
npm start
```

Then open its entry as `/scenes/meta.lcc2` (or its relative path below that folder). For a remote deployment use HTTPS plus CORS for the BrowsEye origin.

## Bounds, spawn and stereo metadata

BrowsEye asks the LCC object for scene bounds. If an export does not expose useful bounds early enough — particularly with nonlocal geospatial coordinates — add a matching `scenes` entry in `browseye-xgrids.config.js`. It can supply `bounds`, `spawn`, `stereoIpd` and `stereoFocus`; the example file documents the shape. `spawn` is the actual eye/camera position, so it may legitimately be on an upper hotel floor or yacht deck. The streaming first-person mode uses a stable 64-mm maximum IPD in metre-based scenes, scaled by BrowsEye's Stereotiefe control.

## Stereo and walkthrough acceptance tests

Before production release, validate a real scene on each target workstation:

- LCC and LCC2 opening through a local HTTP server and through HTTPS object storage;
- correct LOD streaming after walking between rooms;
- cache bounds with the intended `maxHostCacheSize` and `maxGpuCacheSize`;
- both eyes in every required StereoVisor output mode;
- camera-specific Gaussian sorting, visual stability and framerate;
- collision data with floor placement, wall blocking and stair handling.

The player maps XGRIDS `hasCollision()` and `intersectsCapsule({ start, end, radius, noDelta: false })` to its walk controller. The correction vector blocks the camera where LCC collision information is present. A real-scene test must still validate the floor height, correction direction, walls and stair behaviour. A Gaussian splat image alone is not a physical floor or wall.
