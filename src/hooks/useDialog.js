import { useEffect, useRef } from 'react'

// Modal accessibility helper. Attach the returned ref to the dialog's content
// box. On open it moves focus into the dialog (first field, else first button)
// and closes it when Escape is pressed. Pair with role="dialog" aria-modal.
export function useDialog(onClose) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const el = ref.current
    if (el) {
      const target = el.querySelector('input, select, textarea') || el.querySelector('button') || el
      // Defer so the element is laid out before we focus it.
      setTimeout(() => target?.focus?.(), 0)
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return ref
}
