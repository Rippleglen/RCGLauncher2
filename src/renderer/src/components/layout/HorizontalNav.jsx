import { useRef, useLayoutEffect, useState } from 'react'

const TAB_LABELS = {
  play:       'Play',
  skins:      'Skins',
  config:     'Configuration',
  patchnotes: 'Patch Notes',
}

export default function HorizontalNav({ modpackName, activeTab, onTabChange, tabs }) {
  const tabRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) {
      // Inset 16px (px-4) on each side to match the original inline indicator
      setIndicator({ left: el.offsetLeft + 16, width: el.offsetWidth - 32 })
      setReady(true)
    }
  }, [activeTab, tabs])

  return (
    <header className="bg-surface-900/95 backdrop-blur-sm border-b border-surface-600/40 px-4 pt-3 pb-0 shrink-0">
      <p className="text-xs text-[#55556a] uppercase tracking-widest font-medium mb-1">{modpackName}</p>
      <div className="relative flex items-end gap-0">
        {tabs.map((t) => (
          <button
            key={t}
            ref={el => { tabRefs.current[t] = el }}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {TAB_LABELS[t] ?? t}
          </button>
        ))}

        {/* Sliding indicator — transitions on left/width after first render */}
        <div
          className="absolute bottom-0 h-[2px] bg-accent rounded-t pointer-events-none"
          style={{
            left:       indicator.left,
            width:      indicator.width,
            transition: ready ? 'left 200ms ease, width 200ms ease' : 'none',
          }}
        />
      </div>
    </header>
  )
}
