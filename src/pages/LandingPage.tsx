import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProximityRadar from '../components/ProximityRadar'

export default function LandingPage() {
  const { user, loading, signInWithEmail } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && user) {
      navigate('/discover', { replace: true })
    }
  }, [user, loading, navigate])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || signInLoading) return
    setSignInLoading(true)
    setErrorMsg(null)
    const { error } = await signInWithEmail(trimmed)
    setSignInLoading(false)
    if (error) setErrorMsg(error)
    else setSent(true)
  }

  const focusEmail = () => {
    emailInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    emailInputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)]">
      {/* Announcement ribbon */}
      <div className="border-b border-[var(--border-strong)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-3 flex items-center justify-center gap-3 text-center">
          <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Early access
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            LinkNear is in private beta. Built for Hackathon 2026.
          </span>
        </div>
      </div>

      {/* Top nav */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <span className="font-display text-2xl text-[var(--text-primary)]">LinkNear</span>
          <button
            type="button"
            onClick={focusEmail}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero — 12-col grid, asymmetric */}
      <section className="max-w-[120rem] mx-auto px-6 md:px-10 py-16 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <p className="font-pixel text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-6">
              01 · Proximity network
            </p>
            <h1 className="font-display text-[clamp(2.75rem,6vw,6.5rem)] text-[var(--text-primary)] leading-[1.02] tracking-[-0.025em] mb-8">
              LinkNear is a proximity network for finding people nearby.
            </h1>
            <p className="font-display text-xl md:text-2xl text-[var(--text-secondary)] leading-snug max-w-2xl mb-10 italic">
              A quieter way to meet the collaborators, mentors, and friends who
              are already walking distance from where you stand.
            </p>

            <form
              onSubmit={handleSignIn}
              className="flex flex-col sm:flex-row gap-3 items-stretch max-w-lg mb-4"
            >
              <input
                ref={emailInputRef}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg(null); setSent(false) }}
                disabled={signInLoading || sent}
                className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={signInLoading || sent || !email.trim()}
                className="text-base text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all whitespace-nowrap px-2 text-left sm:self-center"
              >
                {signInLoading ? 'Sending…' : sent ? '· Link sent' : 'Request access →'}
              </button>
            </form>

            <p
              className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] min-h-[1rem]"
              aria-live="polite"
            >
              {errorMsg ? (
                <span className="text-[var(--danger)]">Err · {errorMsg}</span>
              ) : sent ? (
                <>· Check <strong className="text-[var(--text-primary)]">{email}</strong> for your sign-in link</>
              ) : (
                <>· No password. We email you a one-click link.</>
              )}
            </p>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2">
            <ProximityRadar />
          </div>
        </div>
      </section>

      {/* Platform */}
      <section className="border-t border-[var(--border-strong)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-pixel text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-4">
                02 · Platform
              </p>
              <h2 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.05]">
                A simpler way to meet the people around you.
              </h2>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
              {[
                { no: '01', title: 'Discover', desc: 'Find people within walking distance.' },
                { no: '02', title: 'Match',    desc: 'See who shares your skills and goals.' },
                { no: '03', title: 'Connect',  desc: 'Send a request. Start a conversation.' },
              ].map(item => (
                <div key={item.no}>
                  <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-3">
                    {item.no}
                  </p>
                  <h3 className="font-display text-2xl text-[var(--text-primary)] mb-2 leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Signal — three numbered steps in a single column */}
      <section className="border-t border-[var(--border-strong)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-pixel text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-4">
                03 · Signal
              </p>
              <h2 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.05]">
                Three steps.
              </h2>
            </div>
            <ol className="lg:col-span-8 divide-y divide-[var(--border-strong)]">
              {[
                { no: 'I',   title: 'Request a sign-in link.', desc: 'No password. Enter your email, open the link, you are in.' },
                { no: 'II',  title: 'Sketch who you are.',     desc: 'A name, a headline, a handful of skills. About thirty seconds.' },
                { no: 'III', title: 'See who is nearby.',      desc: 'Browse profiles within your radius, sorted by distance or match.' },
              ].map(step => (
                <li key={step.no} className="py-8 flex gap-6 md:gap-10">
                  <span className="font-pixel text-sm text-[var(--text-tertiary)] w-10 flex-shrink-0 pt-1">
                    {step.no}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl md:text-3xl text-[var(--text-primary)] mb-2 leading-tight">
                      {step.title}
                    </h3>
                    <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-prose">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Quiet CTA */}
      <section className="border-t border-[var(--border-strong)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-24 md:py-32 text-center">
          <p className="font-pixel text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-6">
            04 · Begin
          </p>
          <h2 className="font-display text-5xl md:text-6xl text-[var(--text-primary)] leading-[1.05] mb-10">
            Find your people.
          </h2>
          <button
            type="button"
            onClick={focusEmail}
            className="text-lg text-[var(--accent-primary)] underline underline-offset-[6px] decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
          >
            Request access →
          </button>
        </div>
      </section>

      {/* Single-line footer */}
      <footer className="border-t border-[var(--border-strong)]">
        <div className="max-w-[120rem] mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            © 2026 LinkNear
          </span>
          <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] flex items-center gap-4">
            <span>Hackathon 2026</span>
            <span aria-hidden>·</span>
            <a
              href="https://github.com/candanumut/linknear"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
