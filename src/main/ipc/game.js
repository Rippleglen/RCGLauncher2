import { ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import os from 'os'
import { Client } from 'minecraft-launcher-core'
import { getOrDownloadJava } from '../services/javaManager'
import { syncModpackFiles, eventEmitter } from '../services/modpackSync'
import { getValidAuthData } from '../services/microsoftAuth'
import { ensureModloader } from '../services/modloaderInstaller'

const MODPACKS_URL = 'https://minecraft.eggonomicsgame.com/modpacks'

export function registerGameHandlers(mainWindow, appDataPath) {
  function send(channel, data) {
    mainWindow?.webContents.send(channel, data)
  }

  ipcMain.handle('game:fetchModpacks', async () => {
    const res = await fetch(MODPACKS_URL)
    if (!res.ok) throw new Error('Failed to fetch modpacks')
    return await res.json()
  })

  ipcMain.handle('game:launch', async (_, modpack) => {
    const instancePath = join(appDataPath, 'instances', modpack.name)

    eventEmitter.on('progress', (data) => send('game:progress', data))
    eventEmitter.on('status',   (data) => send('game:status', data))

    try {
      // 1. Java
      send('game:status', { text: 'Checking Java...', stage: 'java' })
      const javaPath = await getOrDownloadJava(modpack.mcVersion, appDataPath, (text) => {
        send('game:status', { text, stage: 'java' })
      })

      // 2. Modloader (Fabric/Quilt installed via API; NeoForge/Forge via installer JAR)
      send('game:status', { text: 'Checking modloader...', stage: 'java' })
      const { custom: customVersionId, forge: forgeInstaller } = await ensureModloader(
        modpack, instancePath, appDataPath,
        (text) => send('game:status', { text, stage: 'java' })
      )

      // 3. Modpack file sync
      send('game:status', { text: 'Syncing modpack files...', stage: 'sync' })
      await syncModpackFiles(modpack, instancePath)

      // 4. Read config
      const configPath   = join(appDataPath, 'config.json')
      const config       = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
      const jvmArgsPath  = join(appDataPath, 'launcher', `${modpack.name}jvmargs.json`)
      const extraJvmArgs = existsSync(jvmArgsPath) ? JSON.parse(readFileSync(jvmArgsPath, 'utf8')) : []

      // 5. Auth
      const authData = await getValidAuthData(appDataPath)

      // 6. Memory
      const memoryGB = config.memoryMode === 'manual'
        ? (config.memoryGB ?? 8)
        : Math.min(16, Math.max(4, Math.floor(os.totalmem() / (1024 ** 3) / 2)))

      // 7. Launch
      send('game:status', { text: 'Launching...', stage: 'launch' })
      const launcher = new Client()

      launcher.on('data',     (data) => send('game:log',      { data }))
      launcher.on('progress', (data) => send('game:progress', data))
      launcher.on('close',    (code) => send('game:closed',   { code }))
      launcher.on('error',    (err)  => send('game:status',   { text: `Launch error: ${err.message}`, stage: 'error' }))

      const opts = {
        authorization: authData,
        root: instancePath,
        version: {
          number: modpack.mcVersion,
          type: 'release',
          ...(customVersionId ? { custom: customVersionId } : {}),
        },
        javaPath,
        memory: { max: `${memoryGB}G`, min: '2G' },
        overrides: { detached: true },
      }

      if (forgeInstaller)    opts.forge      = forgeInstaller
      if (extraJvmArgs.length) opts.customArgs = extraJvmArgs

      await launcher.launch(opts)
      send('game:status', { text: 'Game launched!', stage: 'running' })

    } catch (err) {
      send('game:status', { text: `Error: ${err.message}`, stage: 'error' })
      throw err
    } finally {
      eventEmitter.removeAllListeners('progress')
      eventEmitter.removeAllListeners('status')
    }
  })
}
