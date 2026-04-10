import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useQuiz } from '../hooks/useQuiz'
import type { CharacterQuiz } from '../types'

// ---------- Question data ----------

interface QuizOption {
  key: string
  label: string
}

interface QuizQuestion {
  id: string
  prompt: string
  type: 'single' | 'multi'
  options: QuizOption[]
  multiCount?: number // for multi-select, how many to pick
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'When starting something new, you...',
    type: 'single',
    options: [
      { key: 'research', label: 'Research deeply first' },
      { key: 'iterate', label: 'Jump in and iterate' },
      { key: 'plan', label: 'Make a plan then execute' },
      { key: 'ask', label: 'Ask others for advice' },
    ],
  },
  {
    id: 'q2',
    prompt: 'Your ideal collaboration looks like...',
    type: 'single',
    options: [
      { key: 'brainstorm', label: 'Two people brainstorming freely' },
      { key: 'leader', label: 'One clear leader, everyone executes' },
      { key: 'independent', label: 'Everyone owns their piece independently' },
      { key: 'rotating', label: 'Rotating roles based on strengths' },
    ],
  },
  {
    id: 'q3',
    prompt: 'When you disagree with someone, you...',
    type: 'single',
    options: [
      { key: 'direct', label: 'Say it directly — clarity over comfort' },
      { key: 'diplomatic', label: 'Find diplomatic middle ground' },
      { key: 'questions', label: 'Ask questions until you understand their view' },
      { key: 'letgo', label: "Let it go unless it really matters" },
    ],
  },
  {
    id: 'q4',
    prompt: 'At a gathering of strangers, you...',
    type: 'single',
    options: [
      { key: 'energized', label: 'Energized — talk to as many as possible' },
      { key: 'selective', label: 'Selective — find 1-2 deep conversations' },
      { key: 'observer', label: 'Observer — watch first, engage when comfortable' },
      { key: 'connector', label: 'Connector — introduce others to each other' },
    ],
  },
  {
    id: 'q5',
    prompt: 'After a setback, you usually...',
    type: 'single',
    options: [
      { key: 'analyze', label: 'Analyze what went wrong immediately' },
      { key: 'process', label: 'Take time to process, then adapt' },
      { key: 'talk', label: 'Talk it through with someone' },
      { key: 'moveon', label: "Move on quickly — dwelling doesn't help" },
    ],
  },
  {
    id: 'q6',
    prompt: 'What frustrates you most in teamwork?',
    type: 'single',
    options: [
      { key: 'initiative', label: 'Lack of initiative' },
      { key: 'communication', label: 'Poor communication' },
      { key: 'ego', label: 'Ego over outcome' },
      { key: 'inconsistency', label: 'Inconsistency' },
    ],
  },
  {
    id: 'q7',
    prompt: 'You admire people who...',
    type: 'single',
    options: [
      { key: 'build', label: 'Build things from nothing' },
      { key: 'help', label: 'Dedicate themselves to helping others' },
      { key: 'master', label: 'Master a difficult craft' },
      { key: 'connect', label: 'Bring people together' },
    ],
  },
  {
    id: 'q8',
    prompt: 'The best use of your time is...',
    type: 'single',
    options: [
      { key: 'create', label: 'Creating something tangible' },
      { key: 'learn', label: 'Learning something deep' },
      { key: 'serve', label: 'Serving your community' },
      { key: 'people', label: 'Connecting with people who matter' },
    ],
  },
  {
    id: 'q9',
    prompt: 'If you had a free month with no obligations...',
    type: 'single',
    options: [
      { key: 'project', label: 'Build a project' },
      { key: 'travel', label: 'Travel and explore' },
      { key: 'volunteer', label: 'Volunteer for a cause' },
      { key: 'study', label: 'Read and study deeply' },
    ],
  },
  {
    id: 'q10',
    prompt: 'Pick your top 3 values',
    type: 'multi',
    multiCount: 3,
    options: [
      'Justice', 'Knowledge', 'Community', 'Creativity', 'Faith', 'Courage',
      'Compassion', 'Excellence', 'Freedom', 'Integrity', 'Service', 'Family',
      'Innovation', 'Patience', 'Gratitude', 'Humility', 'Perseverance', 'Generosity',
    ].map(v => ({ key: v, label: v })),
  },
]

