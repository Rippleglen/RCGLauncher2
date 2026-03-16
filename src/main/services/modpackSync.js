// Migrated from components/metadataSync.js
import { existsSync, readFileSync, createWriteStream, unlinkSync } from 'fs'
import { readdir, mkdir } from 'fs/promises'
import { join, relative } from 'path'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import EventEmitter from 'events'
import extract from 'extract-zip'

export const eventEmitter = new EventEmitter()

const API_BASE = 'https://launcherapi.ripple-co.io'

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

async function downloadChunked(packageId, destPath) {
  const infoRes = await fetch(`${API_BASE}/download/${packageId}/info`)
  if (!infoRes.ok) throw new Error('Failed to get package info')
  const { totalChunks } = await infoRes.json()

  const stream = createWriteStream(destPath)

  for (let i = 0; i < totalChunks; i++) {
    const res = await fetch(`${API_BASE}/download/${packageId}/chunk/${i}`)
    if (!res.ok) throw new Error(`Failed to download chunk ${i}`)
    const buf = await res.arrayBuffer()

    await new Promise((resolve, reject) => {
      stream.write(Buffer.from(buf), (err) => {
        if (err) return reject(err)
        eventEmitter.emit('progress', {
          progress: Math.round(((i + 1) / totalChunks) * 100),
          text: `Downloading files... ${i + 1}/${totalChunks}`,
        })
        resolve()
      })
    })
  }

  await new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()))
  })
}

export async function syncModpackFiles(modpack, instancePath) {
  await mkdir(instancePath, { recursive: true })

  const clientFiles = await getLocalFiles(instancePath)

  const checkRes = await fetch(`${API_BASE}/mods/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modpack: modpack.name, clientFiles }),
  })
  if (!checkRes.ok) throw new Error(`Check failed: ${checkRes.statusText}`)

  const { needsUpdate, changes } = await checkRes.json()
  if (!needsUpdate) {
    eventEmitter.emit('status', { text: 'Modpack is up to date' })
    return
  }

  const prepRes = await fetch(`${API_BASE}/mods/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modpack: modpack.name, changes }),
  })
  if (!prepRes.ok) throw new Error('Failed to prepare package')

  const { packageId } = await prepRes.json()
  const tempZip = join(tmpdir(), `modpack-${Date.now()}.zip`)

  try {
    eventEmitter.emit('status', { text: 'Downloading updates...' })
    await downloadChunked(packageId, tempZip)

    eventEmitter.emit('status', { text: 'Extracting...' })
    await extract(tempZip, { dir: instancePath })

    await fetch(`${API_BASE}/mods/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    })

    eventEmitter.emit('status', { text: 'Sync complete' })
  } finally {
    if (existsSync(tempZip)) unlinkSync(tempZip)
  }
}
