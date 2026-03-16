import { useState, useEffect } from 'react'

const STAGES = {
  idle: null,
  java: 'Checking Java...',
  sync: 'Syncing files...',
  launch: 'Launching...',
  running: 'Game running',
}

export default function PlayView({ modpack }) {
  const [stage, setStage] = useState('idle')
  const [statusText, setStatusText] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Reset state when modpack changes
    setStage('idle')
    setStatusText('')
    setProgress(0)

    window.electron.game.onStatus((data) => {
      setStatusText(data.text)
      setStage(data.stage ?? 'running')
    })

    window.electron.game.onProgress((data) => {
      setProgress(data.progress ?? 0)
    })

    window.electron.game.onClosed(() => {
      setStage('idle')
      setStatusText('')
      setProgress(0)
    })

    return () => window.electron.game.removeListeners()
  }, [modpack.name])

  const handlePlay = async () => {
    if (stage !== 'idle') return
    setStage('java')
    try {
      await window.electron.game.launch(modpack)
    } catch (err) {
      setStage('idle')
      setStatusText(`Error: ${err.message}`)
    }
  }

  const isLaunching = stage !== 'idle' && stage !== 'running'
  const isRunning = stage === 'running'

  return (
    <div className="flex flex-col">
      {/* Hero image */}
      <div className="relative w-full h-[400px] overflow-hidden">
        <img
          src={modpack.heroImage ?? '../../assets/hero.png'}
          alt={modpack.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Play button area */}
      <div className="flex flex-col items-center py-4 bg-surface-900">
        <button
          className="play-btn"
          onClick={handlePlay}
          disabled={isLaunching || isRunning}
        >
          <img src="../../assets/playbutton.png" className="absolute inset-0 w-full h-full object-contain" />
          <span className="relative z-10 text-white font-semibold text-xl tracking-wide drop-shadow">
            {isRunning ? 'Playing' : isLaunching ? '...' : 'Play'}
          </span>
        </button>

        {/* Progress bar — only visible when launching */}
        {(isLaunching || isRunning) && (
          <div className="mt-3 w-64 flex flex-col items-center gap-1">
            <div className="w-full h-1.5 bg-surface-600 rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{statusText}</p>
          </div>
        )}
      </div>

      {/* Modpack info */}
      <div className="px-6 py-4">
        <h1 className="text-xl font-semibold mb-2">{modpack.name}</h1>
        <p className="text-gray-400 text-sm">{modpack.description}</p>
      </div>
    </div>
  )
}
