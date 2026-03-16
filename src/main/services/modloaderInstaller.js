import { existsSync, createWriteStream } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import axios from 'axios'

/**
 * Ensures the modloader is installed for the given modpack.
 *
 * Returns { custom, forge }:
 *   custom — the version.custom string to pass to mlc (or null)
 *   forge  — path to the installer JAR for mlc's forge option (or null)
 *
 * Fabric/Quilt: installed by writing the profile JSON fetched from their meta APIs.
 * NeoForge/Forge: installer JAR is downloaded and passed to mlc, which handles
 *   running it only if the version isn't already installed.
 */
export async function ensureModloader(modpack, instancePath, appDataPath, onStatus) {
  const { loaderVersion, mcVersion } = modpack
  if (!loaderVersion) return { custom: null, forge: null }

  if (loaderVersion.startsWith('fabric-loader-')) {
    const custom = await ensureFabric(mcVersion, loaderVersion, instancePath, onStatus)
    return { custom, forge: null }
  }

  if (loaderVersion.startsWith('quilt-loader-')) {
    const custom = await ensureQuilt(mcVersion, loaderVersion, instancePath, onStatus)
    return { custom, forge: null }
  }

  if (loaderVersion.startsWith('neoforge-') || loaderVersion.startsWith('forge-')) {
    return ensureForge(modpack, instancePath, appDataPath, onStatus)
  }

  return { custom: null, forge: null }
}

// ── Fabric ────────────────────────────────────────────────────────────────────

async function ensureFabric(mcVersion, loaderVersion, instancePath, onStatus) {
  const loaderVer = loaderVersion.replace('fabric-loader-', '')
  const customId  = `fabric-loader-${loaderVer}-${mcVersion}`
  const jsonPath  = join(instancePath, 'versions', customId, `${customId}.json`)

  if (existsSync(jsonPath)) return customId

  onStatus?.('Installing Fabric...')
  const res = await fetch(
    `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVer}/profile/json`
  )
  if (!res.ok) throw new Error(`Fabric meta returned ${res.status} — check mcVersion/loaderVersion`)
  const profile = await res.json()

  await mkdir(join(instancePath, 'versions', customId), { recursive: true })
  await writeFile(jsonPath, JSON.stringify(profile, null, 2))
  onStatus?.('Fabric installed')
  return customId
}

// ── Quilt ─────────────────────────────────────────────────────────────────────

async function ensureQuilt(mcVersion, loaderVersion, instancePath, onStatus) {
  const loaderVer = loaderVersion.replace('quilt-loader-', '')
  const res = await fetch(
    `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVer}/profile/json`
  )
  if (!res.ok) throw new Error(`Quilt meta returned ${res.status} — check mcVersion/loaderVersion`)
  const profile  = await res.json()
  const customId = profile.id   // Quilt includes build suffix, trust the API

  const jsonPath = join(instancePath, 'versions', customId, `${customId}.json`)
  if (existsSync(jsonPath)) return customId

  onStatus?.('Installing Quilt...')
  await mkdir(join(instancePath, 'versions', customId), { recursive: true })
  await writeFile(jsonPath, JSON.stringify(profile, null, 2))
  onStatus?.('Quilt installed')
  return customId
}

// ── NeoForge / Forge ──────────────────────────────────────────────────────────

async function ensureForge(modpack, instancePath, appDataPath, onStatus) {
  const { loaderVersion, mcVersion } = modpack
  const isNeoForge = loaderVersion.startsWith('neoforge-')
  const ver        = loaderVersion.replace(/^(neoforge-|forge-)/, '')

  // Compute the version ID the installer will create:
  //   NeoForge 47.x.x (1.20.1 era) → "1.20.1-forge-47.x.x"
  //   NeoForge 21+                  → "neoforge-21.x.x"
  //   Forge                         → "{mcVersion}-forge-{ver}"
  const customId = isNeoForge && ver.startsWith('47.')
    ? `1.20.1-forge-${ver}`
    : isNeoForge
    ? `neoforge-${ver}`
    : `${mcVersion}-forge-${ver}`

  // Download installer (cached so we don't re-download on every launch)
  const cacheDir     = join(appDataPath, 'launcher', 'installers')
  const installerPath = join(cacheDir, `${loaderVersion}-installer.jar`)

  if (!existsSync(installerPath)) {
    const url = isNeoForge
      ? `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`
      : `https://files.minecraftforge.net/net/minecraftforge/forge/${ver}/forge-${ver}-installer.jar`

    onStatus?.(`Downloading ${isNeoForge ? 'NeoForge' : 'Forge'} installer...`)
    await mkdir(cacheDir, { recursive: true })
    await downloadToFile(url, installerPath, (pct) => {
      onStatus?.(`Downloading installer... ${pct}%`)
    })
  }

  // mlc will check if customId is already installed and skip the installer if so
  return { custom: customId, forge: installerPath }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadToFile(url, destPath, onProgress) {
  const res = await axios.get(url, {
    responseType: 'stream',
    onDownloadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100))
    },
  })
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(destPath)
    res.data.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}
