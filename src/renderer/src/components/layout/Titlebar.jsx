export default function Titlebar() {
  return (
    <div className="flex justify-end items-center h-7 bg-surface-900 select-none shrink-0"
         style={{ WebkitAppRegion: 'drag' }}>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electron.window.minimize()}
          className="w-12 h-7 text-gray-400 hover:bg-surface-600 hover:text-white
                     text-xs transition-colors duration-150"
        >
          ─
        </button>
        <button
          onClick={() => window.electron.window.maximize()}
          className="w-12 h-7 text-gray-400 hover:bg-surface-600 hover:text-white
                     text-xs transition-colors duration-150"
        >
          ☐
        </button>
        <button
          onClick={() => window.electron.window.close()}
          className="w-12 h-7 text-gray-400 hover:bg-red-600 hover:text-white
                     text-xs transition-colors duration-150"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
