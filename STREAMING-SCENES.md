# BrowsEye Streaming Scenes

`browseye-streaming-scene/1` is the open, format-neutral scene package used for very large BrowsEye walkthroughs. It keeps a large villa, yacht or hotel from becoming one browser memory allocation.

## Principle

The manifest is small. It lists spatially bounded tiles, each with an LOD and a maximum loading distance. BrowsEye chooses one useful LOD per visible region, fetches only those files and evicts tiles that are no longer needed. The browser HTTP cache may retain downloaded bytes; the decoded Three.js/GPU resources are bounded by the viewer cache budget.

This is a publishing format, not a converter. A source must first be prepared as tiled glTF, tiled Gaussian Splats, COPC/LAZ, 3D Tiles, LCC2, or another streaming-capable format.

## Package layout

```text
villa/
├── browseye-streaming-scene.json
├── collision/
│   └── villa-navigation.glb
└── tiles/
    ├── exterior-low.glb
    ├── living-room-low.glb
    └── living-room-high.glb
```

An example manifest is at `examples/vipta-streaming-villa/browseye-streaming-scene.json`.

## Tile rules

- `asset` must be a relative path inside the package.
- `bounds` describes the tile volume in scene coordinates.
- Larger `lod` values are more detailed.
- `bytes` should be the decoded/GPU cache estimate for the tile, not just a file-size guess. It lets BrowsEye stay inside the configured active cache budget; omitted values are treated pessimistically by the built-in GLB adapter.
- `spawn`, when present, is the actual camera/eye position. It may be on an upper floor or deck; include collision geometry if the camera should snap to that floor.
- For a region, every lower-detail tile should have a larger `maxDistance` than its detail tiles. This guarantees a useful fallback while the visitor approaches.
- Keep individual tiles modest. A 32–128 MB compressed tile is generally easier to cancel, cache and replace than a gigabyte-sized tile.
- Supply a small collision mesh separately. Gaussian splats and point clouds are visual data; they are not reliable walls or floors for a first-person walk mode.

## Hosting and offline use

Use a normal HTTP(S) server, object storage or a local BrowsEye server. Do not open a 5-GB scene through `file://`. The host should support long-lived cache headers, HTTP range requests when a source adapter needs them, and byte-efficient CDN delivery for remote walkthroughs.

For an offline workstation, copy the whole package to a fast NVMe SSD. In BrowsEye Player, choose **Streaming-Szene → Lokalen Szenenordner wählen** and select that package directory. The player then exposes only this directory on a private loopback URL; the same tile scheduler reads only visible files from the SSD. For browser development, set `BROWSEYE_SCENE_ROOT` and use the `/scenes/` route as described in [LCC-STREAMING-INTEGRATION.md](LCC-STREAMING-INTEGRATION.md).

## Adapter model

`src/streaming-scenes.js` has no built-in decoder. An adapter supplies `loadTile(tile, { signal, distance })` and returns either a decoded value or `{ value, bytes }`. `bytes` is the decoded/GPU cache estimate, not necessarily the HTTP download size. The controller calls `onTileReady(tile, value)` after a wanted tile arrives and `onTileEvicted(value)` when its decoded resources must be removed from the scene and disposed. Every loader must honour the supplied `AbortSignal` where its decoder permits it.

Typical adapters are:

- glTF adapter: fetches and decodes a GLB tile;
- Gaussian-splat adapter: fetches and initializes an SPZ/SOG tile;
- LCC/LCC2 adapter: delegates loading, LOD selection and cache policy to the official XGRIDS SDK;
- geospatial adapter: uses a COPC, 3D Tiles or E57 publishing pipeline.

This separation keeps proprietary SDKs outside the generic BrowsEye scene standard and allows a streaming package to be tested without changing the rest of the viewer.
