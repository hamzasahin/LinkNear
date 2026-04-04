import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'

const NAV_LINKS = [
  { to: '/discover', label: 'Discover', icon: '🔍' },
  { to: '/connections', label: 'Connections', icon: '🤝' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const avatarUrl = user?.user_metadata?.avatar_url
  const fullName = user?.user_metadata?.full_name || user?.email || 'User'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Desktop navbar */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0 z-40">
        <NavLink
          to="/discover"
          className="font-display text-2xl font-bold text-[var(--accent-primary)] tracking-tight hover:opacity-80 transition-opacity"
        >
          LinkNear
        </NavLink>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[rgba(0,191,166,0.15)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-all"
          >
            <Avatar src={avatarUrl} name={fullName} size="sm" />
            <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{fullName}</p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{user?.email}</p>
              </div>
              <NavLink
                to="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all"
              >
                ⚙️ Settings
              </NavLink>
              <button
                onClick={handleSignOut}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[rgba(239,68,68,0.1)] transition-all"
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border)] z-40 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 px-6 text-xs font-medium transition-all ${
                  isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                }`
              }
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-3 px-6 text-xs font-medium transition-all ${
                isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
              }`
            }
          >
            <span className="text-xl">👤</span>
            Profile
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
