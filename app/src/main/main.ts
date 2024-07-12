import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { PYTHON_EXECUTABLE_PATH } from '../../globals.ts';
import psTree from 'ps-tree';
import find from 'find-process';
import { promisify } from 'util';

// Initialize the logger
log.transports.file.level = 'info';
log.transports.console.level = 'debug'; // Ensure logs are also shown in the console
log.transports.file.resolvePath = () => (app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '../../resources')) + "/debug.log";

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

const checkPort = (host: string, port: number, retries: number = 5, timeout: number = 1000): Promise<boolean> => {
  return new Promise((resolve) => {
    const tryConnect = (attempt: number) => {
      if (attempt > retries) {
        resolve(false);
        return;
      }
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.once('error', () => {
        socket.destroy();
        setTimeout(() => tryConnect(attempt + 1), 200);
      });
      socket.once('timeout', () => {
        socket.destroy();
        setTimeout(() => tryConnect(attempt + 1), 200);
      });
      socket.connect(port, host, () => {
        socket.end();
        resolve(true);
      });
    };
    tryConnect(1);
  });
};

const killProcessTree = promisify((pid: number, signal: string | number, callback: (err?: Error) => void) => {
  psTree(pid, (err, children) => {
    if (err) {
      return callback(err);
    }
    [pid, ...children.map(p => p.PID)].forEach(tpid => {
      try {
        process.kill(tpid, signal);
      } catch (e) {
        log.error(`Failed to kill process ${tpid}: ${e.message}`);
      }
    });
    callback();
  });
});

const killOllamaServer = async () => {
  if (ollamaServer) {
    log.info('Killing existing Ollama server process and its children...');
    const pid = ollamaServer.pid;
    ollamaServer.kill();
    ollamaServer = null;
    await killProcessTree(pid, 'SIGTERM');
  }

  try {
    log.info('Finding llamaServers...');
    const llamaServers = await find('name', 'ollama_llama_server.exe');
    log.info('llamaServers:', llamaServers);
    for (const server of llamaServers) {
      try {
        process.kill(server.pid, 'SIGTERM');
        log.info(`Killed ollama_llama_server.exe process with PID: ${server.pid}`);
      } catch (error) {
        log.error(`Failed to kill ollama_llama_server.exe process with PID ${server.pid}: ${error.message}`);
      }
    }
  } catch (error) {
    log.error('Error finding ollama_llama_server.exe processes:', error);
  }
};

const startOllamaServer = async () => {
  const defaultHost = '127.0.0.1';
  const defaultPort = 11434;
  const ollamaHost = process.env.OLLAMA_HOST || defaultHost;
  const [host, portString] = ollamaHost.split(':');
  const port = portString ? parseInt(portString, 10) : defaultPort;

  const isRunning = await checkPort(host, port);

  if (isRunning) {
    log.info(`Ollama server is already running on ${host}:${port}`);
  } else {
    await killOllamaServer();
    log.info('Starting Ollama server...');
    const ollamaPath = 'ollama';
    ollamaServer = spawn(ollamaPath, ['serve']);

    ollamaServer.stdout.on('data', (data) => {
      log.info(`Ollama stdout: ${data}`);
    });

    ollamaServer.stderr.on('data', (data) => {
      log.error(`Ollama stderr: ${data}`);
    });

    ollamaServer.on('close', (code) => {
      log.info(`Ollama server exited with code ${code}`);
      ollamaServer = null;
    });
  }
};

ipcMain.handle('open-file', async (_, filePath, direct) => {
  log.info("Received request to open file location:", filePath, "Direct:", direct);

  try {
    if (!fs.existsSync(filePath)) {
      log.info("Directory does not exist. Creating directory:", filePath);
      fs.mkdirSync(filePath, { recursive: true });
    }

    let command;

    if (direct) {
      command = `explorer.exe "${filePath}"`;
    } else {
      const directory = path.dirname(filePath);
      command = `explorer.exe /select,"${filePath}"`;
    }

    const child = spawn(command, { shell: true });

    child.on('error', (error) => {
      log.error("Failed to open file location with error:", error);
    });

    child.on('exit', (code) => {
      log.info("Child process exited with code:", code);
    });

    return { success: true };
  } catch (error) {
    log.error("Error opening file location:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-image', async (event, imagePath) => {
  try {
    const imageData = fs.readFileSync(imagePath);
    const base64Data = imageData.toString('base64');
    return `data:image/jpeg;base64,${base64Data}`;
  } catch (error) {
    log.error('Failed to load image:', error);
    throw error;
  }
});

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
    log.error("Error reading directory:", error);
    throw error;
  }
});

ipcMain.on('update-progress', (event, progress) => {
  if (mainWindow) {
    mainWindow.setProgressBar(progress);
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
    .catch(log.error);
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
    height: 910,
    minWidth: 1500,
    minHeight: 910,
    resizable: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

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

  const folderPathArg = process.argv.find(arg => arg.startsWith('--folderPath='));
  if (folderPathArg) {
    const folderPath = folderPathArg.split('=')[1];
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('open-folder', folderPath);
    });
  }

  const pythonPath = app.isPackaged ? path.join(process.resourcesPath, 'resources', 'python', 'Scripts', 'python.exe') : PYTHON_EXECUTABLE_PATH;

  const serverScript = path.join(app.isPackaged ? process.resourcesPath : '.', 'resources', 'server', 'server.py');

  fastApiServer = spawn(pythonPath, [serverScript]);

  fastApiServer.stdout.on('data', (data) => {
    log.info(`FastAPI stdout: ${data}`);
  });

  fastApiServer.stderr.on('data', (data) => {
    log.error(`FastAPI stderr: ${data}`);
  });

  fastApiServer.on('close', (code) => {
    log.info(`FastAPI server exited with code ${code}`);
  });

  await startOllamaServer();

  new AppUpdater();
};

app.on('window-all-closed', async () => {
  await killOllamaServer();
  if (fastApiServer) {
    log.info('Killing FastAPI server...');
    fastApiServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
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
  .catch(log.error);
