// main.js
require('ejs-electron');

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { setupMicrosoftAuth, getValidAuthData } = require('./auth/microsoftAuth');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { downloadJava } = require('./components/javaDwnld');
const { getJavaVersionForMinecraft, getJavaPathForMinecraftVersion } = require('./components/javaVersionParser');
const { Client } = require('minecraft-launcher-core');
const configPath = path.join(app.getPath('appData'), '.RCGLauncher2', 'config.json');
const appDataPath = path.join(app.getPath('appData'), '.RCGLauncher2');
const MODPACKS_URL = 'https://cdn.andreasrp.com/rcg2/jsons/modpacks.json'; // Server location of modpacks.json
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { spawn } = require('child_process');
const os = require('os');
const { fetchMetadata, synchronizeFiles } = require('./components/metadataSync');
const RSSParser = require('rss-parser');
const rssParser = new RSSParser();
const RSS_URL = 'https://snuggledtogetherblog.wordpress.com/feed/'
const { autoUpdater, AppUpdater } = require("electron-updater")
const oldLauncherFolder = path.join(app.getPath('appData'), '.rcglauncher');
const packageJson = require('./package.json');
const { exec } = require('child_process');


let mainWindow;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Create a Trusted Types policy in your main JavaScript file or the entry point



// if (process.platform === 'win32' && !process.argv.includes('--elevated')) {
//   exec(`powershell -Command "Start-Process '${process.execPath}' -ArgumentList '${process.argv.slice(1).join(' ')} --elevated' -Verb RunAs"`, (error) => {
//     if (error) {
//       console.error('Failed to run as admin:', error);
//       app.quit();
//     } else {
//       app.quit(); // Exit the non-admin instance
//     }
//   });
// } else {
//   app.whenReady().then(createWindow);
// }

async function createWindow() {
  mainWindow = new BrowserWindow({
    minWidth: 1470,
    minHeight: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInSubFrames: true,
    },
    resizable: true
  });

  mainWindow.setMenuBarVisibility(false);
  setupUpdateHandlers();

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-version', packageJson.version);
  });

  try {
    // Attempt to get valid authentication data
    const authData = await getValidAuthData(appDataPath);

    // If successful, load the landing page
    mainWindow.loadFile('views/landing.ejs');
    
  } catch (error) {
    console.error('Authentication error:', error.message);

    // If there's an error (e.g., no auth data), load the welcome/login page
    mainWindow.loadFile('views/welcome.ejs');
  }
}

function setupUpdateHandlers() {
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-ready');
  });

  // Start checking for updates
  autoUpdater.checkForUpdatesAndNotify();
}

function simulateUpdate() {
  console.log("Recieved update msg")
  setTimeout(() => {
    mainWindow.webContents.send('update-available');
  }, 2000); // Delays 2 seconds for testing
}

ipcMain.on('apply-update', () => {
  autoUpdater.quitAndInstall();
});

function checkForOldLauncherFolder() {
  if (fs.existsSync(oldLauncherFolder)) {
    mainWindow.loadFile('views/ozymandias.ejs');
  } else {
    mainWindow.loadFile('views/landing.ejs'); // or the main page of the launcher
  }
}

async function initiateJavaDownload(version) {
  try {
    await downloadJava(version);
    console.log(`Java ${version} downloaded successfully!`);
  } catch (error) {
    console.error('Error downloading Java:', error);
  }
}

// Function to send messages to the renderer process
function sendToRenderer(channel, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, message);
  }
}

app.on('web-contents-created', (event, webContents) => {
  webContents.setWindowOpenHandler(({ url }) => {
    const win = new BrowserWindow({
      width: 800,        // Set width as needed
      height: 600,       // Set height as needed
      autoHideMenuBar: true, // Hide the menu bar
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    
    win.loadURL(url); // Load the clicked URL in the new window
    return { action: 'deny' }; // Prevent default Electron behavior
  });
});

// Example of logging an error and sending it to the renderer
async function fetchModpacks() {
  console.log(`Fetching modpacks`);
  try {
    const response = await fetch(MODPACKS_URL);
    if (!response.ok) throw new Error(`Failed to fetch modpacks: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching modpacks:', error);
    sendToRenderer('log-message', `Error loading modpacks: ${error.message}`);
    return [];
  }
}

// Ensure the config file exists or create it
function ensureConfigFile() {
  try {
    const configDir = path.dirname(configPath);
    
    // Ensure that the .RCGLauncher2 directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created directory: ${configDir}`);
    }

    // Create the config file if it doesn't exist
    if (!fs.existsSync(configPath)) {
      const defaultConfig = { javaPath: null };  // Add default settings as needed
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log(`Created config file at ${configPath}`);
    }
  } catch (error) {
    console.error(`Error ensuring config file exists: ${error}`);
  }
}

function saveConfig(config) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  }
  return {};
}

