/*
 * The first BrowsEye build copies this template to
 * `browseye-xgrids.config.js` when no local configuration exists. That live
 * file is intentionally ignored by Git, so an SDK key cannot be committed by
 * mistake.
 *
 * For a public web build, use only a key that XGRIDS has explicitly restricted
 * to the intended domains and delivery model. For a Windows Player build, add
 * the local config before packaging; Vite will copy it into dist unchanged.
 */
export default {
  // Optional when the supplied SDK is at the default local path.
  moduleUrl: '/vendor/xgrids/lcc-sdk-three.js',

  // appKey: 'provided-by-xgrids',
  // maxHostCacheSize: /* unit/value specified by the installed XGRIDS SDK */,
  // maxGpuCacheSize: /* unit/value specified by the installed XGRIDS SDK */,

  // Use a scene override when an export does not provide useful world bounds
  // (for example a large geospatial coordinate system). `spawn` is the actual
  // eye/camera position, so an upper deck or upper floor is valid.
  scenes: [
    // {
    //   match: 'villa.lcc2',
    //   bounds: { min: [-80, 0, -70], max: [80, 32, 70] },
    //   spawn: [2.5, 6.25, -3],
    //   stereoIpd: 0.064,
    //   stereoFocus: 2.5,
    // },
  ],
};
