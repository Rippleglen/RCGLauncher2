import { useState, useEffect, useCallback } from 'react'

export default function ConfigView({ modpack }) {
  const [jvmArgs, setJvmArgs]       = useState('')
  const [instancePath, setInstancePath] = useState('')
  const [saved, setSaved]           = useState(false)

  const loadDefaults = useCallback(async () => {
    const flags = await window.electron.config.getDefaultJvmFlags(modpack.mcVersion)
    return flags.join('\n')
  }, [modpack.mcVersion])

  useEffect(() => {
    const load = async () => {
      setInstancePath(`%APPDATA%\\.RCGLauncher2\\instances\\${modpack.name}`)

      const args = await window.electron.config.getJvmArgs(modpack.name)
      if (Array.isArray(args) && args.length > 0) {
        setJvmArgs(args.join('\n'))
      } else {
        // No saved args yet — show the recommended defaults so the user can see
        // and edit them before saving. They're applied at launch regardless.
        setJvmArgs(await loadDefaults())
      }
    }
    load()
  }, [modpack.name])

  const handleSave = async () => {
    const args = jvmArgs.split('\n').map(a => a.trim()).filter(Boolean)
    await window.electron.config.setJvmArgs(modpack.name, args)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    setJvmArgs(await loadDefaults())
  }

  return (
    <div className="h-full overflow-y-auto p-6"><div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-3 pb-2 border-b border-surface-600">
        Configuration — {modpack.name}
      </h1>

      <div className="space-y-5">
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Modpack Directory
          </label>
          <input
            type="text"
            value={instancePath}
            readOnly
            className="w-full bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-gray-400 rounded"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Java Runtime
          </label>
          <input
            type="text"
            value="GraalVM JDK (auto-managed) — Java 17/21 use ZGC, Java 8 uses G1GC"
            readOnly
            className="w-full bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-gray-500 rounded"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400 uppercase tracking-widest">
              JVM Arguments
            </label>
            <button
              onClick={handleReset}
              className="text-[10px] text-gray-500 hover:text-accent transition-colors uppercase tracking-wider"
            >
              Reset to defaults
            </button>
          </div>
          <textarea
            value={jvmArgs}
            onChange={(e) => setJvmArgs(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-white rounded
                       resize-none focus:outline-none focus:border-accent font-mono"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-600">
              One flag per line. Memory (-Xmx/-Xms) is set separately in Settings.
            </p>
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-accent">Saved</span>}
              <button
                onClick={handleSave}
                className="px-4 py-1.5 bg-surface-600 hover:bg-surface-500 text-white text-xs uppercase
                           tracking-widest rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div></div>
  )
}