app.whenReady().then(async () => {
  ensureConfigFile(); // Ensure config file exists
  await createWindow();
  setupMicrosoftAuth(mainWindow, appDataPath); // Pass appDataPath to microsoftAuth
  autoUpdater.checkForUpdates(),

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Listener to load landing.ejs when requested by welcome.js
ipcMain.on('load-landing-page', () => {
  if (mainWindow) {
    mainWindow.loadFile('views/landing.ejs');
    checkForOldLauncherFolder();
  }
});

ipcMain.handle('get-java-path', () => {
  const configPathTest = path.join(app.getPath('appData'), '.RCGLauncher2', 'config.json'); // Hardcoded for testing

  if (fs.existsSync(configPathTest)) {
    const config = JSON.parse(fs.readFileSync(configPathTest, 'utf-8'));
    return config.javaPath || null;  // Return javaPath if found, otherwise null
  }
  return null;
});

ipcMain.handle('fetch-modpacks', fetchModpacks);

ipcMain.handle('get-app-data-path', () => appDataPath);

ipcMain.handle('open-directory', async (event, directoryPath) => {
  try {
      await shell.openPath(directoryPath);
      console.log(`Opened directory: ${directoryPath}`);
  } catch (error) {
      console.error(`Failed to open directory: ${error.message}`);
  }
});

ipcMain.on('open-settings', () => {
  if (mainWindow) {
    mainWindow.loadFile('views/settings.ejs'); // Load settings.ejs in the main window
  }
});

ipcMain.on('back-to-landing', () => {
  if (mainWindow) {
    mainWindow.loadFile('views/landing.ejs'); // Load landing.ejs in the main window
  }
});

ipcMain.on('save-java-path', (event, javaPath) => {
  const config = loadConfig();
  config.javaPath = javaPath;
  saveConfig(config);
});

function findAllJavaPaths() {
  const javaPaths = [];

  // Check JAVA_HOME
  if (process.env.JAVA_HOME) {
    const javaHomePath = path.join(process.env.JAVA_HOME, 'bin', 'javaw.exe');
    if (fs.existsSync(javaHomePath)) {
      javaPaths.push(javaHomePath);
    }
  }

  // Check PATH for all Java installations
  try {
    const javaLocations = execSync('where javaw').toString().trim().split('\r\n');
    javaLocations.forEach((javaPath) => {
      if (fs.existsSync(javaPath) && !javaPaths.includes(javaPath)) {
        javaPaths.push(javaPath);
      }
    });
  } catch (error) {
    console.warn('No Java installations found in PATH.');
  }

  return javaPaths;
}

// Expose findAllJavaPaths and browseJavaPath via IPC
ipcMain.handle('get-java-paths', () => findAllJavaPaths());

ipcMain.handle('browse-java', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Java Executable', extensions: ['exe'] }],
  });
  return !canceled && filePaths.length ? filePaths[0] : null;
});

ipcMain.handle('get-system-ram', () => {
  return os.totalmem(); // Returns RAM in bytes
});

// Handle Modpack Launching
ipcMain.on('play-modpack', async (event, modpack) => { 
  try {
    const javaPath = await getOrDownloadJavaForVersion(modpack.version);
    if (javaPath) {
      launchModpack(modpack, javaPath);
    } else {
      console.error('Unable to find or download the required Java version.');
    }
  } catch (error) {
    console.error(`Error launching modpack ${modpack.name}:`, error);
  }
});


