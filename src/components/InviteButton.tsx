import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function InviteButton() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const handleInvite = async () => {
    if (!user) return

    const url = `https://linknear.vercel.app?ref=${user.id.slice(0, 8)}`
    const text = `I'm on LinkNear \u2014 an app that helps you find people nearby who share your skills and interests. No photos until you connect. Join me: ${url}`

    // Mobile: native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ text })
        showToast('Shared!', 'success')
        return
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    // Desktop: clipboard fallback
    try {
      await navigator.clipboard.writeText(text)
      showToast('Invite link copied!', 'success')
    } catch {
      showToast('Could not copy link', 'error')
    }
  }

  return (
    <button
      onClick={handleInvite}
      className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
    >
      Invite someone nearby &rarr;
    </button>
  )
}
