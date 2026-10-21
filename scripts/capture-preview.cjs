/*
 * Visual smoke test for the local Browser/Electron view. It deliberately
 * captures only the built-in demo; no museum or partner material is loaded.
 */
const { app, BrowserWindow } = require('electron');
const { once } = require('node:events');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const output = path.resolve(process.argv[2] || 'artifacts/browseye-preview.png');

async function main() {
  // Run the production bundle on an isolated random local port.
  process.env.PORT = '0';
  const { server } = await import(pathToFileURL(path.join(__dirname, '..', 'server.mjs')).href);
  if (!server.listening) await once(server, 'listening');
  const port = server.address().port;
  let window;
  try {
    await app.whenReady();
    window = new BrowserWindow({
      show: false,
      width: 1920,
      height: 1200,
      backgroundColor: '#10191e',
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    await window.loadURL(`http://127.0.0.1:${port}/`);
    await new Promise(resolve => setTimeout(resolve, 900));
    const image = await window.webContents.capturePage();
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, image.toPNG());
    console.log(`Vorschau gespeichert: ${output}`);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await new Promise(resolve => server.close(resolve));
    app.quit();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  app.exitCode = 1;
  app.quit();
});
