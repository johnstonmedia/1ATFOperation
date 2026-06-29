import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadState, persistSlice, appendItem, stashPending, flushPending, makeId, isContentSlice } from '../lib/store'
import { classify, buildReport } from '../lib/errors'
import { notifyAdmin } from '../lib/notify'

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
    flushPending() // resend any reports captured while offline
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
      // Stamp "last updated" for operational content so the UI can show freshness.
      if (isContentSlice(slice)) {
        next.contentMeta = { ...prev.contentMeta, [slice]: { updatedAt: Date.now() } }
      }
      persistSlice(next, slice)
      return next
    })
  }, [])

  // Append an immutable audit entry (RHQ actions). Best-effort: never blocks the
  // action it records. The actor is supplied by the caller (see useAudit).
  const logAudit = useCallback(async (entry) => {
    const record = { action: '', detail: '', by: '', byId: '', ...entry, ts: Date.now() }
    try {
      await appendItem('audit', record)
      setState((prev) => (prev ? { ...prev, audit: [...(prev.audit || []), { id: makeId(), ...record }] } : prev))
    } catch {
      /* audit is best-effort; ignore failures */
    }
  }, [])

  const replaceRoster = useCallback(async (rows) => {
    setState((prev) => {
      const next = { ...prev, roster: rows }
      persistSlice(next, 'roster')
      return next
    })
  }, [])

  // Append to an inbox collection (support / resetRequests). Works for
  // anonymous submitters who can create but not list the collection.
  const append = useCallback(async (coll, item) => {
    await appendItem(coll, item)
    setState((prev) => (prev ? { ...prev, [coll]: [...(prev[coll] || []), { id: makeId(), ...item }] } : prev))
  }, [])

  // Classify an error and, if it's a genuine technical fault, auto-dispatch a
  // detailed Help request (Support or Account Issue) for RHQ. Returns the
  // classification so the UI can show a friendly message + code.
  const reportError = useCallback(async (err, context, extra = {}) => {
    const info = classify(err)
    if (info.reportable) {
      const record = {
        category: info.category,
        name: 'SYSTEM (auto-report)',
        contact: extra.idNumber || '',
        message: buildReport(info, context, extra),
        code: info.code,
        auto: true,
        ts: Date.now(),
        status: 'open',
      }
      try {
        await append('support', record)
      } catch {
        stashPending(record) // network down — send on next load
      }
      notifyAdmin(`[${info.code}] ${context}`, record.message)
    }
    return info
  }, [append])

  const value = { state, loading, updateSlice, replaceRoster, append, reportError, reload, makeId, logAudit }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
