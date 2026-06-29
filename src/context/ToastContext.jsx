import { createContext, useContext, useState, useCallback } from 'react'

// Lightweight toast notifications. useToast().push('Saved', { type }) where type
// is 'success' | 'error' | 'info'. Returns a safe no-op if used without a
// provider, so callers never need to guard.
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx) || { push: () => {} }

let counter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, opts = {}) => {
    const id = ++counter
    const type = opts.type || 'success'
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.ttl ?? 3200)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '90vw' }}
      >
        {toasts.map((t) => {
          const accent = t.type === 'error' ? 'var(--hostile)' : 'var(--accent)'
          return (
            <div
              key={t.id}
              role="status"
              className="panel panel-pad mono"
              style={{ borderColor: accent, fontSize: 12, minWidth: 220, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
            >
              <span style={{ color: accent }}>{t.type === 'error' ? '✕' : '✓'}</span>
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
