import { useState, useEffect, useCallback } from 'react'

const LOADERS = ['vanilla', 'fabric', 'quilt', 'neoforge', 'forge']

const EMPTY_META = {
  name: '',
  displayName: '',
  mcVersion: '',
  loaderType: 'vanilla',
  loaderVersion: '',
  description: '',
  heroImage: '',
  icon: '',
  patchCategory: '',
}

// ── Version fetching helpers ──────────────────────────────────────────────────

async function fetchMcVersions(loaderType) {
  if (loaderType === 'fabric') {
    const res = await fetch('https://meta.fabricmc.net/v2/versions/game')
    const data = await res.json()
    return data.filter((v) => v.stable).map((v) => v.version)
  }
  if (loaderType === 'quilt') {
    const res = await fetch('https://meta.quiltmc.org/v3/versions/game')
    const data = await res.json()
    return data.filter((v) => v.stable).map((v) => v.version)
  }
  if (loaderType === 'neoforge') {
    const res = await fetch(
      'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
    )
    const data = await res.json()
    const mcSet = new Set()
    data.versions
      .filter((v) => !v.includes('beta') && !v.includes('alpha'))
      .forEach((v) => {
        const mc = neoforgeToMc(v)
        if (mc) mcSet.add(mc)
      })
    // reverse so newest MC versions appear first
    return [...mcSet].reverse()
  }
  if (loaderType === 'forge') {
    const res = await fetch(
      'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json'
    )
    const data = await res.json()
    return Object.keys(data).sort((a, b) => compareMcVersions(b, a))
  }
  // vanilla — Mojang manifest, releases only
  const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
  const data = await res.json()
  return data.versions.filter((v) => v.type === 'release').map((v) => v.id)
}

async function fetchLoaderVersions(loaderType, mcVersion) {
  if (!mcVersion || loaderType === 'vanilla') return []

  if (loaderType === 'fabric') {
    const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`)
    const data = await res.json()
    return data.map((v) => v.loader.version)
  }
  if (loaderType === 'quilt') {
    const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`)
    const data = await res.json()
    return data.map((v) => v.loader.version)
  }
  if (loaderType === 'neoforge') {
    const res = await fetch(
      'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
    )
    const data = await res.json()
    return data.versions
      .filter((v) => !v.includes('beta') && !v.includes('alpha'))
      .filter((v) => neoforgeToMc(v) === mcVersion)
      .reverse()
  }
  if (loaderType === 'forge') {
    const res = await fetch(
      'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json'
    )
    const data = await res.json()
    return (data[mcVersion] ?? []).reverse()
  }
  return []
}

// NeoForge version → Minecraft version
// 47.x.x → 1.20.1  (special case, same numbers as old Forge)
// X.Y.z  → 1.X.Y
function neoforgeToMc(v) {
  if (v.startsWith('47.')) return '1.20.1'
  const parts = v.split('.')
  if (parts.length >= 2) return `1.${parts[0]}.${parts[1]}`
  return null
}

function compareMcVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Infer loader type from a saved loaderVersion string
function inferLoaderType(loaderVersion) {
  if (!loaderVersion) return 'vanilla'
  if (loaderVersion.startsWith('fabric-loader-')) return 'fabric'
  if (loaderVersion.startsWith('quilt-loader-')) return 'quilt'
  if (loaderVersion.startsWith('neoforge-')) return 'neoforge'
  if (loaderVersion.startsWith('forge-')) return 'forge'
  return 'vanilla'
}

// Format a raw loader version number into the stored string
function formatLoaderVersion(loaderType, rawVersion) {
  if (!rawVersion || loaderType === 'vanilla') return ''
  if (loaderType === 'fabric') return `fabric-loader-${rawVersion}`
  if (loaderType === 'quilt') return `quilt-loader-${rawVersion}`
  if (loaderType === 'neoforge') return `neoforge-${rawVersion}`
  if (loaderType === 'forge') return `forge-${rawVersion}`
  return rawVersion
}

