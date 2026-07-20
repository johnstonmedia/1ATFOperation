import { createContext, useContext, useState, useCallback } from 'react'

// The visitor's chosen company — no login, just a preference kept on the device.
// Cadets pick their company to see that company's intel fragments.
const CompanyCtx = createContext(null)
export const useCompany = () => useContext(CompanyCtx) || { company: '', setCompany: () => {} }

const KEY = '1atf-company'

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(() => {
    try { return localStorage.getItem(KEY) || '' } catch { return '' }
  })
  const setCompany = useCallback((c) => {
    try { localStorage.setItem(KEY, c) } catch { /* ignore */ }
    setCompanyState(c)
  }, [])
  return <CompanyCtx.Provider value={{ company, setCompany }}>{children}</CompanyCtx.Provider>
}
