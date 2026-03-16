import { useState, useEffect } from 'react'

export default function ConfigView({ modpack }) {
  const [jvmArgs, setJvmArgs] = useState('')
  const [instancePath, setInstancePath] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const config = await window.electron.config.get()
      // Instance path is appData/.RCGLauncher2/instances/<name>
      setInstancePath(`%APPDATA%\\.RCGLauncher2\\instances\\${modpack.name}`)

      const args = await window.electron.config.getJvmArgs(modpack.name)
      setJvmArgs(Array.isArray(args) ? args.join('\n') : '')
    }
    load()
  }, [modpack.name])

  const handleSave = async () => {
    const args = jvmArgs
      .split('\n')
      .map(a => a.trim())
      .filter(Boolean)
    await window.electron.config.setJvmArgs(modpack.name, args)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full overflow-y-auto p-6"><div className="max-w-2xl">
      <h1 className="text-lg font-semibold mb-3 pb-2 border-b border-surface-600">
        Configuration — {modpack.name}
      </h1>

      <div className="space-y-5">
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Modpack Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={instancePath}
              readOnly
              className="flex-1 bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-gray-400 rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            Java Executable
          </label>
          <input
            type="text"
            value="Using automatically managed Java runtime"
            readOnly
            className="w-full bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-gray-500 rounded"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1">
            JVM Arguments
          </label>
          <textarea
            value={jvmArgs}
            onChange={(e) => setJvmArgs(e.target.value)}
            rows={5}
            className="w-full bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-white rounded
                       resize-none focus:outline-none focus:border-accent"
            placeholder="-XX:+UnlockExperimentalVMOptions&#10;-XX:+UseG1GC"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-surface-600 hover:bg-surface-500 text-white text-xs uppercase
                         tracking-widest rounded transition-colors"
            >
              Save
            </button>
            {saved && <span className="text-xs text-accent">Saved</span>}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            To enable -XX:+UseLargePages, launch RCGLauncher as Administrator.
          </p>
        </div>
      </div>
    </div></div>
  )
}
