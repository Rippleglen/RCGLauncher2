import { useState, useEffect } from 'react'

export default function SettingsView({ user }) {
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

  const handleMemorySlider = async (val) => {
    const gb = Number(val)
    setMemoryGB(gb)
    await window.electron.config.set({ memoryGB: gb })
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
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

      <div className="text-xs text-gray-600 pl-1">v{version}</div>
    </div>
  )
}
