import { app, BrowserWindow, shell, ipcMain, screen } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import updaterPkg from 'electron-updater'
const { autoUpdater } = updaterPkg
import { registerAuthHandlers } from './ipc/auth'
import { registerGameHandlers } from './ipc/game'
import { registerConfigHandlers } from './ipc/config'
import { registerAdminHandlers } from './ipc/admin'

export const appDataPath = join(app.getPath('appData'), '.RCGLauncher2')

let mainWindow

// --- Window state persistence ---

const windowStatePath = join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try {
    if (existsSync(windowStatePath)) {
      return JSON.parse(readFileSync(windowStatePath, 'utf8'))
    }
  } catch {}
  return null
}

function isOnScreen(bounds) {
  return screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.workArea
    return (
      bounds.x >= x &&
      bounds.y >= y &&
      bounds.x + bounds.width <= x + width &&
      bounds.y + bounds.height <= y + height
    )
  })
}

function saveWindowState(win) {
  if (win.isMaximized() || win.isMinimized()) return
  writeFileSync(windowStatePath, JSON.stringify(win.getBounds()))
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function createWindow() {
  const saved = loadWindowState()
  const validSaved = saved && isOnScreen(saved)

  mainWindow = new BrowserWindow({
    minWidth: 1470,
    minHeight: 750,
    width:  validSaved ? saved.width  : 1470,
    height: validSaved ? saved.height : 850,
    x:      validSaved ? saved.x      : undefined,
    y:      validSaved ? saved.y      : undefined,
    center: !validSaved,
    resizable: true,
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

  // Save position/size on move and resize (debounced)
  let saveTimer
  const debouncedSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveWindowState(mainWindow), 500)
  }
  mainWindow.on('move', debouncedSave)
  mainWindow.on('resize', debouncedSave)
  mainWindow.on('close', () => saveWindowState(mainWindow))

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
  registerAdminHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
