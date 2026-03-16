const TAB_LABELS = {
  play:       'Play',
  skins:      'Skins',
  config:     'Configuration',
  patchnotes: 'Patch Notes',
}

export default function HorizontalNav({ modpackName, activeTab, onTabChange, tabs }) {
  return (
    <header className="bg-surface-900/95 backdrop-blur-sm border-b border-surface-600/40 px-4 pt-3 pb-0 shrink-0">
      <p className="text-xs text-[#55556a] uppercase tracking-widest font-medium mb-1">{modpackName}</p>
      <div className="flex items-end gap-0">
        {tabs.map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {TAB_LABELS[t] ?? t}
            {activeTab === t && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-accent rounded-t" />
            )}
          </button>
        ))}
      </div>
    </header>
  )
}
