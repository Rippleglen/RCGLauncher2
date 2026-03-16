import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { registerAuthHandlers } from './ipc/auth'
import { registerGameHandlers } from './ipc/game'
import { registerConfigHandlers } from './ipc/config'

export const appDataPath = join(app.getPath('appData'), '.RCGLauncher2')

let mainWindow

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

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
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open DevTools in dev mode so we can see errors
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.ripple-co.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Window controls (no dependency on mainWindow reference — uses event sender)
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // Updater — pull-based so renderer can await it with no timing race
  ipcMain.handle('updater:check', () => {
    return new Promise((resolve) => {
      if (is.dev) return resolve({ status: 'dev' })

      autoUpdater.on('update-not-available', () => resolve({ status: 'up-to-date' }))
      autoUpdater.on('error', () => resolve({ status: 'error' }))
      autoUpdater.on('update-downloaded', () => {
        mainWindow?.webContents.send('updater:status', { text: 'Update ready — restarting...', progress: 100 })
        setTimeout(() => autoUpdater.quitAndInstall(), 1500)
        resolve({ status: 'restarting' })
      })

      autoUpdater.on('checking-for-update', () => {
        mainWindow?.webContents.send('updater:status', { text: 'Checking for updates...', progress: 10 })
      })
      autoUpdater.on('update-available', () => {
        mainWindow?.webContents.send('updater:status', { text: 'Downloading update...', progress: 30 })
      })
      autoUpdater.on('download-progress', (p) => {
        mainWindow?.webContents.send('updater:status', {
          text: `Downloading update... ${Math.round(p.percent)}%`,
          progress: 30 + Math.round(p.percent * 0.6)
        })
      })

      autoUpdater.checkForUpdates()
    })
  })

  // Create the window, THEN register handlers that need the window reference
  createWindow()

  registerAuthHandlers(mainWindow, appDataPath)
  registerGameHandlers(mainWindow, appDataPath)
  registerConfigHandlers(appDataPath)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