async function getOrDownloadJavaForVersion(minecraftVersion) {
  try {
    const requiredJavaVersion = await getJavaVersionForMinecraft(minecraftVersion);
    const javaPath = path.join(appDataPath, 'launcher', 'java', `java${requiredJavaVersion}`, 'bin', 'javaw.exe');

    if (!fs.existsSync(javaPath)) {
      console.log(`Java version ${requiredJavaVersion} not found. Downloading...`);
      await downloadJava(requiredJavaVersion);
    }

    return javaPath;
  } catch (error) {
    console.error(`Error retrieving Java path for Minecraft ${minecraftVersion}:`, error);
    return null;
  }
}

async function getHalfSystemRAM() {
  const totalRAM = Math.floor(os.totalmem() / (1024 ** 3)); // Convert bytes to GB
  return Math.max(4, Math.min(16, Math.floor(totalRAM / 2))) || 8; // Default to 8GB if result is 0
}

// main.js - launchModpack integration
async function launchModpack(modpack, javaPath) {
  try {
    const authData = await getValidAuthData(appDataPath);
    if (!authData) throw new Error("Auth data is missing.");

    const { memoryMode, memoryAllocation } = loadMemoryConfig();
    let memory;

    if (memoryMode === 'manual' && memoryAllocation) {
      memory = `${memoryAllocation}G`;
    } else {
      const autoMemory = await getHalfSystemRAM();
      memory = `${autoMemory}G`;
    }

    if (!memory || memory === '0G') memory = '8G'; // Default to 8GB if needed

    const instancePath = path.join(appDataPath, 'instances', modpack.name);
    if (!fs.existsSync(instancePath)) {
      fs.mkdirSync(instancePath, { recursive: true });
      console.log(`Created instance directory for modpack: ${instancePath}`);
    }

    const jvmArgsFilePath = path.join(appDataPath, 'launcher', `${modpack.name.replace(/\s+/g, '')}jvmargs.json`);
    let jvmArgsArray = [];

    if (fs.existsSync(jvmArgsFilePath)) {
      const jvmArgsData = JSON.parse(fs.readFileSync(jvmArgsFilePath, 'utf-8'));
      if (typeof jvmArgsData.jvmArgs === 'string') {
        jvmArgsArray = jvmArgsData.jvmArgs.split(' ').map(arg => arg.trim());
      } else if (Array.isArray(jvmArgsData.jvmArgs)) {
        jvmArgsArray = jvmArgsData.jvmArgs.map(arg => arg.trim());
      } else {
        console.error(`Invalid format for JVM arguments in ${jvmArgsFilePath}`);
      }
      console.log('Parsed JVM arguments:', jvmArgsArray);
    }

    let forgeInstallerPath = null;
    if (modpack.modloader && modpack.modloader.type === "neoforge") {
      forgeInstallerPath = path.join(instancePath, path.basename(modpack.modloader.url));
      if (!fs.existsSync(forgeInstallerPath)) {
        console.log(`Downloading NeoForge from ${modpack.modloader.url}`);
        await downloadModloader(modpack.modloader.url, forgeInstallerPath);
      }
    }

    const launcher = new Client();
    const options = {
      clientPackage: null,
      authorization: authData,
      root: instancePath,
      version: { number: modpack.version, type: 'release' },
      javaPath,
      memory: {
        max: memory,
        min: memory
      },
      forge: forgeInstallerPath,
      customArgs: jvmArgsArray
    };

    console.log('Launching modpack with options:', options);
    launcher.launch(options);
    launcher.on('debug', (e) => {
      console.log('[DEBUG]', e);
    });

    launcher.on('data', (e) => {
      console.log('[DATA]', e);
    });

    launcher.on('error', (e) => {
      console.error('[ERROR]', e);
    });
  } catch (error) {
    console.error(`Error launching modpack ${modpack.name}:`, error);
  }
}







