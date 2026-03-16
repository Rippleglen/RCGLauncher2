export default function Sidebar({ modpacks, selected, onSelectModpack, onHome, onSettings, onLogout, user }) {
  return (
    <nav className="flex flex-col justify-between w-48 bg-surface-900 border-r-2 border-black shrink-0 overflow-y-auto">
      <div>
        {/* Logo */}
        <div className="flex justify-center py-3 px-2">
          <img src="../../assets/RippleCoLogo.webp" alt="RCG" className="w-24" />
        </div>

        {/* Home */}
        <button
          className={`nav-btn ${!selected ? 'active' : ''}`}
          onClick={onHome}
        >
          <i className="fa-solid fa-house w-4 text-center" />
          Home
        </button>

        {/* Modpack list — defined once here, dynamically populated */}
        <ul className="mt-2 space-y-0">
          {modpacks.map((mp) => (
            <li key={mp.name}>
              <button
                className={`nav-btn w-full text-left ${selected?.name === mp.name ? 'active' : ''}`}
                onClick={() => onSelectModpack(mp)}
              >
                {mp.icon
                  ? <img src={mp.icon} alt="" className="w-4 h-4 rounded object-cover" />
                  : <i className="fa-solid fa-cube w-4 text-center" />
                }
                <span className="truncate">{mp.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom actions */}
      <div className="space-y-px">
        <button className="nav-btn" onClick={onSettings}>
          <i className="fa-solid fa-cog w-4 text-center" />
          Settings
        </button>
        <button className="nav-btn" onClick={onLogout}>
          <i className="fa-solid fa-sign-out-alt w-4 text-center" />
          Logout
        </button>
        {user && (
          <div className="px-3 py-1 text-xs text-gray-500 truncate">{user.name}</div>
        )}
      </div>
    </nav>
  )
}
