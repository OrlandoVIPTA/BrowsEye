import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
// Optional development / workstation scene library.  The browser still only
// sees the explicit /scenes route, while a multi-gigabyte package remains on
// a local SSD instead of being copied into dist or loaded as one File.
const sceneRoot = process.env.BROWSEYE_SCENE_ROOT ? path.resolve(process.env.BROWSEYE_SCENE_ROOT) : null;
const port = Number(process.env.PORT || 4174);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
if (!existsSync(path.join(root,'index.html'))) { console.error('Bitte zuerst npm run build ausführen.'); process.exit(1); }
export const server = http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const requested = decodeURIComponent(url.pathname);
    const fromSceneRoot = Boolean(sceneRoot && (requested === '/scenes' || requested.startsWith('/scenes/')));
    const servingRoot = fromSceneRoot ? sceneRoot : root;
    const localPath = fromSceneRoot ? (requested.slice('/scenes'.length) || '/') : requested;
    const file = path.resolve(servingRoot, '.' + (localPath === '/' ? '/index.html' : localPath));
    const relative = path.relative(servingRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    // Large LCC2/COPC/3D-Tiles scenes must be read in small pieces.  A browser
    // or desktop player can now ask for a byte range instead of receiving an
    // entire multi-gigabyte asset at once.
    const baseHeaders = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache', 'Content-Security-Policy':"default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*; connect-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob: https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
    if (info.size === 0) { res.writeHead(200, {...baseHeaders, 'Content-Length': 0}); res.end(); return; }
    const range = req.headers.range;
    let start = 0, end = info.size - 1, status = 200;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (!match) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
      if (!match[1] && !match[2]) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
        start = Math.max(0, info.size - suffix); end = info.size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : end;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= info.size) {
        res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return;
      }
      end = Math.min(end, info.size - 1); status = 206;
    }
    const headers = {...baseHeaders, 'Content-Length':end - start + 1};
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') res.end(); else createReadStream(file, {start, end}).on('error',()=>res.destroy()).pipe(res);
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Datei nicht gefunden'); }
});
server.on('error', err => { console.error(`BrowsEye konnte Port ${port} nicht öffnen: ${err.message}`); process.exitCode=1; });
server.listen(port, '127.0.0.1',()=>console.log(`BrowsEye by VIPTA GmbH: http://localhost:${server.address().port}`));
