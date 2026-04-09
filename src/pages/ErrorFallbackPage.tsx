export default function ErrorFallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg-primary)]">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl text-[var(--text-primary)] mb-3">
          Something went wrong.
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm mb-8">
          We've been notified and are looking into it.
        </p>
        <div className="flex items-center justify-center gap-6">
          <a
            href="/#/discover"
            className="text-[var(--accent-primary)] underline underline-offset-4 text-sm"
          >
            Go back to Discover &rarr;
          </a>
          <button
            onClick={() => window.location.reload()}
            className="text-[var(--text-tertiary)] text-sm cursor-pointer bg-transparent border-none"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  )
}
