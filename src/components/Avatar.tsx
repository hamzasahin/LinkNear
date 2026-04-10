import { useState, useEffect } from 'react'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  revealed?: boolean // if false, always show initials regardless of src
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

// Warm editorial palette — no bright colors, avatars read as portraits
const COLORS = [
  'bg-[#3d3733]',
  'bg-[#494440]',
  'bg-[#706a64]',
  'bg-[#8a7a68]',
  'bg-[#a08b76]',
]

function getColorClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Round avatar with a deterministic color + initials fallback. If the image
 * fails to load (404, CORS error, etc.), switches to the initials tile via
 * an error state — previous implementation used `display: none` + a
 * `nextElementSibling` that never actually rendered.
 */
export default function Avatar({ src, name, size = 'md', revealed = true }: AvatarProps) {
  const sizeClass = SIZES[size]
  const colorClass = getColorClass(name)
  const initials = getInitials(name || '?')
  const [hasError, setHasError] = useState(false)

  // Reset error state when `src` changes so a new avatar gets a fresh load attempt.
  useEffect(() => {
    setHasError(false)
  }, [src])

  if (src && !hasError && revealed) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ring-1 ring-[var(--border-strong)]`}
        onError={() => setHasError(true)}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center flex-shrink-0 font-medium text-[var(--bg-primary)] ring-1 ring-[var(--border-strong)]`}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
