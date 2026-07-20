const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

const APP_DIR = path.join(__dirname, 'app');
const INDEX_HTML = path.join(APP_DIR, 'index.html');

// URL do backend: variável de ambiente (dev local) > config.json (empacotado
// pelo GitHub Actions no build) > localhost (fallback pra dev).
function lerApiBaseUrl() {
  if (process.env.DASHBOARD_API_URL) return process.env.DASHBOARD_API_URL;
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
    if (config.apiBaseUrl) return config.apiBaseUrl;
  } catch {
    // sem config.json, usa o fallback
  }
  return 'http://localhost:3001';
}

const API_BASE_URL = lerApiBaseUrl();

// único canal IPC exposto — síncrono, retorna só o necessário pro preload
// montar window.desktopApp. Nada genérico (sem invoke/handle passthrough).
ipcMain.on('desktop-app:config', (event) => {
  event.returnValue = { version: app.getVersion(), apiBaseUrl: API_BASE_URL };
});

function bloquearNavegacaoExterna(win) {
  // window.open / target="_blank": abre no navegador padrão, nunca dentro do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // navegação de página inteira (ex.: <a href> sem target, location.href):
  // o SPA nunca precisa disso pra rotas internas (Angular Router usa
  // pushState), então qualquer will-navigate é link externo — manda pro
  // navegador padrão e bloqueia dentro do app.
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
  });
}

// --------------------------------------------------------------- auto-update
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// TODO: remover ao adquirir certificado de assinatura de código
autoUpdater.verifyUpdateCodeSignature = false;

function configurarAutoUpdate(win) {
  autoUpdater.on('error', (err) => {
    log.error('[auto-update] erro:', err);
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[auto-update] atualização disponível: ${info.version}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[auto-update] baixando: ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log.info(`[auto-update] atualização baixada: ${info.version}`);
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Atualização disponível',
      message: `Versão ${info.version} baixada. Reiniciar agora pra instalar?`,
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  bloquearNavegacaoExterna(win);
  win.loadFile(INDEX_HTML);
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // só checa update em build empacotado — em dev (`npm start`) não tem
  // instalador/app-update.yml gerado pelo electron-builder pra checar contra
  if (app.isPackaged) {
    configurarAutoUpdate(win);
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