async function downloadModloader(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download modloader from ${url}`);
  
  const fileStream = fs.createWriteStream(destinationPath);
  return new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

ipcMain.handle('fetch-news', async () => {
  try {
    const feed = await rssParser.parseURL(RSS_URL);
    const newsData = feed.items.map(item => ({
      title: item.title,
      link: item.link,
    }));
    return newsData;
  } catch (error) {
    console.error('Error fetching news:', error);
    sendToRenderer('log-message', 'Error fetching news:', error);
    return [];
  }
});


ipcMain.handle('apply-skin', async (event, skinUrl, mode) => {
  try {
    const appDataPath = path.join(app.getPath('appData'), '.RCGLauncher2');
    const authData = await getValidAuthData(appDataPath);
    
    if (!authData || !authData.access_token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        variant: mode,  // Use the provided mode (e.g., "classic" or "slim")
        url: skinUrl    // Use the provided URL
      })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorData = await response.json();
      return { success: false, error: errorData.errorMessage || 'Unknown error' };
    }
  } catch (error) {
    console.error('Error applying skin:', error);
    return { success: false, error: error.message };
  }
});




// main.js
ipcMain.handle('fetch-player-skin', async () => {
  try {
    const appDataPath = path.join(app.getPath('appData'), '.RCGLauncher2');
    const authData = await getValidAuthData(appDataPath);

    if (!authData || !authData.uuid) {
      throw new Error('Player UUID not found');
    }

    const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${authData.uuid}`);
    
    if (!response.ok) throw new Error(`Failed to fetch player profile: ${response.statusText}`);
    
    const profileData = await response.json();
    const properties = profileData.properties.find(prop => prop.name === 'textures');

    if (properties) {
      const decodedTextures = JSON.parse(Buffer.from(properties.value, 'base64').toString());
      const skinUrl = decodedTextures.textures.SKIN.url;
      return skinUrl;
    }

    throw new Error('No skin URL found in player profile');
  } catch (error) {
    console.error('Error fetching player skin:', error);
    return null;
  }
});



ipcMain.handle('get-auth-data', async () => {
  try {
    const authData = await getValidAuthData(appDataPath); // Ensure `appDataPath` is correct
    return authData; // Return auth data to renderer
  } catch (error) {
    console.error('Failed to load auth data:', error);
    return null;
  }
});

// Expose memory config loading and saving via IPC
ipcMain.handle('load-memory-config', () => loadMemoryConfig());
ipcMain.on('save-memory-config', (event, memoryMode, memoryAllocation) => {
  saveMemoryConfig(memoryMode, memoryAllocation);
});

function loadMemoryConfig() {
  const config = loadConfig();
  return {
    memoryMode: config.memoryMode || 'automatic',
    memoryAllocation: config.memoryAllocation || 4, // Default to 4GB if not set
  };
}

// Save memory configuration to the config file
function saveMemoryConfig(memoryMode, memoryAllocation) {
  const config = loadConfig();
  config.memoryMode = memoryMode;
  config.memoryAllocation = memoryAllocation;
  saveConfig(config);
}

ipcMain.on('remove-old-launcher-folder', async (event) => {
  const oldLauncherPath = path.join(app.getPath('appData'), '.rcglauncher');
  

  if (fs.existsSync(oldLauncherPath)) {
    try {
      // Delete the folder
      fs.rmSync(oldLauncherPath, { recursive: true, force: true });
      console.log(`Successfully removed: ${oldLauncherPath}`);
      mainWindow.loadFile('views/landing.ejs');

      // Introduce a short delay to ensure the operation is completed
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay

      // Notify the renderer process that the deletion was successful
      event.sender.send('delete-success', 'The old launcher folder has been successfully removed.');
    } catch (error) {
      console.error(`Failed to remove folder: ${error.message}`);
      event.sender.send('delete-error', `Failed to remove folder: ${error.message}`);
      mainWindow.loadFile('views/landing.ejs');
    }
  } else {
    console.warn(`Directory does not exist: ${oldLauncherPath}`);
    event.sender.send('delete-error', 'The specified folder does not exist.');
    mainWindow.loadFile('views/landing.ejs');
  }
});

ipcMain.on('keep-old-launcher-folder', () => {
  mainWindow.loadFile('views/landing.ejs'); // Load the main page if the user decides to keep it
});

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});

ipcMain.on('navigate-to-welcome', (event) => {
  const welcomePath = path.join(__dirname, 'views', 'welcome.ejs'); // Adjust path as needed
  mainWindow.loadFile(welcomePath);
});

