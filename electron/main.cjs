/*
 * BrowsEye Player desktop shell.
 *
 * This file deliberately contains no model-import code. The renderer stays the
 * same audited local BrowsEye application that also runs in a browser. Electron
 * only supplies a controlled Chromium version, an app window, and kiosk mode.
 */
const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const http = require('node:http');
const { createReadStream, existsSync } = require('node:fs');
const { stat, readdir, readFile } = require('node:fs/promises');
const path = require('node:path');

const kiosk = process.argv.includes('--kiosk');
const presentation = process.argv.includes('--presentation') || kiosk;
// A stable local origin preserves the operator's stereo calibration and other
// local player choices across restarts. It remains loopback-only.
const requestedPort = Number(process.env.BROWSEYE_PORT || 49377);
let server;
// Each desktop-selected scene directory receives its own, opaque local URL.
// This makes its companion LOD files addressable without giving the renderer
// general disk access (or changing a running scene's source directory).
const sceneMounts = new Map();
let nextSceneMount = 0;

function externalXgridsConfigPath() {
  return path.join(app.getPath('documents'), 'BrowsEye', 'browseye-xgrids.config.json');
}

async function readExternalXgridsConfig() {
  const configPath = externalXgridsConfigPath();
  try {
    const value = JSON.parse(await readFile(configPath, 'utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Die Datei muss ein JSON-Objekt enthalten.');
    return { config: value, path: configPath, error: null };
  } catch (error) {
    if (error?.code === 'ENOENT') return { config: null, path: configPath, error: null };
    return { config: null, path: configPath, error: `XGRIDS-Konfiguration konnte nicht gelesen werden: ${error.message || error}` };
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

function assetRoot() {
  // electron-builder keeps the project app files below app.getAppPath().
  return path.join(app.getAppPath(), 'dist');
}

function sceneRequest(requested) {
  const match = /^\/scene-files\/([a-z0-9-]+)(\/.*)?$/i.exec(requested);
  if (!match) return null;
  const root = sceneMounts.get(match[1]);
  if (!root) return { denied: true };
  return { root, requested: match[2] || '/' };
}

function safeFileIn(root, requested) {
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return file;
}

async function findStreamingEntry(root) {
  // Scene packages normally place their manifest or LCC/LCC2 entry point at
  // the root. Looking there first keeps a folder selection instant even when
  // a package contains millions of streamed chunks.
  const wanted = new Set(['browseye-streaming-scene.json']);
  const lcc = new Set(['.lcc', '.lcc2']);
  const queue = [{ directory: root, relative: '' }];
  let fallback = null;
  let scanned = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const entries = await readdir(current.directory, { withFileTypes: true });
    for (const entry of entries) {
      scanned += 1;
      if (scanned > 100000) throw new Error('Der Ordner enthält sehr viele Dateien. Bitte den eigentlichen Szenenordner direkt auswählen.');
      const relative = current.relative ? `${current.relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // Do not follow symlinks. The selected package itself stays the only
        // reachable file root for the local renderer.
        queue.push({ directory: path.join(current.directory, entry.name), relative });
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (wanted.has(lower)) return relative;
      if (!fallback && lcc.has(path.extname(lower))) fallback = relative;
    }
    // A root LCC/LCC2 entry is the normal XGRIDS package layout. Do not walk
    // every chunk directory merely to look for a different nested file.
    if (!current.relative && fallback) return fallback;
  }
  return fallback;
}

function mountSceneDirectory(root) {
  const id = `scene-${++nextSceneMount}`;
  sceneMounts.set(id, root);
  // A handful of old mounts is enough for an operator who changes scenes.
  // Never evict the newest mount while a renderer could still request a LOD.
  while (sceneMounts.size > 8) sceneMounts.delete(sceneMounts.keys().next().value);
  return id;
}

function startLocalServer() {
  const root = assetRoot();
  if (!existsSync(path.join(root, 'index.html'))) {
    throw new Error('BrowsEye wurde ohne die erzeugte dist-Version gestartet. Bitte zuerst npm run build ausführen.');
  }
  server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405); response.end(); return;
      }
      const url = new URL(request.url, 'http://127.0.0.1');
      const requested = decodeURIComponent(url.pathname);
      const scene = sceneRequest(requested);
      if (scene?.denied) {
        response.writeHead(403); response.end(); return;
      }
      const file = safeFileIn(scene?.root || root, scene?.requested || requested);
      if (!file) { response.writeHead(403); response.end(); return; }
      const details = await stat(file);
      if (!details.isFile()) throw new Error('not a file');
      // Preserve byte-range reads inside the packaged Player. Streaming scene
      // adapters can keep multi-gigabyte assets on the SSD and fetch only the
      // visible LOD chunks.
      const baseHeaders = {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*; media-src 'self' blob: mediastream:; connect-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob: https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      };
      if (details.size === 0) {
        response.writeHead(200, { ...baseHeaders, 'Content-Length': 0 }); response.end(); return;
      }
      const range = request.headers.range;
      let start = 0, end = details.size - 1, status = 200;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
        if (!match) { response.writeHead(416, {'Content-Range': `bytes */${details.size}`}); response.end(); return; }
        if (!match[1] && !match[2]) { response.writeHead(416, {'Content-Range': `bytes */${details.size}`}); response.end(); return; }
        if (!match[1]) {
          const suffix = Number(match[2]);
          if (!Number.isSafeInteger(suffix) || suffix <= 0) { response.writeHead(416, {'Content-Range': `bytes */${details.size}`}); response.end(); return; }
          start = Math.max(0, details.size - suffix); end = details.size - 1;
        } else {
          start = Number(match[1]);
          end = match[2] ? Number(match[2]) : end;
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= details.size) {
          response.writeHead(416, {'Content-Range': `bytes */${details.size}`}); response.end(); return;
        }
        end = Math.min(end, details.size - 1); status = 206;
      }
      const headers = {...baseHeaders, 'Content-Length': end - start + 1};
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${details.size}`;
      response.writeHead(status, headers);
      if (request.method === 'HEAD') response.end(); else createReadStream(file, {start, end}).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Datei nicht gefunden');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function createWindow(port) {
  const mainWindow = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1024, minHeight: 700,
    title: 'BrowsEye by VIPTA GmbH',
    autoHideMenuBar: true,
    backgroundColor: '#10191e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (presentation) mainWindow.setFullScreen(true);
    if (kiosk) mainWindow.setKiosk(true);
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}/?desktop=1${kiosk ? '&kiosk=1' : ''}`);
}

app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.whenReady().then(async () => {
  // BrowsEye asks for a camera only after the operator explicitly enables the
  // local gesture control. Keep every other desktop permission denied.
  const allowLocalCamera = (webContents, permission) => permission === 'media' && webContents.getURL().startsWith('http://127.0.0.1:');
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => allowLocalCamera(webContents, permission));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(allowLocalCamera(webContents, permission)));
  const port = await startLocalServer();
  ipcMain.handle('browseye:environment', () => ({ desktop: true, kiosk, presentation, version: app.getVersion() }));
  ipcMain.handle('browseye:xgrids-config', () => readExternalXgridsConfig());
  ipcMain.handle('browseye:fullscreen', (event, enabled) => event.sender.getOwnerBrowserWindow()?.setFullScreen(Boolean(enabled)));
  ipcMain.handle('browseye:quit-kiosk', () => { if (kiosk) app.quit(); });
  ipcMain.handle('browseye:pick-streaming-scene', async event => {
    const owner = event.sender.getOwnerBrowserWindow();
    const chosen = await dialog.showOpenDialog(owner, {
      title: 'BrowsEye Streaming-Szene auswählen',
      buttonLabel: 'Szenenordner öffnen',
      properties: ['openDirectory'],
    });
    if (chosen.canceled || !chosen.filePaths[0]) return null;
    const root = path.resolve(chosen.filePaths[0]);
    const entry = await findStreamingEntry(root);
    if (!entry) throw new Error('In diesem Ordner wurde weder browseye-streaming-scene.json noch eine .lcc/.lcc2-Datei gefunden.');
    const id = mountSceneDirectory(root);
    const encoded = entry.split('/').map(encodeURIComponent).join('/');
    return { url: `/scene-files/${id}/${encoded}`, entry };
  });
  createWindow(port);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (server) server.close(); });
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(server.address().port); });
