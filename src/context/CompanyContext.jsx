import { createContext, useContext, useState, useCallback } from 'react'

// The visitor's chosen company — no login, just a preference kept on the
// device. Cadets pick their company on the boot screen the first time they
// arrive (see CompanyGate); it sticks from localStorage after that, and the
// nav / top-bar selectors let them change it later.
//
// `chosen` distinguishes "has never been asked" (no stored key) from
// "deliberately picked nothing" (stored empty string) — only the former shows
// the boot picker, so someone who skips isn't re-prompted on every visit.
const CompanyCtx = createContext(null)
export const useCompany = () =>
  useContext(CompanyCtx) || { company: '', setCompany: () => {}, chosen: true }

const KEY = '1atf-company'

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(() => {
    try { return localStorage.getItem(KEY) || '' } catch { return '' }
  })
  const [chosen, setChosen] = useState(() => {
    try { return localStorage.getItem(KEY) !== null } catch { return true }
  })
  const setCompany = useCallback((c) => {
    try { localStorage.setItem(KEY, c) } catch { /* ignore */ }
    setCompanyState(c)
    setChosen(true)
  }, [])
  return <CompanyCtx.Provider value={{ company, setCompany, chosen }}>{children}</CompanyCtx.Provider>
}
