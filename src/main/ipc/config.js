import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import os from 'os'

export function registerConfigHandlers(appDataPath) {
  const configPath = join(appDataPath, 'config.json')

  function readConfig() {
    if (!existsSync(configPath)) return {}
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'))
    } catch {
      return {}
    }
  }

  function writeConfig(data) {
    mkdirSync(appDataPath, { recursive: true })
    writeFileSync(configPath, JSON.stringify(data, null, 2))
  }

  ipcMain.handle('config:get', () => readConfig())

  ipcMain.handle('config:set', (_, updates) => {
    const current = readConfig()
    writeConfig({ ...current, ...updates })
  })

  ipcMain.handle('config:getSystemRam', () => {
    const totalBytes = os.totalmem()
    const totalGB = totalBytes / (1024 ** 3)
    // Half of system RAM, clamped between 4 and 16 GB
    return Math.min(16, Math.max(4, Math.floor(totalGB / 2)))
  })

  ipcMain.handle('config:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('config:getJvmArgs', (_, modpackName) => {
    const argsPath = join(appDataPath, 'launcher', `${modpackName}jvmargs.json`)
    if (!existsSync(argsPath)) return []
    try {
      return JSON.parse(readFileSync(argsPath, 'utf8'))
    } catch {
      return []
    }
  })

  ipcMain.handle('config:setJvmArgs', (_, modpackName, args) => {
    const launcherDir = join(appDataPath, 'launcher')
    mkdirSync(launcherDir, { recursive: true })
    const argsPath = join(launcherDir, `${modpackName}jvmargs.json`)
    writeFileSync(argsPath, JSON.stringify(args, null, 2))
  })
}
