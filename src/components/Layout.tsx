import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { useRealtime } from '../contexts/RealtimeContext'
import Avatar from './Avatar'

const NAV_LINKS: { to: string; label: string; badgeKey?: 'pendingReceivedCount' | 'unreadMessageCount' }[] = [
  { to: '/discover', label: 'Discover' },
  { to: '/connections', label: 'Connections', badgeKey: 'pendingReceivedCount' },
  { to: '/messages', label: 'Messages', badgeKey: 'unreadMessageCount' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const realtime = useRealtime()

  // Send a presence heartbeat every 60s so other users see accurate "active now".
  useHeartbeat()

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
      <header className="hidden md:flex items-center justify-between px-8 py-5 bg-[var(--bg-primary)] border-b border-[var(--border-strong)] sticky top-0 z-40">
        <NavLink
          to="/discover"
          className="font-display text-2xl text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          LinkNear
        </NavLink>

        <nav className="flex items-center gap-8">
          {NAV_LINKS.map(link => {
            const badge = link.badgeKey ? realtime[link.badgeKey] : 0
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative text-sm transition-colors pb-1 border-b ${
                    isActive
                      ? 'text-[var(--text-primary)] border-[var(--accent-primary)]'
                      : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-primary)]'
                  }`
                }
              >
                {link.label}
                {badge > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[10px] font-bold tabular-nums">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 p-1 rounded-[var(--radius-md)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <Avatar src={avatarUrl} name={fullName} size="sm" />
            <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm text-[var(--text-primary)] truncate">{fullName}</p>
                <p className="font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] truncate mt-0.5">
                  {user?.email}
                </p>
              </div>
              <NavLink
                to="/settings"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                Settings
              </NavLink>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
              >
                Sign out
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-strong)] z-40 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          {NAV_LINKS.map(link => {
            const badge = link.badgeKey ? realtime[link.badgeKey] : 0
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 py-3 px-4 font-pixel text-[10px] uppercase tracking-[0.08em] transition-colors ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                  }`
                }
              >
                <span className="text-base leading-none" aria-hidden>·</span>
                {link.label}
                {badge > 0 && (
                  <span className="absolute top-1 right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[9px] font-bold tabular-nums">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            )
          })}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-3 px-4 font-pixel text-[10px] uppercase tracking-[0.08em] transition-colors ${
                isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
              }`
            }
          >
            <span className="text-base leading-none" aria-hidden>·</span>
            Profile
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
