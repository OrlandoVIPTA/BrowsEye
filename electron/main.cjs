/*
 * BrowsEye Player desktop shell.
 *
 * This file deliberately contains no model-import code. The renderer stays the
 * same audited local BrowsEye application that also runs in a browser. Electron
 * only supplies a controlled Chromium version, an app window, and kiosk mode.
 */
const { app, BrowserWindow, ipcMain, session } = require('electron');
const http = require('node:http');
const { createReadStream, existsSync } = require('node:fs');
const { stat } = require('node:fs/promises');
const path = require('node:path');

const kiosk = process.argv.includes('--kiosk');
const presentation = process.argv.includes('--presentation') || kiosk;
// A stable local origin preserves the operator's stereo calibration and other
// local player choices across restarts. It remains loopback-only.
const requestedPort = Number(process.env.BROWSEYE_PORT || 49377);
let server;

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
      const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        response.writeHead(403); response.end(); return;
      }
      const details = await stat(file);
      if (!details.isFile()) throw new Error('not a file');
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': details.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: mediastream:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      });
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
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
  ipcMain.handle('browseye:fullscreen', (event, enabled) => event.sender.getOwnerBrowserWindow()?.setFullScreen(Boolean(enabled)));
  ipcMain.handle('browseye:quit-kiosk', () => { if (kiosk) app.quit(); });
  createWindow(port);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (server) server.close(); });
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(server.address().port); });
