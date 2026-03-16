import { ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import os from 'os'
import { Client } from 'minecraft-launcher-core'
import { getOrDownloadJava } from '../services/javaManager'
import { syncModpackFiles, eventEmitter } from '../services/modpackSync'
import { getValidAuthData } from '../services/microsoftAuth'

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

    // Forward sync progress to renderer
    eventEmitter.on('progress', (data) => send('game:progress', data))
    eventEmitter.on('status', (data) => send('game:status', data))

    // 1. Java
    send('game:status', { text: 'Checking Java...', stage: 'java' })
    const javaPath = await getOrDownloadJava(modpack.version, appDataPath, (status) => {
      send('game:status', { text: status, stage: 'java' })
    })

    // 2. Modpack sync
    send('game:status', { text: 'Syncing modpack files...', stage: 'sync' })
    await syncModpackFiles(modpack, instancePath)

    // 3. Read config
    const configPath = join(appDataPath, 'config.json')
    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, 'utf8'))
      : {}

    const jvmArgsPath = join(appDataPath, 'launcher', `${modpack.name}jvmargs.json`)
    const extraJvmArgs = existsSync(jvmArgsPath)
      ? JSON.parse(readFileSync(jvmArgsPath, 'utf8'))
      : []

    // 4. Auth
    const authData = await getValidAuthData(appDataPath)

    // 5. Memory
    const memoryGB = config.memoryMode === 'manual'
      ? (config.memoryGB ?? 8)
      : Math.min(16, Math.max(4, Math.floor(os.totalmem() / (1024 ** 3) / 2)))

    // 6. Launch
    send('game:status', { text: 'Launching...', stage: 'launch' })
    const launcher = new Client()

    launcher.on('data', (data) => send('game:log', { data }))
    launcher.on('progress', (data) => send('game:progress', data))
    launcher.on('close', (code) => send('game:closed', { code }))

    const opts = {
      authorization: authData,
      root: instancePath,
      version: {
        number: modpack.version,
        type: 'release',
        ...(modpack.loaderVersion ? { custom: modpack.loaderVersion } : {})
      },
      javaPath,
      memory: { max: `${memoryGB}G`, min: '2G' },
      overrides: {
        detached: true,
      }
    }

    if (modpack.neoforgeInstaller) {
      opts.forge = join(instancePath, modpack.neoforgeInstaller)
    }

    if (extraJvmArgs.length) {
      opts.customArgs = extraJvmArgs
    }

    launcher.launch(opts)
    send('game:status', { text: 'Game launched!', stage: 'running' })

    // Clean up listeners
    eventEmitter.removeAllListeners('progress')
    eventEmitter.removeAllListeners('status')
  })
}
