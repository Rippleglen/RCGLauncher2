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
  return data.javaVersion?.majorVersion ?? 17
}

// Oracle GraalVM for Java 17+ — free to use, ships the Graal JIT which gives
// measurably better FPS and fewer micro-stutters than HotSpot (Adoptium).
// GraalVM dropped Java 8, so we fall back to Adoptium for legacy packs.
function graalVMDownloadUrl(majorVersion) {
  return `https://download.oracle.com/graalvm/${majorVersion}/latest/graalvm-jdk-${majorVersion}_windows-x64_bin.zip`
}

async function adoptiumDownloadUrl(majorVersion) {
  const res  = await fetch(`https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot`)
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
  const useGraalVM = majorVersion >= 17
  const label      = useGraalVM ? `GraalVM JDK ${majorVersion}` : `Java ${majorVersion}`
  const finalPath  = join(javaDir, `java${majorVersion}`)
  const zipPath    = join(tmpdir(), `java${majorVersion}-${Date.now()}.zip`)
  const tempPath   = join(tmpdir(), `java${majorVersion}-temp`)

  onStatus?.(`Downloading ${label}...`)
  await mkdir(javaDir, { recursive: true })

  const url = useGraalVM
    ? graalVMDownloadUrl(majorVersion)
    : await adoptiumDownloadUrl(majorVersion)

  await downloadFile(url, zipPath, pct => {
    onStatus?.(`Downloading ${label}... ${pct}%`)
  })

  onStatus?.(`Installing ${label}...`)
  await extract(zipPath, { dir: tempPath })

  // Both GraalVM and Adoptium zips have a single top-level folder — flatten it
  const [innerFolder] = await readdir(tempPath)
  const innerPath = join(tempPath, innerFolder)
  await mkdir(finalPath, { recursive: true })

  for (const item of await readdir(innerPath)) {
    await rename(join(innerPath, item), join(finalPath, item))
  }

  await rm(tempPath, { recursive: true, force: true })
  await unlink(zipPath).catch(() => {})

  onStatus?.(`${label} installed`)
  return finalPath
}

// Returns { javaPath, majorVersion } so the caller can pick the right JVM flags.
export async function getOrDownloadJava(minecraftVersion, appDataPath, onStatus) {
  const javaDir      = join(appDataPath, 'launcher', 'java')
  const majorVersion = await getRequiredJavaMajorVersion(minecraftVersion)
  const javaPath     = join(javaDir, `java${majorVersion}`, 'bin', 'javaw.exe')

  if (!existsSync(javaPath)) {
    await installJava(majorVersion, javaDir, onStatus)
  }

  return { javaPath, majorVersion }
}
