import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import path from 'path'

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

  // List files for a modpack, grouped by category
  ipcMain.handle('admin:listFiles', async (_, key, modpackName) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/files`,
      { headers: { 'X-Admin-Key': key } }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Open a multi-file picker (any file type)
  ipcMain.handle('admin:pickFiles', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select files to upload',
      properties: ['openFile', 'multiSelections'],
    })
    return canceled ? [] : filePaths
  })

  // Upload a single file to a modpack category
  ipcMain.handle('admin:uploadFile', async (_, key, modpackName, category, filePath) => {
    const filename = path.basename(filePath)
    const data = readFileSync(filePath)
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/files/${category}/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Admin-Key': key },
        body: data,
      }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Delete a single file from a modpack category
  ipcMain.handle('admin:deleteFile', async (_, key, modpackName, category, filename) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/files/${category}/${encodeURIComponent(filename)}`,
      { method: 'DELETE', headers: { 'X-Admin-Key': key } }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Save tier assignments (required/suggested/optional) for a modpack's mods
  ipcMain.handle('admin:updateTiers', async (_, key, modpackName, tiers) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/tiers`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
        body: JSON.stringify(tiers),
      }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
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

  // Regenerate the manifest from files currently on the server
  ipcMain.handle('admin:regenerateManifest', async (_, key, modpackName) => {
    const res = await fetch(
      `${API_BASE}/admin/modpacks/${encodeURIComponent(modpackName)}/regenerate`,
      { method: 'POST', headers: { 'X-Admin-Key': key } }
    )
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  })
}
