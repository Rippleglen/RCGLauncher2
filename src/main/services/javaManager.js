// Merged from components/javaDwnld.js + components/javaVersionParser.js
import { existsSync, createWriteStream } from 'fs'
import { mkdir, readdir, rename, rm, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import axios from 'axios'
import extract from 'extract-zip'

async function getRequiredJavaMajorVersion(minecraftVersion) {
  const manifest = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
  const { versions } = await manifest.json()

  const entry = versions.find(v => v.id === minecraftVersion)
  if (!entry) throw new Error(`Minecraft version ${minecraftVersion} not found in Mojang manifest`)

  const versionJson = await fetch(entry.url)
  const data = await versionJson.json()
  return data.javaVersion?.majorVersion ?? 17  // default to 17 if not specified
}

async function fetchAdoptiumDownloadUrl(majorVersion) {
  const res = await fetch(`https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot`)
  const data = await res.json()
  const asset = data.find(a => a.binary.os === 'windows' && a.binary.image_type === 'jre')
  if (!asset) throw new Error(`No Windows JRE found for Java ${majorVersion} on Adoptium`)
  return asset.binary.package.link
}

async function downloadFile(url, destPath, onProgress) {
  const res = await axios.get(url, {
    responseType: 'stream',
    onDownloadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
  })

  return new Promise((resolve, reject) => {
    const stream = createWriteStream(destPath)
    res.data.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

async function installJava(majorVersion, javaDir, onStatus) {
  const finalPath = join(javaDir, `java${majorVersion}`)
  const zipPath = join(tmpdir(), `java${majorVersion}-${Date.now()}.zip`)
  const tempPath = join(tmpdir(), `java${majorVersion}-temp`)

  onStatus?.(`Downloading Java ${majorVersion}...`)
  await mkdir(javaDir, { recursive: true })

  const downloadUrl = await fetchAdoptiumDownloadUrl(majorVersion)
  await downloadFile(downloadUrl, zipPath, (pct) => {
    onStatus?.(`Downloading Java ${majorVersion}... ${pct}%`)
  })

  onStatus?.(`Extracting Java ${majorVersion}...`)
  await extract(zipPath, { dir: tempPath })

  // Adoptium zips contain a single top-level folder — move its contents to finalPath
  const [innerFolder] = await readdir(tempPath)
  const innerPath = join(tempPath, innerFolder)
  await mkdir(finalPath, { recursive: true })

  const items = await readdir(innerPath)
  for (const item of items) {
    await rename(join(innerPath, item), join(finalPath, item))
  }

  await rm(tempPath, { recursive: true, force: true })
  await unlink(zipPath).catch(() => {})

  onStatus?.(`Java ${majorVersion} installed`)
  return finalPath
}

export async function getOrDownloadJava(minecraftVersion, appDataPath, onStatus) {
  const javaDir = join(appDataPath, 'launcher', 'java')
  const majorVersion = await getRequiredJavaMajorVersion(minecraftVersion)
  const javaPath = join(javaDir, `java${majorVersion}`, 'bin', 'javaw.exe')

  if (!existsSync(javaPath)) {
    await installJava(majorVersion, javaDir, onStatus)
  }

  return javaPath
}
