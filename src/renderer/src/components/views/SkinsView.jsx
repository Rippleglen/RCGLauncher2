import { useState, useEffect } from 'react'

// ── Skin face preview ─────────────────────────────────────────────────────────
// Crops the 8×8 face region from a standard 64×64 skin PNG using CSS.

function SkinFace({ url, size = 56 }) {
  const scale  = size / 8
  const bgSize = Math.round(64 * scale)
  const bgPos  = -Math.round(8 * scale)

  return (
    <div
      style={{
        width: size, height: size,
        backgroundImage: `url(${url})`,
        backgroundSize: `${bgSize}px ${bgSize}px`,
        backgroundPosition: `${bgPos}px ${bgPos}px`,
        imageRendering: 'pixelated',
      }}
    />
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({ onUpload, onClose }) {
  const [filePath, setFilePath]   = useState(null)
  const [label, setLabel]         = useState('')
  const [skinType, setSkinType]   = useState('classic')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState(null)

  const pickFile = async () => {
    const p = await window.electron.skins.pickFile()
    if (p) {
      setFilePath(p)
      if (!label) setLabel(p.split(/[\\/]/).pop().replace(/\.png$/i, ''))
    }
  }

  const handleUpload = async () => {
    if (!filePath) return
    setBusy(true); setError(null)
    try {
      await onUpload(filePath, skinType, label)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-80 p-6 space-y-4">
        <h2 className="text-base font-semibold text-center">Upload skin</h2>

        {/* File picker */}
        <button
          onClick={pickFile}
          className="w-full py-2 border-2 border-dashed border-surface-500 hover:border-accent
                     rounded-lg text-sm text-gray-400 hover:text-accent transition-colors"
        >
          {filePath
            ? <span className="text-white">{filePath.split(/[\\/]/).pop()}</span>
            : <><i className="fa-solid fa-image mr-2" />Choose PNG…</>
          }
        </button>

        {/* Label */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="My skin"
            className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-1.5
                       text-sm text-white focus:outline-none focus:border-accent"
          />
        </div>

        {/* Skin type */}
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Model</label>
          <div className="flex gap-2">
            {['classic', 'slim'].map(t => (
              <button
                key={t}
                onClick={() => setSkinType(t)}
                className={`flex-1 py-1.5 text-xs rounded capitalize transition-colors
                  ${skinType === t
                    ? 'bg-accent text-white font-medium'
                    : 'bg-surface-700 text-gray-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-surface-700
                       hover:bg-surface-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!filePath || busy}
            className="flex-1 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover
                       rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skin card ─────────────────────────────────────────────────────────────────

function SkinCard({ skin, onApply, onDelete, applying }) {
  return (
    <div className="group relative bg-surface-800 border border-surface-600 rounded-xl
                    flex flex-col items-center gap-3 p-4 hover:border-surface-500 transition-colors">
      {/* Delete button — top right, appears on hover */}
      <button
        onClick={() => onDelete(skin.id)}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-surface-700 text-gray-500
                   hover:bg-red-500/20 hover:text-red-400 transition-colors
                   opacity-0 group-hover:opacity-100 flex items-center justify-center"
        title="Delete skin"
      >
        <i className="fa-solid fa-xmark text-xs" />
      </button>

      {/* Face preview */}
      <div className="rounded overflow-hidden bg-surface-700 p-1.5">
        <SkinFace url={skin.url} size={56} />
      </div>

      {/* Info */}
      <div className="text-center min-w-0 w-full">
        <p className="text-sm font-medium text-white truncate">
          {skin.label || 'Unnamed'}
        </p>
        <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wider
                         text-gray-500 bg-surface-700 px-2 py-0.5 rounded-full">
          {skin.skinType}
        </span>
      </div>

      {/* Apply button */}
      <button
        onClick={() => onApply(skin)}
        disabled={applying}
        className="w-full py-1.5 text-xs font-semibold text-white bg-accent/20 hover:bg-accent
                   border border-accent/40 hover:border-accent rounded-lg
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applying ? <i className="fa-solid fa-spinner fa-spin" /> : 'Apply'}
      </button>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function SkinsView({ user }) {
  const [skins, setSkins]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [applying, setApplying]     = useState(null)   // skin ID being applied
  const [toast, setToast]           = useState(null)   // { type, text }

  const uuid = user?.uuid

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  const loadSkins = async () => {
    if (!uuid) return
    try {
      const data = await window.electron.skins.list(uuid)
      setSkins(data ?? [])
    } catch (err) {
      showToast('error', `Could not load skins: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSkins() }, [uuid])

  const handleUpload = async (filePath, skinType, label) => {
    await window.electron.skins.upload(uuid, skinType, label, filePath)
    await loadSkins()
    showToast('ok', 'Skin uploaded')
  }

  const handleDelete = async (skinId) => {
    try {
      await window.electron.skins.delete(uuid, skinId)
      setSkins(s => s.filter(x => x.id !== skinId))
    } catch (err) {
      showToast('error', `Delete failed: ${err.message}`)
    }
  }

  const handleApply = async (skin) => {
    setApplying(skin.id)
    try {
      await window.electron.skins.apply(skin.url, skin.skinType)
      showToast('ok', `"${skin.label || 'Skin'}" applied — active on next game launch`)
    } catch (err) {
      showToast('error', `Apply failed: ${err.message}`)
    } finally {
      setApplying(null)
    }
  }

  if (!uuid) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Not logged in
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Skins</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Your skin library — click Apply to set a skin on your Minecraft profile
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin mr-2" /> Loading…
          </div>
        ) : skins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
            <i className="fa-solid fa-shirt text-5xl opacity-20" />
            <p className="text-sm">No skins yet — upload your first one</p>
          </div>
        ) : (
          <div className="grid gap-3"
               style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {skins.map(skin => (
              <SkinCard
                key={skin.id}
                skin={skin}
                onApply={handleApply}
                onDelete={handleDelete}
                applying={applying === skin.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Floating upload button — bottom right */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5
                   bg-accent hover:bg-accent-hover text-white text-sm font-semibold
                   rounded-lg shadow-lg transition-colors"
      >
        <i className="fa-solid fa-plus" />
        Upload skin
      </button>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg text-sm shadow-xl z-50
          ${toast.type === 'error' ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                                   : 'bg-accent/20 border border-accent/40 text-accent'}`}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
