import { useState, useEffect } from 'react'
import Titlebar from '../components/layout/Titlebar'

export default function Splash() {
  const [status, setStatus] = useState('Contacting RippleCo...')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    window.electron.updater.onStatus((data) => {
      setStatus(data.text)
      setProgress(data.progress ?? 0)
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-surface-900 text-white font-sans">
      <Titlebar />
      <div className="flex flex-col items-center justify-center flex-1 gap-5">
        <img src="../../assets/RippleCoLogo.webp" alt="RippleCo" className="w-48" />
        <div className="w-10 h-10 border-[3px] border-surface-600 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-300">{status}</p>
        {progress > 0 && (
          <div className="w-48 h-1 bg-surface-600 rounded overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
