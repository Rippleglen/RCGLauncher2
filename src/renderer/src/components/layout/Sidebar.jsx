export default function Sidebar({ modpacks, selected, activeView, onSelectModpack, onHome, onSettings, onAuthoring, onLogout, user, isAdmin }) {
  return (
    <nav className="flex flex-col w-48 bg-surface-900 border-r border-surface-600/50 shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex justify-center py-4 px-4 border-b border-surface-600/40">
        <img src="../../assets/RippleCoLogo.webp" alt="RCG" className="w-20 opacity-90" />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Home */}
        <button
          className={`nav-btn ${activeView === 'home' ? 'active' : ''}`}
          onClick={onHome}
        >
          <i className="fa-solid fa-house w-4 text-center shrink-0" />
          <span>Home</span>
        </button>

        {/* Divider */}
        {modpacks.length > 0 && (
          <div className="mx-3 my-1 border-t border-surface-600/40" />
        )}

        {/* Modpack list */}
        <ul className="space-y-px px-1.5 py-1">
          {modpacks.map((mp) => (
            <li key={mp.name}>
              <button
                className={`flex items-center gap-3 w-full px-2 py-2 rounded-md text-left text-sm
                  transition-colors duration-150 cursor-pointer select-none
                  ${selected?.name === mp.name
                    ? 'bg-white/[0.1] text-white font-medium ring-1 ring-accent/30'
                    : 'text-[#9999aa] hover:bg-white/[0.05] hover:text-white'}`}
                onClick={() => onSelectModpack(mp)}
              >
                {/* Icon — 32px square with rounded corners */}
                <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-surface-600 flex items-center justify-center">
                  {mp.icon
                    ? <img src={mp.icon} alt="" className="w-full h-full object-cover" />
                    : <i className="fa-solid fa-cube text-[#666677] text-xs" />
                  }
                </div>
                <span className="truncate">{mp.displayName || mp.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-surface-600/40 py-1">
        {isAdmin && (
          <button className={`nav-btn ${activeView === 'authoring' ? 'active' : ''}`} onClick={onAuthoring}>
            <i className="fa-solid fa-screwdriver-wrench w-4 text-center shrink-0" />
            <span>Authoring</span>
          </button>
        )}
        <button className={`nav-btn ${activeView === 'settings' ? 'active' : ''}`} onClick={onSettings}>
          <i className="fa-solid fa-cog w-4 text-center shrink-0" />
          <span>Settings</span>
        </button>
        <button className="nav-btn" onClick={onLogout}>
          <i className="fa-solid fa-sign-out-alt w-4 text-center shrink-0" />
          <span>Sign out</span>
        </button>
        {user && (
          <div className="px-3 py-2 text-xs text-[#55556a] truncate">{user.name}</div>
        )}
      </div>
    </nav>
  )
}