// ---------- Style descriptions ----------

const COMM_LABELS: Record<string, string> = {
  direct: 'Direct',
  diplomatic: 'Diplomatic',
  analytical: 'Analytical',
  connector: 'Connector',
  balanced: 'Balanced',
}

const WORK_LABELS: Record<string, string> = {
  researcher: 'Researcher',
  executor: 'Executor',
  collaborator: 'Collaborator',
  independent: 'Independent',
  flexible: 'Flexible',
}

function generateDescription(commStyle: string, workStyle: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    direct: {
      researcher: 'You cut through ambiguity with clarity and back it up with thorough research before making your move.',
      executor: 'You speak plainly and act decisively. People know where they stand with you, and things get done.',
      collaborator: 'You bring honest energy to every team. Your directness paired with a collaborative spirit keeps groups aligned.',
      independent: 'You work best with autonomy and clear communication. No guessing games, just focused execution.',
      flexible: 'You adapt easily to new situations while always keeping communication clear and straightforward.',
    },
    diplomatic: {
      researcher: 'You find common ground through careful understanding. You study problems deeply before proposing solutions.',
      executor: 'You balance tact with action. You build consensus efficiently and then make it happen.',
      collaborator: 'You prefer finding common ground over conflict, and you thrive when working closely with others toward a shared goal.',
      independent: 'You navigate relationships with grace while maintaining the independence to do your best work.',
      flexible: 'You bring warmth and adaptability to every situation, smoothing the path for everyone around you.',
    },
    analytical: {
      researcher: 'You ask the right questions and dig deep. Your careful, methodical approach uncovers insights others miss.',
      executor: 'You think before you act, but when you act, it counts. A blend of careful analysis and decisive execution.',
      collaborator: 'You bring thoughtful questions to every collaboration, helping teams see problems from angles they might have missed.',
      independent: 'You prefer to understand the full picture before engaging, and you do your best thinking independently.',
      flexible: 'You adapt your approach based on careful observation, reading situations before deciding how to contribute.',
    },
    connector: {
      researcher: 'You bring people and ideas together, and you do your homework first. A bridge-builder with substance.',
      executor: 'You energize groups and get things moving. People gravitate toward your combination of warmth and drive.',
      collaborator: 'You are a natural community builder. You draw people together and help them find their shared strengths.',
      independent: 'You connect others while maintaining your own creative space. You bridge worlds without losing yourself.',
      flexible: 'You read the room and bring the right people together at the right time. A natural facilitator.',
    },
    balanced: {
      researcher: 'You take a measured approach to both communication and research, adapting your style to what each situation needs.',
      executor: 'You balance thoughtful communication with a bias toward action, adjusting your approach as needed.',
      collaborator: 'You work well with others and communicate in whatever style the moment requires.',
      independent: 'You are self-directed and adaptable, communicating clearly when it matters most.',
      flexible: 'You are genuinely adaptable, comfortable shifting your style to match whatever the situation demands.',
    },
  }

  return descriptions[commStyle]?.[workStyle] || 'You bring a unique combination of qualities to everything you do.'
}

// ---------- Component ----------

