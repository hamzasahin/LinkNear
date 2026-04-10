import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed at bottom center */}
      <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-[var(--bg-primary)] border px-4 py-3 rounded-[var(--radius-md)] text-sm animate-fade-in shadow-sm ${
              toast.type === 'success'
                ? 'border-[var(--success)] text-[var(--success)]'
                : toast.type === 'error'
                ? 'border-[var(--danger)] text-[var(--danger)]'
                : 'border-[var(--border-strong)] text-[var(--text-primary)]'
            }`}
          >
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em] mr-2">
              {toast.type === 'success' ? 'OK' : toast.type === 'error' ? 'Err' : '\u00b7'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) return { showToast: () => {} }
  return ctx
}
