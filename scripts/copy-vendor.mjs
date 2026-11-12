import { access, mkdir, cp, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('public/vendor', { recursive: true });
await copyFile('node_modules/web-ifc/web-ifc.wasm', 'public/vendor/web-ifc.wasm');
await cp('node_modules/occt-import-js/dist', 'public/vendor/occt', { recursive: true });
await copyFile('src/cad.worker.js', 'public/vendor/cad-worker.js');
await cp('node_modules/three/examples/jsm/libs/draco', 'public/vendor/draco', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vendor/mediapipe/wasm', { recursive: true });
await mkdir('public/vendor/xgrids', { recursive: true });
// A real XGRIDS config may contain a licensed appKey, so it stays ignored by
// Git. Create a harmless local default only when an operator has not supplied
// one; Vite then copies the stable module path into the player build.
try { await access('public/vendor/xgrids/browseye-xgrids.config.js'); }
catch { await copyFile('public/vendor/xgrids/browseye-xgrids.config.example.js', 'public/vendor/xgrids/browseye-xgrids.config.js'); }
await mkdir('public/licenses', { recursive: true });
for (const [name, file] of [['three','LICENSE'],['web-ifc','LICENSE.md'],['occt-import-js','LICENSE.md'],['dicom-parser','LICENSE'],['@sparkjsdev/spark','LICENSE']]) {
  await copyFile(`node_modules/${name}/${file}`, `public/licenses/${name.replaceAll('/','-')}.txt`);
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('public/licenses/versions.json', JSON.stringify(pkg.dependencies, null, 2));
console.log('Offline-Importer und Lizenztexte bereit.');
