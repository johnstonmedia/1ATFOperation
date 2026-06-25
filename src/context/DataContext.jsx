import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadState, persistSlice, makeId } from '../lib/store'

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

  // Re-fetch everything. Called after sign-in/out so protected collections
  // (roster/tasks/activity) appear once the user is authorised to read them.
  const reload = useCallback(async () => {
    const s = await loadState()
    setState(s)
  }, [])

  const updateSlice = useCallback(async (slice, value) => {
    setState((prev) => {
      const next = { ...prev, [slice]: value }
      persistSlice(next, slice)
      return next
    })
  }, [])

  const replaceRoster = useCallback(async (rows) => {
    setState((prev) => {
      const next = { ...prev, roster: rows }
      persistSlice(next, 'roster')
      return next
    })
  }, [])

  const value = { state, loading, updateSlice, replaceRoster, reload, makeId }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
