import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let fastApiServer: ChildProcess | null = null;
let ollamaServer: ChildProcess | null = null;

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

ipcMain.handle('read-folder-contents', async (_, folderPath: string) => {
  try {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });
    const fileDetails = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      size: file.isDirectory() ? 0 : fs.statSync(path.join(folderPath, file.name)).size,
      modified: fs.statSync(path.join(folderPath, file.name)).mtime.toLocaleString()
    }));
    return fileDetails;
  } catch (error) {
    console.error("Error reading directory:", error);
    throw error;
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1500,
    height: 520,
    minWidth: 1500,
    minHeight: 520,
    resizable: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Handle command line arguments
  const folderPathArg = process.argv.find(arg => arg.startsWith('--folderPath='));
  if (folderPathArg) {
    const folderPath = folderPathArg.split('=')[1];
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('open-folder', folderPath);
    });
  }

  // Start the FastAPI server
  const pythonPath = app.isPackaged ? path.join(process.resourcesPath, 'python', 'Scripts', 'python.exe') : './resources/python/Scripts/python.exe'; // Use system python in development

  const serverScript = path.join(app.isPackaged ? process.resourcesPath : '.', 'resources', 'server', 'server.py');

  fastApiServer = spawn(pythonPath, [serverScript]);

  fastApiServer.stdout.on('data', (data) => {
    console.log(`FastAPI stdout: ${data}`);
  });

  fastApiServer.stderr.on('data', (data) => {
    console.error(`FastAPI stderr: ${data}`);
  });

  fastApiServer.on('close', (code) => {
    console.log(`FastAPI server exited with code ${code}`);
  });

  // Start the Ollama server
  const ollamaPath = 'ollama'; // Use installed ollama in development

  ollamaServer = spawn(ollamaPath, ['serve']);

  ollamaServer.stdout.on('data', (data) => {
    console.log(`Ollama stdout: ${data}`);
  });

  ollamaServer.stderr.on('data', (data) => {
    console.error(`Ollama stderr: ${data}`);
  });

  ollamaServer.on('close', (code) => {
    console.log(`Ollama server exited with code ${code}`);
  });

  new AppUpdater();
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (fastApiServer) {
    fastApiServer.kill();
  }
  if (ollamaServer) {
    ollamaServer.kill();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
