import { mkdir, cp, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('public/vendor', { recursive: true });
await copyFile('node_modules/web-ifc/web-ifc.wasm', 'public/vendor/web-ifc.wasm');
await cp('node_modules/occt-import-js/dist', 'public/vendor/occt', { recursive: true });
await copyFile('src/cad.worker.js', 'public/vendor/cad-worker.js');
await cp('node_modules/three/examples/jsm/libs/draco', 'public/vendor/draco', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vendor/mediapipe/wasm', { recursive: true });
await mkdir('public/licenses', { recursive: true });
for (const [name, file] of [['three','LICENSE'],['web-ifc','LICENSE.md'],['occt-import-js','LICENSE.md'],['dicom-parser','LICENSE'],['@sparkjsdev/spark','LICENSE']]) {
  await copyFile(`node_modules/${name}/${file}`, `public/licenses/${name.replaceAll('/','-')}.txt`);
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('public/licenses/versions.json', JSON.stringify(pkg.dependencies, null, 2));
console.log('Offline-Importer und Lizenztexte bereit.');
