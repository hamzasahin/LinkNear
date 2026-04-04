interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

const COLORS = [
  'bg-[#00BFA6]',
  'bg-[#FF6B6B]',
  'bg-[#FFB347]',
  'bg-[#6C63FF]',
  'bg-[#3ABEFF]',
  'bg-[#FF85A1]',
  'bg-[#43D9A2]',
]

function getColorClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const sizeClass = SIZES[size]
  const colorClass = getColorClass(name)
  const initials = getInitials(name || '?')

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ring-2 ring-[var(--border)]`}
        onError={(e) => {
          const t = e.currentTarget
          t.style.display = 'none'
          t.nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white ring-2 ring-[var(--border)]`}
    >
      {initials}
    </div>
  )
}
