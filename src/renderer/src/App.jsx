import { useState, useEffect } from 'react'
import Splash from './pages/Splash'
import Welcome from './pages/Welcome'
import Landing from './pages/Landing'

// Top-level router — no react-router needed, just three states
export default function App() {
  const [page, setPage] = useState('splash') // 'splash' | 'welcome' | 'landing'
  const [user, setUser] = useState(null)
  const [adminKey, setAdminKey] = useState(null)

  useEffect(() => {
    const init = async () => {
      // Wait for updater to finish (pull-based — no timing race)
      await window.electron.updater.check()

      try {
        const authData = await window.electron.auth.getUser()
        setUser(authData)
        setPage('landing')
      } catch {
        setPage('welcome')
      }
    }
    init()
  }, [])

  const handleLoginSuccess = (authData) => {
    setUser(authData)
    setPage('landing')
  }

  const handleLogout = async () => {
    await window.electron.auth.logout()
    setUser(null)
    setPage('welcome')
  }

  if (page === 'splash') return <Splash />
  if (page === 'welcome') return <Welcome onLoginSuccess={handleLoginSuccess} />
  return <Landing user={user} onLogout={handleLogout} adminKey={adminKey} onAdminUnlock={setAdminKey} />
}
