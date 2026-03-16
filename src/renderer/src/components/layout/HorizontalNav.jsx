const TAB_LABELS = {
  play: 'Play',
  skins: 'Skins',
  config: 'Configuration',
  patchnotes: 'Patch Notes',
}

export default function HorizontalNav({ modpackName, activeTab, onTabChange, tabs }) {
  return (
    <header className="bg-surface-900 shadow-lg px-4 pt-4 pb-0 relative">
      <h2 className="text-sm font-semibold text-white tracking-wide mb-1 ml-1">{modpackName}</h2>
      <div className="flex items-end gap-1 relative">
        {tabs.map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {TAB_LABELS[t] ?? t}
            {activeTab === t && (
              <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-accent rounded-t" />
            )}
          </button>
        ))}
      </div>
    </header>
  )
}
