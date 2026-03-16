import { useState, useEffect, useCallback, useRef } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOADERS = ['vanilla', 'fabric', 'quilt', 'neoforge', 'forge']

const CATEGORIES = [
  { id: 'mods',          label: 'Mods',          icon: 'fa-puzzle-piece', hasTiers: true  },
  { id: 'config',        label: 'Config',         icon: 'fa-sliders',      hasTiers: false },
  { id: 'resourcepacks', label: 'Resource Packs', icon: 'fa-images',       hasTiers: false },
  { id: 'shaderpacks',   label: 'Shader Packs',   icon: 'fa-sun',          hasTiers: false },
]

const TIERS = [
  { id: 'required',  label: 'Required',  cls: 'text-accent' },
  { id: 'suggested', label: 'Suggested', cls: 'text-yellow-400' },
  { id: 'optional',  label: 'Optional',  cls: 'text-gray-400' },
]

const EMPTY_META = {
  name: '', displayName: '', mcVersion: '', loaderType: 'vanilla',
  loaderVersion: '', description: '', heroImage: '', icon: '', patchCategory: '',
}

// ── Version fetching ──────────────────────────────────────────────────────────

async function fetchMcVersions(loaderType) {
  if (loaderType === 'fabric') {
    const d = await fetch('https://meta.fabricmc.net/v2/versions/game').then(r => r.json())
    return d.filter(v => v.stable).map(v => v.version)
  }
  if (loaderType === 'quilt') {
    const d = await fetch('https://meta.quiltmc.org/v3/versions/game').then(r => r.json())
    return d.filter(v => v.stable).map(v => v.version)
  }
  if (loaderType === 'neoforge') {
    const d = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge').then(r => r.json())
    const mcSet = new Set()
    d.versions.filter(v => !v.includes('beta') && !v.includes('alpha'))
      .forEach(v => { const mc = neoforgeToMc(v); if (mc) mcSet.add(mc) })
    return [...mcSet].reverse()
  }
  if (loaderType === 'forge') {
    const d = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json').then(r => r.json())
    return Object.keys(d).sort((a, b) => compareMcVer(b, a))
  }
  const d = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json').then(r => r.json())
  return d.versions.filter(v => v.type === 'release').map(v => v.id)
}

async function fetchLoaderVersions(loaderType, mcVersion) {
  if (!mcVersion || loaderType === 'vanilla') return []
  if (loaderType === 'fabric') {
    const d = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`).then(r => r.json())
    return d.map(v => v.loader.version)
  }
  if (loaderType === 'quilt') {
    const d = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`).then(r => r.json())
    return d.map(v => v.loader.version)
  }
  if (loaderType === 'neoforge') {
    const d = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge').then(r => r.json())
    return d.versions.filter(v => !v.includes('beta') && !v.includes('alpha') && neoforgeToMc(v) === mcVersion).reverse()
  }
  if (loaderType === 'forge') {
    const d = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json').then(r => r.json())
    return (d[mcVersion] ?? []).reverse()
  }
  return []
}

function neoforgeToMc(v) {
  if (v.startsWith('47.')) return '1.20.1'
  const p = v.split('.'); return p.length >= 2 ? `1.${p[0]}.${p[1]}` : null
}

function compareMcVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d !== 0) return d
  }
  return 0
}

function inferLoaderType(lv) {
  if (!lv) return 'vanilla'
  if (lv.startsWith('fabric-loader-')) return 'fabric'
  if (lv.startsWith('quilt-loader-')) return 'quilt'
  if (lv.startsWith('neoforge-')) return 'neoforge'
  if (lv.startsWith('forge-')) return 'forge'
  return 'vanilla'
}

function formatLoaderVersion(type, raw) {
  if (!raw || type === 'vanilla') return ''
  const prefix = { fabric: 'fabric-loader-', quilt: 'quilt-loader-', neoforge: 'neoforge-', forge: 'forge-' }
  return (prefix[type] ?? '') + raw
}

