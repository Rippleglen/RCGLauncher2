import { useState, useEffect } from 'react'
import Titlebar from '../components/layout/Titlebar'
import Sidebar from '../components/layout/Sidebar'
import HorizontalNav from '../components/layout/HorizontalNav'
import HomeView from '../components/views/HomeView'
import PlayView from '../components/views/PlayView'
import SkinsView from '../components/views/SkinsView'
import ConfigView from '../components/views/ConfigView'
import PatchNotesView from '../components/views/PatchNotesView'
import SettingsView from '../components/views/SettingsView'

const MODPACK_TABS = ['play', 'skins', 'config', 'patchnotes']

export default function Landing({ user, onLogout }) {
  const [modpacks, setModpacks] = useState([])
  const [selected, setSelected] = useState(null)   // active modpack object or null (home)
  const [tab, setTab] = useState('play')
  const [view, setView] = useState('home')          // 'home' | 'modpack' | 'settings'

  useEffect(() => {
    window.electron.game.fetchModpacks()
      .then(setModpacks)
      .catch(console.error)
  }, [])

  const selectModpack = (modpack) => {
    setSelected(modpack)
    setTab('play')
    setView('modpack')
  }

  const goHome = () => {
    setSelected(null)
    setView('home')
  }

  const goSettings = () => {
    setSelected(null)
    setView('settings')
  }

  const renderContent = () => {
    if (view === 'home') return <HomeView />
    if (view === 'settings') return <SettingsView user={user} />
    if (view === 'modpack' && selected) {
      switch (tab) {
        case 'play':       return <PlayView modpack={selected} />
        case 'skins':      return <SkinsView user={user} />
        case 'config':     return <ConfigView modpack={selected} />
        case 'patchnotes': return <PatchNotesView modpack={selected} />
        default:           return <PlayView modpack={selected} />
      }
    }
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-surface-700 font-sans overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          modpacks={modpacks}
          selected={selected}
          onSelectModpack={selectModpack}
          onHome={goHome}
          onSettings={goSettings}
          onLogout={onLogout}
          user={user}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          {view === 'modpack' && selected && (
            <HorizontalNav
              modpackName={selected.name}
              activeTab={tab}
              onTabChange={setTab}
              tabs={MODPACK_TABS}
            />
          )}
          <main className="flex-1 overflow-y-auto bg-surface-700">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  )
}
