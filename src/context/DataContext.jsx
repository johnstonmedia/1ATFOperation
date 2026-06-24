import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadState, persistSlice, upsertRoster, makeId } from '../lib/store'

const DataContext = createContext(null)
export const useData = () => useContext(DataContext)

export function DataProvider({ children }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadState().then((s) => {
      setState(s)
      setLoading(false)
    })
  }, [])

  // Update a slice in memory and persist it to the backend.
  const updateSlice = useCallback(async (slice, value) => {
    setState((prev) => {
      const next = { ...prev, [slice]: value }
      persistSlice(next, slice)
      return next
    })
  }, [])

  // Replace the entire roster (used by spreadsheet import).
  const replaceRoster = useCallback(async (rows) => {
    setState((prev) => {
      const next = { ...prev, roster: rows }
      upsertRoster(next, rows)
      return next
    })
  }, [])

  const value = { state, loading, updateSlice, replaceRoster, makeId }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
