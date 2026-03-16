import { BrowserWindow, ipcMain, app, shell } from "electron";
import { join, relative } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import updaterPkg from "electron-updater";
import axios from "axios";
import { stringify } from "querystring";
import { existsSync, writeFileSync, readFileSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { randomBytes, createDecipheriv, createCipheriv, createHash } from "crypto";
import keytar from "keytar";
import os, { tmpdir } from "os";
import { Client } from "minecraft-launcher-core";
import { mkdir, readdir, rename, rm, unlink } from "fs/promises";
import extract from "extract-zip";
import EventEmitter from "events";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const AZURE_CLIENT_ID = "4da45d88-11be-47e7-8ea7-f3b7023b9302";
const REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const KEYTAR_SERVICE = "RCGLauncher2";
const KEYTAR_ACCOUNT = "EncryptionKey";
async function getEncryptionKey() {
  let key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  if (!key) {
    key = randomBytes(32).toString("hex");
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key);
  }
  return Buffer.from(key, "hex");
}
async function encrypt(data, key) {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}
function decrypt(data, key) {
  const [ivHex, encrypted] = data.split(":");
  const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}
async function saveAuthData(data, appDataPath2) {
  const key = await getEncryptionKey();
  const encrypted = await encrypt(data, key);
  mkdirSync(appDataPath2, { recursive: true });
  writeFileSync(join(appDataPath2, "auth.json"), encrypted);
}
async function loadAuthData(appDataPath2) {
  const authFile = join(appDataPath2, "auth.json");
  if (!existsSync(authFile)) return null;
  const key = await getEncryptionKey();
  return decrypt(readFileSync(authFile, "utf-8"), key);
}
async function clearAuthData(appDataPath2) {
  const authFile = join(appDataPath2, "auth.json");
  if (existsSync(authFile)) {
    writeFileSync(authFile, "");
  }
}
async function getAccessToken(code) {
  const res = await axios.post(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    stringify({
      client_id: AZURE_CLIENT_ID,
      scope: "XboxLive.signin offline_access",
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code"
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
}
async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    stringify({
      client_id: AZURE_CLIENT_ID,
      scope: "XboxLive.signin offline_access",
      refresh_token: refreshToken,
      redirect_uri: REDIRECT_URI,
      grant_type: "refresh_token"
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
}
async function getXBLToken(accessToken) {
  const res = await axios.post("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${accessToken}` },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT"
  });
  return res.data;
}
async function getXSTSToken(xblToken) {
  const res = await axios.post("https://xsts.auth.xboxlive.com/xsts/authorize", {
    Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT"
  });
  return res.data;
}
async function getMinecraftToken(uhs, xstsToken) {
  const res = await axios.post("https://api.minecraftservices.com/authentication/login_with_xbox", {
    identityToken: `XBL3.0 x=${uhs};${xstsToken}`
  });
  return res.data;
}
async function getMinecraftProfile(accessToken) {
  const res = await axios.get("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data;
}
async function buildMinecraftAuthFromMsToken(msAccessToken, msRefreshToken) {
  const expiresAt = Date.now() + msAccessToken.expires_in * 1e3;
  const xbl = await getXBLToken(msAccessToken.access_token);
  const xsts = await getXSTSToken(xbl.Token);
  const mc = await getMinecraftToken(xbl.DisplayClaims.xui[0].uhs, xsts.Token);
  const profile = await getMinecraftProfile(mc.access_token);
  return {
    access_token: mc.access_token,
    refresh_token: msRefreshToken ?? msAccessToken.refresh_token,
    expires_at: expiresAt,
    uuid: profile.id,
    name: profile.name,
    user_properties: "{}"
  };
}
async function ensureValidAccessToken(authData, appDataPath2) {
  if (Date.now() < authData.expires_at) return authData;
  const refreshed = await refreshAccessToken(authData.refresh_token);
  const updated = await buildMinecraftAuthFromMsToken(refreshed, refreshed.refresh_token);
  updated.name = updated.name ?? authData.name;
  updated.uuid = updated.uuid ?? authData.uuid;
  await saveAuthData(updated, appDataPath2);
  return updated;
}
async function setupMicrosoftAuth(mainWindow2, appDataPath2) {
  const authWindow = new BrowserWindow({
    width: 500,
    height: 650,
    parent: mainWindow2,
    modal: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  const authUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?" + stringify({
    client_id: AZURE_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: "XboxLive.signin offline_access"
  });
  authWindow.loadURL(authUrl);
  return new Promise((resolve, reject) => {
    let handled = false;
    const handle = async (url) => {
      if (handled || !url.startsWith(REDIRECT_URI)) return;
      handled = true;
      authWindow.close();
      const code = new URLSearchParams(new URL(url).search).get("code");
      if (!code) return reject(new Error("No auth code in redirect"));
      try {
        const tokens = await getAccessToken(code);
        const authData = await buildMinecraftAuthFromMsToken(tokens);
        await saveAuthData(authData, appDataPath2);
        resolve(authData);
      } catch (err) {
        reject(err);
      }
    };
    authWindow.webContents.on("will-navigate", (_, url) => handle(url));
    authWindow.webContents.on("will-redirect", (_, url) => handle(url));
    authWindow.on("closed", () => {
      if (!handled) reject(new Error("Login window closed"));
    });
  });
}
async function getValidAuthData(appDataPath2) {
  const authData = await loadAuthData(appDataPath2);
  if (!authData) throw new Error("No auth data found");
  return await ensureValidAccessToken(authData, appDataPath2);
}
function registerAuthHandlers(mainWindow2, appDataPath2) {
  ipcMain.handle("auth:login", async () => {
    return await setupMicrosoftAuth(mainWindow2, appDataPath2);
  });
  ipcMain.handle("auth:getUser", async () => {
    return await getValidAuthData(appDataPath2);
  });
  ipcMain.handle("auth:logout", async () => {
    await clearAuthData(appDataPath2);
  });
}
async function getRequiredJavaMajorVersion(minecraftVersion) {
  const manifest = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
  const { versions } = await manifest.json();
  const entry = versions.find((v) => v.id === minecraftVersion);
  if (!entry) throw new Error(`Minecraft version ${minecraftVersion} not found in Mojang manifest`);
  const versionJson = await fetch(entry.url);
  const data = await versionJson.json();
  return data.javaVersion?.majorVersion ?? 17;
}
async function fetchAdoptiumDownloadUrl(majorVersion) {
  const res = await fetch(`https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot`);
  const data = await res.json();
  const asset = data.find((a) => a.binary.os === "windows" && a.binary.image_type === "jre");
  if (!asset) throw new Error(`No Windows JRE found for Java ${majorVersion} on Adoptium`);
  return asset.binary.package.link;
}
async function downloadFile(url, destPath, onProgress) {
  const res = await axios.get(url, {
    responseType: "stream",
    onDownloadProgress: (e) => {
      if (e.total) onProgress?.(Math.round(e.loaded / e.total * 100));
    }
  });
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(destPath);
    res.data.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
async function installJava(majorVersion, javaDir, onStatus) {
  const finalPath = join(javaDir, `java${majorVersion}`);
  const zipPath = join(tmpdir(), `java${majorVersion}-${Date.now()}.zip`);
  const tempPath = join(tmpdir(), `java${majorVersion}-temp`);
  onStatus?.(`Downloading Java ${majorVersion}...`);
  await mkdir(javaDir, { recursive: true });
  const downloadUrl = await fetchAdoptiumDownloadUrl(majorVersion);
  await downloadFile(downloadUrl, zipPath, (pct) => {
    onStatus?.(`Downloading Java ${majorVersion}... ${pct}%`);
  });
  onStatus?.(`Extracting Java ${majorVersion}...`);
  await extract(zipPath, { dir: tempPath });
  const [innerFolder] = await readdir(tempPath);
  const innerPath = join(tempPath, innerFolder);
  await mkdir(finalPath, { recursive: true });
  const items = await readdir(innerPath);
  for (const item of items) {
    await rename(join(innerPath, item), join(finalPath, item));
  }
  await rm(tempPath, { recursive: true, force: true });
  await unlink(zipPath).catch(() => {
  });
  onStatus?.(`Java ${majorVersion} installed`);
  return finalPath;
}
async function getOrDownloadJava(minecraftVersion, appDataPath2, onStatus) {
  const javaDir = join(appDataPath2, "launcher", "java");
  const majorVersion = await getRequiredJavaMajorVersion(minecraftVersion);
  const javaPath = join(javaDir, `java${majorVersion}`, "bin", "javaw.exe");
  if (!existsSync(javaPath)) {
    await installJava(majorVersion, javaDir, onStatus);
  }
  return javaPath;
}
const eventEmitter = new EventEmitter();
const API_BASE = "https://launcherapi.ripple-co.io";
const MANAGED_DIRS = ["mods", "config", "resourcepacks", "shaderpacks", "ffmpeg"];
function hashFile(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}
async function getLocalFiles(instancePath) {
  const files = {};
  for (const dir of MANAGED_DIRS) {
    files[dir] = {};
    const fullPath = join(instancePath, dir);
    if (!existsSync(fullPath)) continue;
    const walk = async (current) => {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const abs = join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else {
          files[dir][relative(fullPath, abs)] = hashFile(abs);
        }
      }
    };
    await walk(fullPath);
  }
  return files;
}
async function downloadChunked(packageId, destPath) {
  const infoRes = await fetch(`${API_BASE}/download/${packageId}/info`);
  if (!infoRes.ok) throw new Error("Failed to get package info");
  const { totalChunks } = await infoRes.json();
  const stream = createWriteStream(destPath);
  for (let i = 0; i < totalChunks; i++) {
    const res = await fetch(`${API_BASE}/download/${packageId}/chunk/${i}`);
    if (!res.ok) throw new Error(`Failed to download chunk ${i}`);
    const buf = await res.arrayBuffer();
    await new Promise((resolve, reject) => {
      stream.write(Buffer.from(buf), (err) => {
        if (err) return reject(err);
        eventEmitter.emit("progress", {
          progress: Math.round((i + 1) / totalChunks * 100),
          text: `Downloading files... ${i + 1}/${totalChunks}`
        });
        resolve();
      });
    });
  }
  await new Promise((resolve, reject) => {
    stream.end((err) => err ? reject(err) : resolve());
  });
}
async function syncModpackFiles(modpack, instancePath) {
  await mkdir(instancePath, { recursive: true });
  const clientFiles = await getLocalFiles(instancePath);
  const checkRes = await fetch(`${API_BASE}/mods/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modpack: modpack.name, clientFiles })
  });
  if (!checkRes.ok) throw new Error(`Check failed: ${checkRes.statusText}`);
  const { needsUpdate, changes } = await checkRes.json();
  if (!needsUpdate) {
    eventEmitter.emit("status", { text: "Modpack is up to date" });
    return;
  }
  const prepRes = await fetch(`${API_BASE}/mods/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modpack: modpack.name, changes })
  });
  if (!prepRes.ok) throw new Error("Failed to prepare package");
  const { packageId } = await prepRes.json();
  const tempZip = join(tmpdir(), `modpack-${Date.now()}.zip`);
  try {
    eventEmitter.emit("status", { text: "Downloading updates..." });
    await downloadChunked(packageId, tempZip);
    eventEmitter.emit("status", { text: "Extracting..." });
    await extract(tempZip, { dir: instancePath });
    await fetch(`${API_BASE}/mods/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId })
    });
    eventEmitter.emit("status", { text: "Sync complete" });
  } finally {
    if (existsSync(tempZip)) unlinkSync(tempZip);
  }
}
const MODPACKS_URL = "https://cdn.ripple-co.io/rcg2/jsons/modpacks.json";
function registerGameHandlers(mainWindow2, appDataPath2) {
  function send(channel, data) {
    mainWindow2?.webContents.send(channel, data);
  }
  ipcMain.handle("game:fetchModpacks", async () => {
    const res = await fetch(MODPACKS_URL);
    if (!res.ok) throw new Error("Failed to fetch modpacks");
    return await res.json();
  });
  ipcMain.handle("game:launch", async (_, modpack) => {
    const instancePath = join(appDataPath2, "instances", modpack.name);
    eventEmitter.on("progress", (data) => send("game:progress", data));
    eventEmitter.on("status", (data) => send("game:status", data));
    send("game:status", { text: "Checking Java...", stage: "java" });
    const javaPath = await getOrDownloadJava(modpack.version, appDataPath2, (status) => {
      send("game:status", { text: status, stage: "java" });
    });
    send("game:status", { text: "Syncing modpack files...", stage: "sync" });
    await syncModpackFiles(modpack, instancePath);
    const configPath = join(appDataPath2, "config.json");
    const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
    const jvmArgsPath = join(appDataPath2, "launcher", `${modpack.name}jvmargs.json`);
    const extraJvmArgs = existsSync(jvmArgsPath) ? JSON.parse(readFileSync(jvmArgsPath, "utf8")) : [];
    const authData = await getValidAuthData(appDataPath2);
    const memoryGB = config.memoryMode === "manual" ? config.memoryGB ?? 8 : Math.min(16, Math.max(4, Math.floor(os.totalmem() / 1024 ** 3 / 2)));
    send("game:status", { text: "Launching...", stage: "launch" });
    const launcher = new Client();
    launcher.on("data", (data) => send("game:log", { data }));
    launcher.on("progress", (data) => send("game:progress", data));
    launcher.on("close", (code) => send("game:closed", { code }));
    const opts = {
      authorization: authData,
      root: instancePath,
      version: {
        number: modpack.version,
        type: "release",
        ...modpack.loaderVersion ? { custom: modpack.loaderVersion } : {}
      },
      javaPath,
      memory: { max: `${memoryGB}G`, min: "2G" },
      overrides: {
        detached: true
      }
    };
    if (modpack.neoforgeInstaller) {
      opts.forge = join(instancePath, modpack.neoforgeInstaller);
    }
    if (extraJvmArgs.length) {
      opts.customArgs = extraJvmArgs;
    }
    launcher.launch(opts);
    send("game:status", { text: "Game launched!", stage: "running" });
    eventEmitter.removeAllListeners("progress");
    eventEmitter.removeAllListeners("status");
  });
}
function registerConfigHandlers(appDataPath2) {
  const configPath = join(appDataPath2, "config.json");
  function readConfig() {
    if (!existsSync(configPath)) return {};
    try {
      return JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      return {};
    }
  }
  function writeConfig(data) {
    mkdirSync(appDataPath2, { recursive: true });
    writeFileSync(configPath, JSON.stringify(data, null, 2));
  }
  ipcMain.handle("config:get", () => readConfig());
  ipcMain.handle("config:set", (_, updates) => {
    const current = readConfig();
    writeConfig({ ...current, ...updates });
  });
  ipcMain.handle("config:getSystemRam", () => {
    const totalBytes = os.totalmem();
    const totalGB = totalBytes / 1024 ** 3;
    return Math.min(16, Math.max(4, Math.floor(totalGB / 2)));
  });
  ipcMain.handle("config:getVersion", () => {
    return app.getVersion();
  });
  ipcMain.handle("config:getJvmArgs", (_, modpackName) => {
    const argsPath = join(appDataPath2, "launcher", `${modpackName}jvmargs.json`);
    if (!existsSync(argsPath)) return [];
    try {
      return JSON.parse(readFileSync(argsPath, "utf8"));
    } catch {
      return [];
    }
  });
  ipcMain.handle("config:setJvmArgs", (_, modpackName, args) => {
    const launcherDir = join(appDataPath2, "launcher");
    mkdirSync(launcherDir, { recursive: true });
    const argsPath = join(launcherDir, `${modpackName}jvmargs.json`);
    writeFileSync(argsPath, JSON.stringify(args, null, 2));
  });
}
const { autoUpdater } = updaterPkg;
const appDataPath = join(app.getPath("appData"), ".RCGLauncher2");
let mainWindow;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
function createWindow() {
  mainWindow = new BrowserWindow({
    minWidth: 1470,
    minHeight: 750,
    width: 1470,
    height: 850,
    resizable: true,
    center: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(() => {
  electronApp.setAppUserModelId("io.ripple-co.launcher");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  ipcMain.on("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on("window:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("updater:check", () => {
    return new Promise((resolve) => {
      if (is.dev) return resolve({ status: "dev" });
      autoUpdater.on("update-not-available", () => resolve({ status: "up-to-date" }));
      autoUpdater.on("error", () => resolve({ status: "error" }));
      autoUpdater.on("update-downloaded", () => {
        mainWindow?.webContents.send("updater:status", { text: "Update ready — restarting...", progress: 100 });
        setTimeout(() => autoUpdater.quitAndInstall(), 1500);
        resolve({ status: "restarting" });
      });
      autoUpdater.on("checking-for-update", () => {
        mainWindow?.webContents.send("updater:status", { text: "Checking for updates...", progress: 10 });
      });
      autoUpdater.on("update-available", () => {
        mainWindow?.webContents.send("updater:status", { text: "Downloading update...", progress: 30 });
      });
      autoUpdater.on("download-progress", (p) => {
        mainWindow?.webContents.send("updater:status", {
          text: `Downloading update... ${Math.round(p.percent)}%`,
          progress: 30 + Math.round(p.percent * 0.6)
        });
      });
      autoUpdater.checkForUpdates();
    });
  });
  createWindow();
  registerAuthHandlers(mainWindow, appDataPath);
  registerGameHandlers(mainWindow, appDataPath);
  registerConfigHandlers(appDataPath);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
export {
  appDataPath
};
