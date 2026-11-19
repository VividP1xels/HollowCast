'use strict';
// HOLLOWCAST desktop shell (Electron). The editor itself is the same web app.
const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, Menu } = require('electron');
const path = require('path');

let chosenSourceId = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#090a09',
    title: 'HOLLOWCAST',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // Open external links in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
  });

  // Game / screen capture: the renderer lists windows, the user picks one, then
  // getDisplayMedia() lands here and we hand back that window (plus system audio on Windows).
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    const pick = sources.find(s => s.id === chosenSourceId) || sources.find(s => s.id.startsWith('screen')) || sources[0];
    const streams = { video: pick };
    if (process.platform === 'win32') streams.audio = 'loopback';
    callback(streams);
  });

  ipcMain.handle('hc:list-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources
      .filter(s => s.name !== 'HOLLOWCAST')
      .map(s => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
  });
  ipcMain.handle('hc:choose-source', (event, id) => { chosenSourceId = String(id); });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