// Strip the prefix to get the raw version for displaying in the dropdown
function rawLoaderVersion(loaderType, loaderVersion) {
  if (!loaderVersion) return ''
  const prefixes = {
    fabric: 'fabric-loader-',
    quilt: 'quilt-loader-',
    neoforge: 'neoforge-',
    forge: 'forge-',
  }
  const prefix = prefixes[loaderType]
  return prefix && loaderVersion.startsWith(prefix)
    ? loaderVersion.slice(prefix.length)
    : loaderVersion
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthoringView({ adminKey, onModpacksChanged }) {
  const [modpacks, setModpacks] = useState([])
  const [selected, setSelected] = useState(null)
  const [meta, setMeta] = useState(EMPTY_META)
  const [isNew, setIsNew] = useState(false)
  const [filePath, setFilePath] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  // Version dropdown state
  const [mcVersions, setMcVersions] = useState([])
  const [loaderVersions, setLoaderVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const refreshList = async () => {
    const packs = await window.electron.game.fetchModpacks()
    setModpacks(packs)
  }

  useEffect(() => { refreshList() }, [])

  // Fetch MC versions whenever loader type changes
  useEffect(() => {
    if (!selected) return
    setMcVersions([])
    setLoaderVersions([])
    setVersionsLoading(true)
    fetchMcVersions(meta.loaderType)
      .then(setMcVersions)
      .catch(() => setMcVersions([]))
      .finally(() => setVersionsLoading(false))
  }, [meta.loaderType, selected])

  // Fetch loader versions whenever MC version changes
  const loadLoaderVersions = useCallback(async (loaderType, mcVersion) => {
    if (!mcVersion || loaderType === 'vanilla') {
      setLoaderVersions([])
      return
    }
    setVersionsLoading(true)
    try {
      const versions = await fetchLoaderVersions(loaderType, mcVersion)
      setLoaderVersions(versions)
    } catch {
      setLoaderVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    loadLoaderVersions(meta.loaderType, meta.mcVersion)
  }, [meta.mcVersion, meta.loaderType, selected, loadLoaderVersions])

  const selectExisting = (pack) => {
    const loaderType = pack.loaderType || inferLoaderType(pack.loaderVersion)
    setSelected(pack.name)
    setMeta({
      name:          pack.name          ?? '',
      displayName:   pack.displayName   ?? '',
      mcVersion:     pack.mcVersion     ?? '',
      loaderType,
      loaderVersion: pack.loaderVersion ?? '',
      description:   pack.description   ?? '',
      heroImage:     pack.heroImage     ?? '',
      icon:          pack.icon          ?? '',
      patchCategory: pack.patchCategory ?? '',
    })
    setIsNew(false)
    setFilePath(null)
    setStatus(null)
  }

  const selectNew = () => {
    setSelected('__new__')
    setMeta(EMPTY_META)
    setIsNew(true)
    setFilePath(null)
    setStatus(null)
  }

  const setField = (key, val) => setMeta((m) => ({ ...m, [key]: val }))

  const handleLoaderTypeChange = (loaderType) => {
    setMeta((m) => ({ ...m, loaderType, mcVersion: '', loaderVersion: '' }))
    setLoaderVersions([])
  }

  const handleMcVersionChange = (mcVersion) => {
    setMeta((m) => ({ ...m, mcVersion, loaderVersion: '' }))
  }

  const handleLoaderVersionChange = (rawVersion) => {
    setField('loaderVersion', formatLoaderVersion(meta.loaderType, rawVersion))
  }

  const handlePickFile = async () => {
    const path = await window.electron.admin.pickFile()
    if (path) setFilePath(path)
  }

  const handlePublish = async () => {
    if (!meta.name.trim()) return setStatus({ type: 'error', text: 'Name is required' })
    setBusy(true)
    setStatus(null)
    try {
      setStatus({ type: 'ok', text: 'Saving metadata...' })
      await window.electron.admin.saveModpack(adminKey, meta, isNew)

      if (filePath) {
        setStatus({ type: 'ok', text: 'Uploading files...' })
        const result = await window.electron.admin.pushFiles(adminKey, meta.name, filePath)
        setStatus({ type: 'ok', text: `Published — ${result.fileCount} files indexed` })
      } else {
        setStatus({ type: 'ok', text: 'Metadata saved' })
      }

      setIsNew(false)
      setFilePath(null)
      await refreshList()
      onModpacksChanged()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    setBusy(true)
    setStatus({ type: 'ok', text: 'Regenerating manifest...' })
    try {
      const result = await window.electron.admin.regenerateManifest(adminKey, meta.name)
      setStatus({ type: 'ok', text: `Manifest rebuilt — ${result.fileCount} files` })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${meta.name}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await window.electron.admin.deleteModpack(adminKey, meta.name)
      setSelected(null)
      setMeta(EMPTY_META)
      await refreshList()
      onModpacksChanged()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const currentRawLoader = rawLoaderVersion(meta.loaderType, meta.loaderVersion)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — modpack list */}
      <div className="w-52 shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-surface-600">
          <button
            onClick={selectNew}
            className={`nav-btn w-full rounded text-left ${selected === '__new__' ? 'active' : ''}`}
          >
            <i className="fa-solid fa-plus w-4 text-center" />
            New Modpack
          </button>
        </div>
        <ul className="flex-1 p-2 space-y-0.5">
          {modpacks.map((p) => (
            <li key={p.name}>
              <button
                onClick={() => selectExisting(p)}
                className={`nav-btn w-full text-left rounded ${selected === p.name ? 'active' : ''}`}
              >
                {p.icon
                  ? <img src={p.icon} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                  : <i className="fa-solid fa-cube w-4 text-center" />
                }
                <span className="truncate">{p.displayName || p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right — editor */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">
                {isNew ? 'New Modpack' : meta.displayName || meta.name}
              </h1>
              {!isNew && (
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Delete modpack
                </button>
              )}
            </div>

            {/* Metadata fields */}
            <div className="bg-surface-800 rounded border border-surface-600 p-4 space-y-3">
              <h2 className="text-xs text-gray-400 uppercase tracking-widest">Metadata</h2>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Internal Name *" disabled={!isNew}>
                  <input value={meta.name} onChange={(e) => setField('name', e.target.value)}
                    disabled={!isNew} placeholder="GravitasV2" />
                </Field>
                <Field label="Display Name">
                  <input value={meta.displayName} onChange={(e) => setField('displayName', e.target.value)}
                    placeholder="Gravitas V2" />
                </Field>
              </div>

              {/* Loader + version row */}
              <div className="space-y-2">
                <h3 className="text-xs text-gray-400 uppercase tracking-widest">Modloader</h3>

                {/* Loader type pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {LOADERS.map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLoaderTypeChange(l)}
                      className={`px-3 py-1 text-xs rounded capitalize transition-colors
                        ${meta.loaderType === l
                          ? 'bg-accent text-white'
                          : 'bg-surface-700 text-gray-400 hover:text-white hover:bg-surface-600'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* MC version dropdown */}
                  <Field label="Minecraft Version">
                    {mcVersions.length > 0 ? (
                      <select
                        value={meta.mcVersion}
                        onChange={(e) => handleMcVersionChange(e.target.value)}
                      >
                        <option value="">Select version…</option>
                        {mcVersions.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={meta.mcVersion}
                        onChange={(e) => setField('mcVersion', e.target.value)}
                        placeholder={versionsLoading ? 'Loading…' : '1.20.1'}
                        disabled={versionsLoading}
                      />
                    )}
                  </Field>

                  {/* Loader version dropdown — hidden for vanilla */}
                  {meta.loaderType !== 'vanilla' && (
                    <Field label="Loader Version">
                      {loaderVersions.length > 0 ? (
                        <select
                          value={currentRawLoader}
                          onChange={(e) => handleLoaderVersionChange(e.target.value)}
                        >
                          <option value="">Select version…</option>
                          {loaderVersions.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={currentRawLoader}
                          onChange={(e) => handleLoaderVersionChange(e.target.value)}
                          placeholder={
                            versionsLoading
                              ? 'Loading…'
                              : meta.mcVersion
                              ? 'No versions found'
                              : 'Pick MC version first'
                          }
                          disabled={versionsLoading || !meta.mcVersion}
                        />
                      )}
                    </Field>
                  )}
                </div>

                {/* Show the formatted loaderVersion string for reference */}
                {meta.loaderVersion && (
                  <p className="text-xs text-gray-500">
                    Stored as: <span className="text-gray-400 font-mono">{meta.loaderVersion}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Patch Notes Category">
                  <input value={meta.patchCategory} onChange={(e) => setField('patchCategory', e.target.value)}
                    placeholder="gravitas" />
                </Field>
              </div>

              <Field label="Description">
                <textarea value={meta.description} onChange={(e) => setField('description', e.target.value)}
                  rows={3} placeholder="A description shown on the play screen..." />
              </Field>
              <Field label="Hero Image URL">
                <input value={meta.heroImage} onChange={(e) => setField('heroImage', e.target.value)}
                  placeholder="https://..." />
              </Field>
              <Field label="Icon URL">
                <input value={meta.icon} onChange={(e) => setField('icon', e.target.value)}
                  placeholder="https://..." />
              </Field>
            </div>

            {/* File upload */}
            <div className="bg-surface-800 rounded border border-surface-600 p-4 space-y-3">
              <h2 className="text-xs text-gray-400 uppercase tracking-widest">Mod Files</h2>
              <p className="text-xs text-gray-400">
                Upload a ZIP containing your mods/, config/, resourcepacks/ etc. The server will
                extract it and rebuild the sync manifest automatically.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePickFile}
                  className="px-3 py-1.5 bg-surface-600 hover:bg-surface-500 text-white text-xs rounded transition-colors"
                >
                  Choose ZIP...
                </button>
                {filePath ? (
                  <span className="text-xs text-accent truncate">{filePath.split(/[\\/]/).pop()}</span>
                ) : (
                  <span className="text-xs text-gray-500">No file selected — metadata only</span>
                )}
              </div>

              {!isNew && (
                <button
                  onClick={handleRegenerate}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Regenerate manifest from existing server files
                </button>
              )}
            </div>

            {/* Status + publish */}
            <div className="flex items-center gap-4">
              <button
                onClick={handlePublish}
                disabled={busy || !meta.name.trim()}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold
                           rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Publishing...' : isNew ? 'Create & Publish' : 'Save & Publish'}
              </button>
              {status && (
                <span className={`text-xs ${status.type === 'error' ? 'text-red-400' : 'text-accent'}`}>
                  {status.text}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select a modpack or create a new one
        </div>
      )}
    </div>
  )
}

// Reusable field wrapper — also handles select styling
function Field({ label, children, disabled }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</label>
      <div className={`
        [&_input]:w-full [&_textarea]:w-full [&_select]:w-full
        [&_input]:bg-surface-700 [&_textarea]:bg-surface-700 [&_select]:bg-surface-700
        [&_input]:border [&_textarea]:border [&_select]:border
        [&_input]:border-surface-600 [&_textarea]:border-surface-600 [&_select]:border-surface-600
        [&_input]:px-3 [&_input]:py-1.5 [&_textarea]:px-3 [&_textarea]:py-1.5
        [&_select]:px-3 [&_select]:py-1.5
        [&_input]:text-sm [&_textarea]:text-sm [&_select]:text-sm
        [&_input]:text-white [&_textarea]:text-white [&_select]:text-white
        [&_input]:rounded [&_textarea]:rounded [&_select]:rounded [&_textarea]:resize-none
        [&_input]:focus:outline-none [&_textarea]:focus:outline-none [&_select]:focus:outline-none
        [&_input]:focus:border-accent [&_textarea]:focus:border-accent [&_select]:focus:border-accent
        [&_input:disabled]:text-gray-500 [&_input:disabled]:cursor-not-allowed
        [&_select]:cursor-pointer [&_select]:appearance-none
      `}>
        {children}
      </div>
    </div>
  )
}
