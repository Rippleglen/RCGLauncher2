import { useState, useEffect } from 'react'

export default function PlayView({ modpack }) {
  const [stage, setStage]         = useState('idle')
  const [statusText, setStatusText] = useState('')
  const [progress, setProgress]   = useState(0)

  useEffect(() => {
    setStage('idle')
    setStatusText('')
    setProgress(0)

    window.electron.game.onStatus((data) => {
      setStatusText(data.text)
      setStage(data.stage === 'error' ? 'idle' : (data.stage ?? 'running'))
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
  const isRunning   = stage === 'running'

  const heroImage = modpack.heroImage || '../../assets/hero.png'

  return (
    <div className="flex flex-col h-full">

      {/* ── Hero — fills available height ─────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <img
          src={heroImage}
          alt={modpack.name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlay — dark at bottom where text sits */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/30 to-transparent" />

        {/* Modpack name + description over the hero */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            {modpack.displayName || modpack.name}
          </h1>
          {modpack.description && (
            <p className="mt-1 text-sm text-gray-400 line-clamp-2 max-w-lg">
              {modpack.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Play bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col items-center justify-center gap-2.5
                      bg-surface-900 border-t border-surface-600/40 py-4">
        <button
          className="play-btn"
          onClick={handlePlay}
          disabled={isLaunching || isRunning}
        >
          <img
            src="../../assets/playbutton.png"
            className="absolute inset-0 w-full h-full object-contain"
            alt=""
          />
          <span className="relative z-10 text-white font-semibold text-lg tracking-widest drop-shadow">
            {isRunning ? 'PLAYING' : isLaunching ? '...' : 'PLAY'}
          </span>
        </button>

        {/* Progress — only during launch */}
        {(isLaunching || isRunning) && (
          <div className="flex flex-col items-center gap-1.5 w-56">
            <div className="w-full h-1 bg-surface-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[#6666aa]">{statusText}</p>
          </div>
        )}

        {/* Idle error or status text */}
        {stage === 'idle' && statusText && (
          <p className="text-xs text-red-400">{statusText}</p>
        )}
      </div>

    </div>
  )
}