function rawLoaderVersion(type, lv) {
  if (!lv) return ''
  const prefix = { fabric: 'fabric-loader-', quilt: 'quilt-loader-', neoforge: 'neoforge-', forge: 'forge-' }
  const p = prefix[type]
  return p && lv.startsWith(p) ? lv.slice(p.length) : lv
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AuthoringView({ adminKey, onModpacksChanged }) {
  const [modpacks, setModpacks]   = useState([])
  const [selected, setSelected]   = useState(null)   // modpack name or '__new__'
  const [meta, setMeta]           = useState(EMPTY_META)
  const [isNew, setIsNew]         = useState(false)
  const [status, setStatus]       = useState(null)
  const [busy, setBusy]           = useState(false)
  const [activeTab, setActiveTab] = useState('metadata')

  // Version dropdowns
  const [mcVersions, setMcVersions]       = useState([])
  const [loaderVersions, setLoaderVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // File manager
  const [activeCat, setActiveCat]     = useState('mods')
  const [serverFiles, setServerFiles] = useState(null)   // null = not yet loaded
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploading, setUploading]     = useState(null)   // { name, index, total }
  const [isDragOver, setIsDragOver]   = useState(false)
  const dragCounter                   = useRef(0)

  // ── Data loading ────────────────────────────────────────────────────────────

  const refreshList = async () => {
    const packs = await window.electron.game.fetchModpacks()
    setModpacks(packs)
  }

  useEffect(() => { refreshList() }, [])

  const loadFiles = useCallback(async (modpackName) => {
    setFilesLoading(true)
    try {
      const data = await window.electron.admin.listFiles(adminKey, modpackName)
      setServerFiles(data)
    } catch (err) {
      setStatus({ type: 'error', text: `Could not load files: ${err.message}` })
    } finally {
      setFilesLoading(false)
    }
  }, [adminKey])

  // Load files when switching to Files tab (or when a pack is selected and tab is already Files)
  useEffect(() => {
    if (activeTab === 'files' && selected && selected !== '__new__') {
      loadFiles(selected)
    }
  }, [activeTab, selected, loadFiles])

  // MC versions when loader type changes
  useEffect(() => {
    if (!selected) return
    setMcVersions([]); setLoaderVersions([])
    setVersionsLoading(true)
    fetchMcVersions(meta.loaderType)
      .then(setMcVersions).catch(() => setMcVersions([]))
      .finally(() => setVersionsLoading(false))
  }, [meta.loaderType, selected])

  // Loader versions when MC version changes
  useEffect(() => {
    if (!selected || !meta.mcVersion || meta.loaderType === 'vanilla') {
      setLoaderVersions([]); return
    }
    setVersionsLoading(true)
    fetchLoaderVersions(meta.loaderType, meta.mcVersion)
      .then(setLoaderVersions).catch(() => setLoaderVersions([]))
      .finally(() => setVersionsLoading(false))
  }, [meta.mcVersion, meta.loaderType, selected])

  // ── Modpack selection ───────────────────────────────────────────────────────

  const selectExisting = (pack) => {
    const loaderType = pack.loaderType || inferLoaderType(pack.loaderVersion)
    setSelected(pack.name)
    setMeta({
      name: pack.name ?? '', displayName: pack.displayName ?? '',
      mcVersion: pack.mcVersion ?? '', loaderType,
      loaderVersion: pack.loaderVersion ?? '', description: pack.description ?? '',
      heroImage: pack.heroImage ?? '', icon: pack.icon ?? '',
      patchCategory: pack.patchCategory ?? '',
    })
    setIsNew(false); setStatus(null); setServerFiles(null)
    setActiveTab('metadata')
  }

  const selectNew = () => {
    setSelected('__new__'); setMeta(EMPTY_META)
    setIsNew(true); setStatus(null); setServerFiles(null)
    setActiveTab('metadata')
  }

  const setField = (k, v) => setMeta(m => ({ ...m, [k]: v }))

  // ── Metadata handlers ────────────────────────────────────────────────────────

  const handleLoaderTypeChange = (loaderType) =>
    setMeta(m => ({ ...m, loaderType, mcVersion: '', loaderVersion: '' }))

  const handleMcVersionChange = (mcVersion) =>
    setMeta(m => ({ ...m, mcVersion, loaderVersion: '' }))

  const handleLoaderVersionChange = (raw) =>
    setField('loaderVersion', formatLoaderVersion(meta.loaderType, raw))

  const handlePublish = async () => {
    if (!meta.name.trim()) return setStatus({ type: 'error', text: 'Name is required' })
    setBusy(true); setStatus(null)
    try {
      setStatus({ type: 'ok', text: 'Saving metadata...' })
      await window.electron.admin.saveModpack(adminKey, meta, isNew)
      setStatus({ type: 'ok', text: 'Metadata saved' })
      setIsNew(false)
      await refreshList(); onModpacksChanged()
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
      setSelected(null); setMeta(EMPTY_META)
      await refreshList(); onModpacksChanged()
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    setBusy(true); setStatus({ type: 'ok', text: 'Regenerating manifest...' })
    try {
      const r = await window.electron.admin.regenerateManifest(adminKey, selected)
      setStatus({ type: 'ok', text: `Manifest rebuilt — ${r.fileCount} files` })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────────

  const uploadPaths = async (paths) => {
    const total = paths.length
    for (let i = 0; i < paths.length; i++) {
      const filePath = paths[i]
      const name = filePath.split(/[\\/]/).pop()
      setUploading({ name, index: i + 1, total })
      try {
        await window.electron.admin.uploadFile(adminKey, selected, activeCat, filePath)
      } catch (err) {
        setStatus({ type: 'error', text: `Failed to upload ${name}: ${err.message}` })
      }
    }
    setUploading(null)
    await loadFiles(selected)
  }

  const handleBrowse = async () => {
    const paths = await window.electron.admin.pickFiles()
    if (paths.length) await uploadPaths(paths)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    dragCounter.current = 0; setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const paths = files.map(f => f.path).filter(Boolean)
    if (paths.length) await uploadPaths(paths)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounter.current++; setIsDragOver(true)
  }

  const handleDragLeave = () => {
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragOver(false)
  }

  // ── Tier change ──────────────────────────────────────────────────────────────

  const handleTierChange = async (filename, newTier) => {
    // Optimistic update
    setServerFiles(prev => ({
      ...prev,
      mods: prev.mods.map(f => f.name === filename ? { ...f, tier: newTier } : f),
    }))
    // Build full tiers map from current + this change
    const allMods = serverFiles?.mods ?? []
    const tiers = {}
    allMods.forEach(f => {
      tiers[`mods/${f.name}`] = f.name === filename ? newTier : (f.tier || 'required')
    })
    try {
      await window.electron.admin.updateTiers(adminKey, selected, tiers)
    } catch (err) {
      setStatus({ type: 'error', text: `Failed to save tiers: ${err.message}` })
    }
  }

  // ── Delete file ──────────────────────────────────────────────────────────────

  const handleDeleteFile = async (cat, filename) => {
    try {
      await window.electron.admin.deleteFile(adminKey, selected, cat, filename)
      setServerFiles(prev => ({
        ...prev,
        [cat]: prev[cat].filter(f => f.name !== filename),
      }))
    } catch (err) {
      setStatus({ type: 'error', text: `Failed to delete ${filename}: ${err.message}` })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
          {modpacks.map(p => (
            <li key={p.name}>
              <button
                onClick={() => selectExisting(p)}
                className={`nav-btn w-full text-left rounded ${selected === p.name ? 'active' : ''}`}
              >
                {p.icon
                  ? <img src={p.icon} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                  : <i className="fa-solid fa-cube w-4 text-center" />}
                <span className="truncate">{p.displayName || p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right — editor */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header + tabs */}
          <div className="px-6 pt-5 pb-0 border-b border-surface-600 bg-surface-800 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold">
                {isNew ? 'New Modpack' : meta.displayName || meta.name}
              </h1>
              {!isNew && (
                <button
                  onClick={handleDelete} disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Delete modpack
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {['metadata', ...(isNew ? [] : ['files'])].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-xs capitalize rounded-t transition-colors
                    ${activeTab === tab
                      ? 'bg-surface-700 text-white border-t border-x border-surface-600'
                      : 'text-gray-400 hover:text-white'}`}
                >
                  {tab}
                  {tab === 'files' && serverFiles && (
                    <span className="ml-1.5 text-gray-500">
                      {Object.values(serverFiles).reduce((a, c) => a + c.length, 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'metadata' && (
              <MetadataPanel
                meta={meta} isNew={isNew} busy={busy} status={status}
                mcVersions={mcVersions} loaderVersions={loaderVersions}
                versionsLoading={versionsLoading} currentRawLoader={currentRawLoader}
                onField={setField}
                onLoaderType={handleLoaderTypeChange}
                onMcVersion={handleMcVersionChange}
                onLoaderVersion={handleLoaderVersionChange}
                onPublish={handlePublish}
                onRegenerate={handleRegenerate}
              />
            )}
            {activeTab === 'files' && (
              <FilesPanel
                modpackName={selected}
                serverFiles={serverFiles} loading={filesLoading}
                activeCat={activeCat} onCatChange={setActiveCat}
                uploading={uploading} isDragOver={isDragOver}
                onDrop={handleDrop} onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave} onDragOver={e => e.preventDefault()}
                onBrowse={handleBrowse}
                onDeleteFile={handleDeleteFile}
                onTierChange={handleTierChange}
                status={status}
              />
            )}
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

// ── Metadata panel ────────────────────────────────────────────────────────────

function MetadataPanel({
  meta, isNew, busy, status, mcVersions, loaderVersions,
  versionsLoading, currentRawLoader,
  onField, onLoaderType, onMcVersion, onLoaderVersion, onPublish, onRegenerate,
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl space-y-5">
        {/* Identity */}
        <div className="bg-surface-800 rounded border border-surface-600 p-4 space-y-3">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest">Metadata</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Internal Name *" disabled={!isNew}>
              <input value={meta.name} onChange={e => onField('name', e.target.value)}
                disabled={!isNew} placeholder="GravitasV2" />
            </Field>
            <Field label="Display Name">
              <input value={meta.displayName} onChange={e => onField('displayName', e.target.value)}
                placeholder="Gravitas V2" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={meta.description} onChange={e => onField('description', e.target.value)}
              rows={3} placeholder="A description shown on the play screen..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hero Image URL">
              <input value={meta.heroImage} onChange={e => onField('heroImage', e.target.value)}
                placeholder="https://..." />
            </Field>
            <Field label="Icon URL">
              <input value={meta.icon} onChange={e => onField('icon', e.target.value)}
                placeholder="https://..." />
            </Field>
            <Field label="Patch Notes Category">
              <input value={meta.patchCategory} onChange={e => onField('patchCategory', e.target.value)}
                placeholder="gravitas" />
            </Field>
          </div>
        </div>

        {/* Modloader */}
        <div className="bg-surface-800 rounded border border-surface-600 p-4 space-y-3">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest">Modloader</h2>
          <div className="flex gap-1.5 flex-wrap">
            {LOADERS.map(l => (
              <button key={l} onClick={() => onLoaderType(l)}
                className={`px-3 py-1 text-xs rounded capitalize transition-colors
                  ${meta.loaderType === l
                    ? 'bg-accent text-white'
                    : 'bg-surface-700 text-gray-400 hover:text-white hover:bg-surface-600'}`}
              >{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minecraft Version">
              {mcVersions.length > 0 ? (
                <select value={meta.mcVersion} onChange={e => onMcVersion(e.target.value)}>
                  <option value="">Select version…</option>
                  {mcVersions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input value={meta.mcVersion} onChange={e => onField('mcVersion', e.target.value)}
                  placeholder={versionsLoading ? 'Loading…' : '1.20.1'} disabled={versionsLoading} />
              )}
            </Field>
            {meta.loaderType !== 'vanilla' && (
              <Field label="Loader Version">
                {loaderVersions.length > 0 ? (
                  <select value={currentRawLoader} onChange={e => onLoaderVersion(e.target.value)}>
                    <option value="">Select version…</option>
                    {loaderVersions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input value={currentRawLoader} onChange={e => onLoaderVersion(e.target.value)}
                    placeholder={versionsLoading ? 'Loading…' : meta.mcVersion ? 'No versions found' : 'Pick MC version first'}
                    disabled={versionsLoading || !meta.mcVersion} />
                )}
              </Field>
            )}
          </div>
          {meta.loaderVersion && (
            <p className="text-xs text-gray-500">
              Stored as: <span className="font-mono text-gray-400">{meta.loaderVersion}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button onClick={onPublish} disabled={busy || !meta.name.trim()}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold
                       rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Saving...' : isNew ? 'Create Modpack' : 'Save Metadata'}
          </button>
          {!isNew && (
            <button onClick={onRegenerate} disabled={busy}
              className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50">
              Regenerate manifest
            </button>
          )}
          {status && (
            <span className={`text-xs ${status.type === 'error' ? 'text-red-400' : 'text-accent'}`}>
              {status.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Files panel ───────────────────────────────────────────────────────────────

function FilesPanel({
  modpackName, serverFiles, loading, activeCat, onCatChange,
  uploading, isDragOver,
  onDrop, onDragEnter, onDragLeave, onDragOver,
  onBrowse, onDeleteFile, onTierChange, status,
}) {
  const files = serverFiles?.[activeCat] ?? []
  const cat   = CATEGORIES.find(c => c.id === activeCat)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Category sidebar */}
      <div className="w-44 shrink-0 border-r border-surface-600 bg-surface-800 p-2 space-y-0.5 overflow-y-auto">
        {CATEGORIES.map(c => {
          const count = serverFiles?.[c.id]?.length ?? 0
          return (
            <button key={c.id} onClick={() => onCatChange(c.id)}
              className={`nav-btn w-full text-left rounded justify-between
                ${activeCat === c.id ? 'active' : ''}`}>
              <span className="flex items-center gap-2 min-w-0">
                <i className={`fa-solid ${c.icon} w-4 text-center shrink-0`} />
                <span className="truncate">{c.label}</span>
              </span>
              {serverFiles && (
                <span className="text-xs text-gray-500 shrink-0">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* File list + drop zone */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            <i className="fa-solid fa-spinner fa-spin mr-2" /> Loading…
          </div>
        ) : (
          <>
            {/* File list */}
            {files.length > 0 && (
              <div className="flex-1 overflow-y-auto bg-surface-800 rounded border border-surface-600 divide-y divide-surface-600">
                {files.map(f => (
                  <FileRow
                    key={f.name} file={f} hasTiers={cat.hasTiers}
                    onTierChange={tier => onTierChange(f.name, tier)}
                    onDelete={() => onDeleteFile(activeCat, f.name)}
                  />
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDrop={onDrop} onDragEnter={onDragEnter}
              onDragLeave={onDragLeave} onDragOver={onDragOver}
              className={`shrink-0 border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${isDragOver
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-surface-600 text-gray-500 hover:border-surface-500 hover:text-gray-400'}`}
            >
              {uploading ? (
                <div className="space-y-1">
                  <i className="fa-solid fa-arrow-up-from-bracket fa-bounce text-accent text-lg" />
                  <p className="text-xs text-accent">
                    Uploading {uploading.name} ({uploading.index}/{uploading.total})…
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl" />
                  <p className="text-sm">
                    Drop files here, or{' '}
                    <button
                      onClick={onBrowse}
                      className="text-accent hover:underline"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs opacity-60">
                    Files go into <span className="font-mono">{activeCat}/</span>
                  </p>
                </div>
              )}
            </div>

            {status && (
              <p className={`text-xs ${status.type === 'error' ? 'text-red-400' : 'text-accent'}`}>
                {status.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({ file, hasTiers, onTierChange, onDelete }) {
  const tier = TIERS.find(t => t.id === (file.tier || 'required')) ?? TIERS[0]

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-surface-700 transition-colors group">
      <i className="fa-solid fa-file w-3 text-gray-600 shrink-0 text-xs" />
      <span className="flex-1 text-sm text-white truncate min-w-0" title={file.name}>
        {file.name}
      </span>
      <span className="text-xs text-gray-500 shrink-0 tabular-nums">{fmtBytes(file.size)}</span>
      {hasTiers && (
        <select
          value={file.tier || 'required'}
          onChange={e => onTierChange(e.target.value)}
          className={`text-xs bg-surface-700 border border-surface-600 rounded px-2 py-0.5
                      focus:outline-none focus:border-accent cursor-pointer shrink-0 ${tier.cls}`}
        >
          {TIERS.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      )}
      <button
        onClick={onDelete}
        className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        title="Delete file"
      >
        <i className="fa-solid fa-trash text-xs" />
      </button>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</label>
      <div className={`
        [&_input]:w-full [&_textarea]:w-full [&_select]:w-full
        [&_input]:bg-surface-700 [&_textarea]:bg-surface-700 [&_select]:bg-surface-700
        [&_input]:border [&_textarea]:border [&_select]:border
        [&_input]:border-surface-600 [&_textarea]:border-surface-600 [&_select]:border-surface-600
        [&_input]:px-3 [&_input]:py-1.5 [&_textarea]:px-3 [&_textarea]:py-1.5 [&_select]:px-3 [&_select]:py-1.5
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
