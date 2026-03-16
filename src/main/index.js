import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
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
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in the system browser, not a new Electron window
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

  // Register all IPC handlers
  registerAuthHandlers(mainWindow, appDataPath)
  registerGameHandlers(mainWindow, appDataPath)
  registerConfigHandlers(appDataPath)

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  createWindow()

  // Wire up auto-updater status to the splash screen
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

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater:ready')
  })

  autoUpdater.on('error', () => {
    // Don't block launch on updater error
    mainWindow?.webContents.send('updater:ready')
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('updater:status', { text: 'Update ready — restarting...', progress: 100 })
    setTimeout(() => autoUpdater.quitAndInstall(), 1500)
  })

  autoUpdater.checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
