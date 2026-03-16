import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import FormData from 'form-data'

const API_BASE = 'https://minecraft.eggonomicsgame.com'

export function registerAdminHandlers() {
  // Validate the admin key against the backend
  ipcMain.handle('admin:validateKey', async (_, key) => {
    const res = await fetch(`${API_BASE}/admin/ping`, {
      headers: { 'X-Admin-Key': key }
    })
    return res.ok
  })

  // Create or update modpack metadata
  ipcMain.handle('admin:saveModpack', async (_, key, meta, isNew) => {
    const url = isNew
      ? `${API_BASE}/admin/modpacks`
      : `${API_BASE}/admin/modpacks/${encodeURIComponent(meta.name)}`

    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
      body: JSON.stringify(meta),
    })
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  })

  // Open a file picker and return the selected path
  ipcMain.handle('admin:pickFile', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select modpack ZIP',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    if (canceled) return null
    return filePaths[0]
  })

  // Upload a zip file to the backend for a given modpack
  ipcMain.handle('admin:pushFiles', async (_, key, modpackName, filePath) => {
    const fileBuffer = readFileSync(filePath)

    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
          'X-Admin-Key': key,
        },
        body: fileBuffer,
      }
    )
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  })

  // Delete a modpack
  ipcMain.handle('admin:deleteModpack', async (_, key, modpackName) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}`,
      { method: 'DELETE', headers: { 'X-Admin-Key': key } }
    )
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  })

  // Regenerate the manifest (useful after manually editing files on the server)
  ipcMain.handle('admin:regenerateManifest', async (_, key, modpackName) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/regenerate`,
      { method: 'POST', headers: { 'X-Admin-Key': key } }
    )
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  })
}
