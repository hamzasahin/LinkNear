import { useState, useRef, type KeyboardEvent } from 'react'
import TagChip from './TagChip'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  placeholder: string
  variant?: 'skill' | 'interest'
}

export default function TagInput({ tags, onChange, suggestions, placeholder, variant = 'skill' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions.filter(s =>
    s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  ).slice(0, 8)

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="relative">
      <div
        className="min-h-[52px] flex flex-wrap gap-2 items-center p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition-all cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <TagChip key={tag} label={tag} variant={variant} onRemove={() => removeTag(tag)} />
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm outline-none"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl z-20 overflow-hidden">
          {filteredSuggestions.map(s => (
            <button
              key={s}
              onMouseDown={() => addTag(s)}
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-tertiary)] mt-1">Press Enter or comma to add</p>
    </div>
  )
}
