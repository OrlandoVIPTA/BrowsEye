# XGRIDS LCC Web SDK

This folder intentionally contains no XGRIDS binary or source distribution.

BrowsEye loads LCC/LCC2 through the official **XGRIDS LCC Web SDK**. Download the SDK with the VIPTA/XGRIDS account and follow the current XGRIDS licence and redistribution terms.

For the BrowsEye integration, place the SDK's Three.js module at:

`public/vendor/xgrids/lcc-sdk-three.js`

Keep the SDK's required companion files and folders next to it exactly as delivered. The BrowsEye adapter loads this module lazily, so the standard viewer remains usable when no licensed LCC SDK is installed.

The first BrowsEye build creates a local `browseye-xgrids.config.js` from the example. If the licensed SDK needs an `appKey`, enter the values supplied by XGRIDS there. The real configuration is ignored by Git. Never put an unrestricted credential in a public website build.

The packaged Windows Player can alternatively receive an operator-side JSON override at `%USERPROFILE%\Documents\BrowsEye\browseye-xgrids.config.json`, so a licensed deployment does not require a source-code change or repackaging. See [the integration guide](../../../LCC-STREAMING-INTEGRATION.md) for the JSON fields and security note.

LCC/LCC2 scenes must be opened from an HTTP(S) path, for example:

`/scenes/villa/meta.lcc2`

They must not be imported using the ordinary local-file picker: their LOD chunks, optional collision data, and environment assets are fetched by the XGRIDS SDK on demand.

For a public web deployment, host scene directories on object storage or a CDN with CORS configured for the BrowsEye origin. For a local workstation, use **Streaming-Szene → Lokalen Szenenordner wählen** in BrowsEye Player (or serve the directory through the included local HTTP server) rather than `file://`.
