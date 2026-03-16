import { useState } from 'react'
import Titlebar from '../components/layout/Titlebar'

export default function Welcome({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const authData = await window.electron.auth.login()
      onLoginSuccess(authData)
    } catch (err) {
      setError(err.message === 'Login window closed' ? null : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface-900 text-white font-sans">
      <Titlebar />
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8">
        <img src="../../assets/RippleCoLogo.webp" alt="RippleCo" className="w-28" />

        <div className="text-center">
          <h1 className="text-2xl font-semibold">RippleCo Games</h1>
          <h2 className="text-base text-gray-400 mt-1">Minecraft Launcher V3</h2>
        </div>

        <hr className="w-full border-surface-600" />

        <div className="text-center text-sm text-gray-400 max-w-sm">
          <p className="font-medium text-white mb-2">Welcome back, I've got some jobs for you...</p>
          <p>V3 is a complete rewrite with a proper component architecture, local Tailwind build, and secure IPC.</p>
        </div>

        <hr className="w-full border-surface-600" />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="flex items-center gap-3 px-6 py-3 bg-[#2f2f2f] border border-surface-600
                     hover:bg-surface-600 transition-colors duration-200 rounded text-white text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="../../assets/MicrosoftLogoWhite.png" alt="Microsoft" className="w-5 h-5" />
          {loading ? 'Signing in...' : 'Sign in with Microsoft'}
        </button>
      </div>
    </div>
  )
}
