import { useToast } from '../contexts/ToastContext'

interface ShareableCardProps {
  type: 'streak' | 'challenge' | 'connection'
  data: {
    days?: number
    title?: string
    count?: number
  }
}

function getHeading(type: ShareableCardProps['type'], data: ShareableCardProps['data']): string {
  switch (type) {
    case 'streak':
      return `\uD83D\uDD25 ${data.days}-day streak on LinkNear`
    case 'challenge':
      return `\uD83C\uDFAF I completed '${data.title}' today on LinkNear`
    case 'connection':
      return `\uD83E\uDD1D Just made my ${data.count}th connection on LinkNear`
  }
}

function getShareText(type: ShareableCardProps['type'], data: ShareableCardProps['data']): string {
  const url = 'linknear.vercel.app'
  switch (type) {
    case 'streak':
      return `\uD83D\uDD25 I'm on a ${data.days}-day streak of daily good deeds on LinkNear! ${url}`
    case 'challenge':
      return `I completed '${data.title}' today on LinkNear \uD83C\uDFAF ${url}`
    case 'connection':
      return `Just made my ${data.count}th connection on LinkNear \uD83E\uDD1D ${url}`
  }
}

export default function ShareableCard({ type, data }: ShareableCardProps) {
  const { showToast } = useToast()

  const handleShare = async () => {
    const text = getShareText(type, data)

    if (navigator.share) {
      try {
        await navigator.share({ text })
        showToast('Shared!', 'success')
        return
      } catch {
        // User cancelled — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!', 'success')
    } catch {
      showToast('Could not copy', 'error')
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-5">
      <h3 className="font-display text-xl text-[var(--text-primary)] leading-tight mb-3">
        {getHeading(type, data)}
      </h3>
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          LinkNear
        </span>
        <button
          onClick={handleShare}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          Share &rarr;
        </button>
      </div>
    </div>
  )
}
