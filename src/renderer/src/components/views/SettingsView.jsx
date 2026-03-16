import { useState, useEffect } from 'react'

export default function SettingsView({ user, adminKey, onAdminUnlock }) {
  const [keyInput, setKeyInput] = useState('')
  const [keyError, setKeyError] = useState('')
  const [keyLoading, setKeyLoading] = useState(false)
  const [memoryMode, setMemoryMode] = useState('auto')
  const [memoryGB, setMemoryGB] = useState(8)
  const [systemRam, setSystemRam] = useState(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    const load = async () => {
      const [config, ram, ver] = await Promise.all([
        window.electron.config.get(),
        window.electron.config.getSystemRam(),
        window.electron.config.getVersion(),
      ])
      setMemoryMode(config.memoryMode ?? 'auto')
      setMemoryGB(config.memoryGB ?? 8)
      setSystemRam(ram)
      setVersion(ver)
    }
    load()
  }, [])

  const handleMemoryModeChange = async (mode) => {
    setMemoryMode(mode)
    await window.electron.config.set({ memoryMode: mode })
  }

  const handleUnlock = async () => {
    setKeyLoading(true)
    setKeyError('')
    try {
      const valid = await window.electron.admin.validateKey(keyInput)
      if (valid) {
        onAdminUnlock(keyInput)
        setKeyInput('')
      } else {
        setKeyError('Invalid key')
      }
    } catch {
      setKeyError('Could not reach server')
    } finally {
      setKeyLoading(false)
    }
  }

  const handleMemorySlider = async (val) => {
    const gb = Number(val)
    setMemoryGB(gb)
    await window.electron.config.set({ memoryGB: gb })
  }

  return (
    <div className="h-full overflow-y-auto p-6"><div className="max-w-2xl space-y-4">
      <div className="bg-surface-800 rounded p-4 border border-surface-600">
        <h2 className="text-base font-semibold mb-1">Settings</h2>
      </div>

      <div className="bg-surface-800 rounded p-4 border border-surface-600">
        <h3 className="text-sm font-semibold mb-1">Java Path</h3>
        <p className="text-xs text-gray-400">
          Java is automatically managed. The correct JRE is downloaded per modpack.
        </p>
      </div>

      <div className="bg-surface-800 rounded p-4 border border-surface-600 space-y-3">
        <h3 className="text-sm font-semibold">Memory Allocation</h3>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="memMode"
              value="auto"
              checked={memoryMode === 'auto'}
              onChange={() => handleMemoryModeChange('auto')}
            />
            Automatic
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="memMode"
              value="manual"
              checked={memoryMode === 'manual'}
              onChange={() => handleMemoryModeChange('manual')}
            />
            Manual
          </label>
        </div>

        {memoryMode === 'auto' && systemRam && (
          <p className="text-xs text-gray-400">
            Allocating ~{systemRam}GB (half of system RAM)
          </p>
        )}

        {memoryMode === 'manual' && (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={4}
              max={16}
              step={2}
              value={memoryGB}
              onChange={(e) => handleMemorySlider(e.target.value)}
              className="flex-1 accent-accent"
            />
            <span className="text-sm w-12">{memoryGB}GB</span>
          </div>
        )}

        <p className="text-xs text-gray-600">
          * In automatic mode, available RAM may be lower than total due to Windows allocation.
        </p>
      </div>

      <div className="bg-surface-800 rounded p-4 border border-surface-600">
        <h3 className="text-sm font-semibold mb-1">Skin</h3>
        <p className="text-xs text-gray-400 mb-3">
          Skin management is available in the Skins tab for each modpack.
        </p>
        {user && (
          <p className="text-xs text-gray-500">Logged in as {user.name}</p>
        )}
      </div>

      <div className="bg-surface-800 rounded p-4 border border-surface-600">
        <h3 className="text-sm font-semibold mb-1">Developer Mode</h3>
        {adminKey ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-accent">Authoring mode unlocked</p>
            <button
              onClick={() => onAdminUnlock(null)}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Lock
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Enter your admin key to unlock the modpack authoring tool.</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setKeyError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder="Admin key"
                className="flex-1 bg-surface-700 border border-surface-600 px-3 py-1.5 text-sm
                           text-white rounded focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleUnlock}
                disabled={keyLoading || !keyInput}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs
                           rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {keyLoading ? '...' : 'Unlock'}
              </button>
            </div>
            {keyError && <p className="text-xs text-red-400">{keyError}</p>}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-600 pl-1">v{version}</div>
    </div></div>
  )
}
