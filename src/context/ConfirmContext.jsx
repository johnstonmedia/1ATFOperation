import { createContext, useContext, useState, useCallback, useRef } from 'react'

// Promise-based confirmation dialog, so destructive actions can do:
//   if (await confirm({ title, message, danger: true })) { ...delete... }
// Falls back to window.confirm if used without a provider.
const ConfirmCtx = createContext(null)
export const useConfirm = () =>
  useContext(ConfirmCtx) || (async (o) => window.confirm(typeof o === 'string' ? o : o?.message || 'Are you sure?'))

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setOpts(typeof o === 'string' ? { message: o } : o || {})
      }),
    [],
  )

  const close = (val) => {
    setOpts(null)
    const r = resolver.current
    resolver.current = null
    r?.(val)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          onClick={() => close(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(2,4,9,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div className="panel panel-pad col" onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '100%', gap: 14 }}>
            <h2 className={opts.danger ? 'hostile' : 'accent'} style={{ margin: 0, fontSize: 17 }}>{opts.title || 'Please confirm'}</h2>
            <div className="mono" style={{ fontSize: 13 }}>{opts.message || 'Are you sure?'}</div>
            <div className="row between" style={{ marginTop: 4 }}>
              <button className="ghost" onClick={() => close(false)}>{opts.cancelLabel || 'Cancel'}</button>
              <button className={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{opts.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
