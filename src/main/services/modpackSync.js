import { existsSync, readFileSync, createWriteStream, unlinkSync } from 'fs'
import { readdir, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import EventEmitter from 'events'
import extract from 'extract-zip'

export const eventEmitter = new EventEmitter()

const API_BASE = 'https://minecraft.eggonomicsgame.com'

const MANAGED_DIRS = ['mods', 'config', 'resourcepacks', 'shaderpacks', 'ffmpeg']

function hashFile(filePath) {
  const buf = readFileSync(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

async function getLocalFiles(instancePath) {
  const files = {}

  for (const dir of MANAGED_DIRS) {
    files[dir] = {}
    const fullPath = join(instancePath, dir)
    if (!existsSync(fullPath)) continue

    const walk = async (current) => {
      const entries = await readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const abs = join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(abs)
        } else {
          files[dir][relative(fullPath, abs)] = hashFile(abs)
        }
      }
    }

    await walk(fullPath)
  }

  return files
}

async function downloadZip(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)

  const total = Number(res.headers.get('content-length')) || 0
  let received = 0

  const stream = createWriteStream(destPath)
  const reader = res.body.getReader()

  await new Promise((resolve, reject) => {
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          stream.write(value)
          received += value.length
          if (total) {
            eventEmitter.emit('progress', {
              progress: Math.round((received / total) * 100),
              text: `Downloading updates...`,
            })
          }
        }
        stream.end(resolve)
      } catch (err) {
        stream.end()
        reject(err)
      }
    }
    pump()
  })
}

export async function syncModpackFiles(modpack, instancePath) {
  await mkdir(instancePath, { recursive: true })

  eventEmitter.emit('status', { text: 'Checking for updates...' })
  const clientFiles = await getLocalFiles(instancePath)

  const checkRes = await fetch(`${API_BASE}/sync/${encodeURIComponent(modpack.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: clientFiles }),
  })
  if (!checkRes.ok) throw new Error(`Sync check failed: ${checkRes.statusText}`)

  const { needsUpdate, downloadToken, filesToDelete } = await checkRes.json()

  if (!needsUpdate) {
    eventEmitter.emit('status', { text: 'Modpack is up to date' })
    return
  }

  // Delete files the server no longer has
  for (const rel of filesToDelete ?? []) {
    const abs = join(instancePath, rel)
    if (existsSync(abs)) unlinkSync(abs)
  }

  // Download and extract the update zip
  const tempZip = join(tmpdir(), `modpack-${Date.now()}.zip`)
  try {
    eventEmitter.emit('status', { text: 'Downloading updates...' })
    await downloadZip(
      `${API_BASE}/sync/${encodeURIComponent(modpack.name)}/download/${downloadToken}`,
      tempZip
    )

    eventEmitter.emit('status', { text: 'Extracting...' })
    await extract(tempZip, { dir: instancePath })

    eventEmitter.emit('status', { text: 'Sync complete' })
  } finally {
    if (existsSync(tempZip)) unlinkSync(tempZip)
  }
}