export default function QuizPage() {
  const { user } = useAuth()
  const { saveQuiz } = useQuiz()
  const navigate = useNavigate()

  const [step, setStep] = useState(0) // 0..9 = questions, 10 = results
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const [result, setResult] = useState<CharacterQuiz | null>(null)
  const [saving, setSaving] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  const currentQuestion = QUESTIONS[step]
  const totalQuestions = QUESTIONS.length
  const isResults = step >= totalQuestions

  const handleSingleSelect = useCallback((questionId: string, optionKey: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionKey }))
    // Auto-advance after a brief delay
    setTimeout(() => {
      setDirection('forward')
      if (step < totalQuestions - 1) {
        setStep(s => s + 1)
      } else {
        // Last single-select question — but Q10 is multi, so just advance
        setStep(s => s + 1)
      }
    }, 200)
  }, [step, totalQuestions])

  const handleMultiToggle = useCallback((value: string) => {
    setMultiSelected(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value)
      }
      if (prev.length >= (currentQuestion?.multiCount || 3)) {
        return prev
      }
      return [...prev, value]
    })
  }, [currentQuestion])

  const handleMultiConfirm = useCallback(async () => {
    if (!user || multiSelected.length !== (currentQuestion?.multiCount || 3)) return

    const finalAnswers = { ...answers, [currentQuestion.id]: multiSelected.join(',') }
    setAnswers(finalAnswers)
    setSaving(true)

    const { data, error } = await saveQuiz(user.id, finalAnswers)
    if (error) {
      setSaving(false)
      return
    }

    setResult(data)
    setDirection('forward')
    setStep(totalQuestions) // go to results
    setSaving(false)
  }, [user, multiSelected, answers, currentQuestion, saveQuiz, totalQuestions])

  const handleBack = useCallback(() => {
    if (step > 0) {
      setDirection('back')
      setStep(s => s - 1)
    } else {
      navigate(-1)
    }
  }, [step, navigate])

  // Derive result info for display
  const derived = result ? {
    communication_style: result.communication_style,
    work_style: result.work_style,
    core_values: result.core_values,
  } : null

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      {!isResults && (
        <header className="px-6 pt-8 pb-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            &larr; Back
          </button>
          <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {step + 1} of {totalQuestions}
          </span>
        </header>
      )}

      {/* Question / Results */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div
          className="w-full max-w-lg"
          key={step}
          style={{
            animation: direction === 'forward'
              ? 'quizSlideIn 0.3s ease-out'
              : 'quizSlideInBack 0.3s ease-out',
          }}
        >
          {isResults && derived ? (
            // ---------- Results screen ----------
            <div className="text-center">
              <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
                Your Character
              </p>
              <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-6">
                {COMM_LABELS[derived.communication_style]} {WORK_LABELS[derived.work_style]}
              </h1>
              <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-md mx-auto mb-10">
                {generateDescription(derived.communication_style, derived.work_style)}
              </p>

              <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-6 mb-8 text-left">
                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-3">
                  Your Values
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {derived.core_values.map(v => (
                    <span
                      key={v}
                      className="px-3 py-1.5 border border-[var(--accent-primary)] rounded-full text-sm text-[var(--accent-primary)]"
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-3">
                  Your Style
                </p>
                <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                  <p>{COMM_LABELS[derived.communication_style]} communicator</p>
                  <p>{WORK_LABELS[derived.work_style]} worker</p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-tertiary)] mb-8">
                This helps us find people who complement your strengths and share your values.
              </p>

              <button
                onClick={() => navigate('/discover')}
                className="text-base text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
              >
                See my matches &rarr;
              </button>
            </div>
          ) : currentQuestion?.type === 'multi' ? (
            // ---------- Multi-select (Q10) ----------
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-[var(--text-primary)] leading-[1.15] mb-2">
                {currentQuestion.prompt}
              </h2>
              <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-8">
                Select exactly {currentQuestion.multiCount}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {currentQuestion.options.map(opt => {
                  const selected = multiSelected.includes(opt.key)
                  const atLimit = multiSelected.length >= (currentQuestion.multiCount || 3)
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleMultiToggle(opt.key)}
                      disabled={!selected && atLimit}
                      className={`px-4 py-2 rounded-full border text-sm transition-all ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                          : atLimit
                          ? 'border-[var(--border)] text-[var(--text-tertiary)] opacity-40 cursor-not-allowed'
                          : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={handleMultiConfirm}
                disabled={multiSelected.length !== (currentQuestion.multiCount || 3) || saving}
                className="text-base text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Saving...' : 'See my results \u2192'}
              </button>
            </div>
          ) : currentQuestion ? (
            // ---------- Single-select ----------
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-[var(--text-primary)] leading-[1.15] mb-8">
                {currentQuestion.prompt}
              </h2>
              <div className="space-y-3">
                {currentQuestion.options.map(opt => {
                  const selected = answers[currentQuestion.id] === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSingleSelect(currentQuestion.id, opt.key)}
                      className={`w-full text-left px-5 py-4 border rounded-[var(--radius-md)] text-sm transition-all ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 text-[var(--text-primary)]'
                          : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline animation styles */}
      <style>{`
        @keyframes quizSlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes quizSlideInBack {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
