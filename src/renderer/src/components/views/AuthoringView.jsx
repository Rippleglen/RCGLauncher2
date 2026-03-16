import { useState, useEffect } from 'react'

const EMPTY_META = {
  name: '',
  displayName: '',
  mcVersion: '',
  loaderVersion: '',
  description: '',
  heroImage: '',
  icon: '',
  patchCategory: '',
}

export default function AuthoringView({ adminKey, onModpacksChanged }) {
  const [modpacks, setModpacks] = useState([])
  const [selected, setSelected] = useState(null)   // modpack name being edited, or '__new__'
  const [meta, setMeta] = useState(EMPTY_META)
  const [isNew, setIsNew] = useState(false)
  const [filePath, setFilePath] = useState(null)
  const [status, setStatus] = useState(null)        // { type: 'ok'|'error', text }
  const [busy, setBusy] = useState(false)

  const refreshList = async () => {
    const packs = await window.electron.game.fetchModpacks()
    setModpacks(packs)
  }

  useEffect(() => { refreshList() }, [])

  const selectExisting = (pack) => {
    setSelected(pack.name)
    setMeta({
      name:          pack.name          ?? '',
      displayName:   pack.displayName   ?? '',
      mcVersion:     pack.mcVersion     ?? '',
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

  const handlePickFile = async () => {
    const path = await window.electron.admin.pickFile()
    if (path) setFilePath(path)
  }

  const handlePublish = async () => {
    if (!meta.name.trim()) return setStatus({ type: 'error', text: 'Name is required' })
    setBusy(true)
    setStatus(null)
    try {
      // 1. Save metadata
      setStatus({ type: 'ok', text: 'Saving metadata...' })
      await window.electron.admin.saveModpack(adminKey, meta, isNew)

      // 2. Push files if one was selected
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
                <Field label="Minecraft Version">
                  <input value={meta.mcVersion} onChange={(e) => setField('mcVersion', e.target.value)}
                    placeholder="1.20.1" />
                </Field>
                <Field label="Loader Version">
                  <input value={meta.loaderVersion} onChange={(e) => setField('loaderVersion', e.target.value)}
                    placeholder="neoforge-47.2.0" />
                </Field>
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

// Reusable field wrapper
function Field({ label, children, disabled }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</label>
      <div className={`[&_input]:w-full [&_textarea]:w-full [&_input]:bg-surface-700 [&_textarea]:bg-surface-700
        [&_input]:border [&_textarea]:border [&_input]:border-surface-600 [&_textarea]:border-surface-600
        [&_input]:px-3 [&_input]:py-1.5 [&_textarea]:px-3 [&_textarea]:py-1.5
        [&_input]:text-sm [&_textarea]:text-sm [&_input]:text-white [&_textarea]:text-white
        [&_input]:rounded [&_textarea]:rounded [&_textarea]:resize-none
        [&_input]:focus:outline-none [&_textarea]:focus:outline-none
        [&_input]:focus:border-accent [&_textarea]:focus:border-accent
        [&_input:disabled]:text-gray-500 [&_input:disabled]:cursor-not-allowed`}>
        {children}
      </div>
    </div>
  )
}
