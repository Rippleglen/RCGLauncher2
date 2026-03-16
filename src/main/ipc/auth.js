import { ipcMain } from 'electron'
import { setupMicrosoftAuth, getValidAuthData, clearAuthData } from '../services/microsoftAuth'

export function registerAuthHandlers(mainWindow, appDataPath) {
  ipcMain.handle('auth:login', async () => {
    return await setupMicrosoftAuth(mainWindow, appDataPath)
  })

  ipcMain.handle('auth:getUser', async () => {
    return await getValidAuthData(appDataPath)
  })

  ipcMain.handle('auth:logout', async () => {
    await clearAuthData(appDataPath)
  })
}
