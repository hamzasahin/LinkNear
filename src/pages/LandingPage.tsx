import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROTATING_WORDS = ['cofounders', 'study buddies', 'mentors', 'collaborators', 'friends']

export default function LandingPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [wordIndex, setWordIndex] = useState(0)
  const [signInLoading, setSignInLoading] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      navigate('/discover', { replace: true })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % ROTATING_WORDS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleSignIn = async () => {
    setSignInLoading(true)
    await signInWithGoogle()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent-primary)] opacity-[0.06] rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--accent-secondary)] opacity-[0.06] rounded-full blur-3xl animate-float delay-300" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent-tertiary)] opacity-[0.03] rounded-full blur-3xl" />
        </div>

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
          <span className="font-display text-2xl font-bold text-[var(--accent-primary)]">LinkNear</span>
          <button
            onClick={handleSignIn}
            disabled={signInLoading}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all"
          >
            Sign in
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(0,191,166,0.1)] border border-[rgba(0,191,166,0.3)] text-[var(--accent-primary)] text-sm font-medium mb-8 animate-fade-in-up">
            <span className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse" />
            Built for Hackathon 2026
          </div>

          <h1 className="font-display text-6xl md:text-8xl font-bold text-[var(--text-primary)] mb-6 animate-fade-in-up delay-100 leading-none">
            Meet brilliant people.
            <br />
            <span className="text-[var(--accent-primary)]">Right where you are.</span>
          </h1>

          <div className="text-xl md:text-2xl text-[var(--text-secondary)] mb-4 animate-fade-in-up delay-200 h-8">
            Find{' '}
            <span
              key={wordIndex}
              className="text-[var(--accent-tertiary)] font-semibold animate-fade-in-up inline-block"
            >
              {ROTATING_WORDS[wordIndex]}
            </span>{' '}
            nearby
          </div>

          <p className="text-[var(--text-tertiary)] text-base md:text-lg max-w-xl mx-auto mb-10 animate-fade-in-up delay-300">
            LinkNear uses your location to connect you with professionals, creators, and curious minds within walking distance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center animate-fade-in-up delay-400">
            <button
              onClick={handleSignIn}
              disabled={signInLoading}
              className="group flex items-center gap-3 px-8 py-4 bg-white text-gray-800 font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signInLoading ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>

          <p className="mt-4 text-xs text-[var(--text-tertiary)] animate-fade-in-up delay-500">
            No password needed. Just your Google account.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 max-w-6xl mx-auto">
        <h2 className="font-display text-4xl md:text-5xl text-center text-[var(--text-primary)] mb-4">
          Why <span className="text-[var(--accent-primary)]">LinkNear</span>?
        </h2>
        <p className="text-[var(--text-secondary)] text-center mb-16 max-w-xl mx-auto">
          The smartest way to expand your professional circle without leaving your neighborhood.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '📍',
              title: 'Discover',
              description: 'Find professionals and creators within walking distance. No need to scroll through thousands of global profiles.',
              color: 'var(--accent-primary)',
            },
            {
              icon: '🎯',
              title: 'Match',
              description: 'Smart compatibility scores based on your shared skills, interests, and goals — so every connection counts.',
              color: 'var(--accent-tertiary)',
            },
            {
              icon: '🤝',
              title: 'Connect',
              description: 'Send a personalized request, start a conversation, and begin collaborating today.',
              color: 'var(--accent-secondary)',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 hover:-translate-y-1 transition-transform duration-200"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-5"
                style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}
              >
                {f.icon}
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">{f.title}</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-[var(--bg-surface)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-center text-[var(--text-primary)] mb-4">
            How it works
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-16 max-w-lg mx-auto">
            Get started in under 2 minutes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '🚀', title: 'Sign up with Google', desc: 'One click, no forms, no passwords. Your profile is pre-filled from Google.' },
              { step: '2', icon: '✨', title: 'Add your skills & goals', desc: 'Tell us what you know and what you\'re looking for. Takes 60 seconds.' },
              { step: '3', icon: '🌍', title: 'Discover people nearby', desc: 'Browse profiles, check match scores, and send connection requests instantly.' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[rgba(0,191,166,0.15)] border border-[rgba(0,191,166,0.3)] flex items-center justify-center text-3xl mb-4 relative">
                  {s.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--accent-primary)] text-[var(--bg-primary)] rounded-full text-xs font-bold flex items-center justify-center">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{s.title}</h3>
                <p className="text-[var(--text-secondary)] text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] mb-4">
            Ready to meet your people?
          </h2>
          <p className="text-[var(--text-secondary)] mb-8">
            Join the community of builders, creators, and dreamers near you.
          </p>
          <button
            onClick={handleSignIn}
            disabled={signInLoading}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-bold rounded-xl hover:opacity-90 transition-all text-base shadow-lg"
          >
            Get Started Free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-4 text-center">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-6xl mx-auto gap-4">
          <span className="font-display text-xl text-[var(--accent-primary)]">LinkNear</span>
          <p className="text-[var(--text-tertiary)] text-sm">Built with ❤️ for Hackathon 2026</p>
          <a
            href="https://github.com/candanumut/linknear"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  )
}
