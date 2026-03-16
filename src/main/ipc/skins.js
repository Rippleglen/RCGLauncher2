import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import path from 'path'
import { getValidAuthData } from '../services/microsoftAuth'

const API_BASE = 'https://minecraft.eggonomicsgame.com'

export function registerSkinHandlers(appDataPath) {
  // List all skins for a user
  ipcMain.handle('skins:list', async (_, uuid) => {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(uuid)}/skins`)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Open a PNG file picker
  ipcMain.handle('skins:pickFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select skin PNG',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      properties: ['openFile'],
    })
    return canceled ? null : filePaths[0]
  })

  // Upload a skin to the backend
  ipcMain.handle('skins:upload', async (_, { uuid, skinType, label, filePath }) => {
    const filename = path.basename(filePath)
    const fileBuffer = readFileSync(filePath)

    const formData = new FormData()
    formData.append('uuid', uuid)
    formData.append('skinType', skinType || 'classic')
    formData.append('label', label || filename.replace(/\.png$/i, ''))
    formData.append('skin', new Blob([fileBuffer], { type: 'image/png' }), filename)

    const res = await fetch(`${API_BASE}/skins/upload`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Delete a skin from the backend
  ipcMain.handle('skins:delete', async (_, { uuid, skinId }) => {
    const res = await fetch(
      `${API_BASE}/users/${encodeURIComponent(uuid)}/skins/${skinId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  // Apply a skin — downloads from our server, uploads to Mojang's skin API
  ipcMain.handle('skins:apply', async (_, { skinUrl, skinType }) => {
    const authData = await getValidAuthData(appDataPath)

    // Fetch the skin PNG from our backend
    const skinRes = await fetch(skinUrl)
    if (!skinRes.ok) throw new Error('Failed to fetch skin from server')
    const skinBuffer = Buffer.from(await skinRes.arrayBuffer())

    // Upload to Mojang
    const formData = new FormData()
    formData.append('variant', skinType === 'slim' ? 'slim' : 'classic')
    formData.append('file', new Blob([skinBuffer], { type: 'image/png' }), 'skin.png')

    const mojangRes = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authData.access_token}` },
      body: formData,
    })
    if (!mojangRes.ok) {
      const err = await mojangRes.text()
      throw new Error(`Mojang rejected the skin: ${err}`)
    }
    return { status: 'applied' }
  })
}
