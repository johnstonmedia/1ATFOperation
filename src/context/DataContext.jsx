import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { loadState, persistSlice, appendItem, stashPending, flushPending, makeId, isContentSlice } from '../lib/store'
import { recordBackup } from '../lib/backups'
import { classify, buildReport } from '../lib/errors'
import { notifyAdmin } from '../lib/notify'

const DataContext = createContext(null)
export const useData = () => useContext(DataContext)

export function DataProvider({ children }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  // Mirror of `state` for callbacks that must read the CURRENT value without
  // taking state as a dependency (updateSlice is intentionally stable).
  const stateRef = useRef(null)
  // Who to attribute a backup to. AuthContext is mounted inside this provider,
  // so it pushes the signed-in user down rather than us reaching up for it.
  const actorRef = useRef({ by: '', byId: '' })
  const setBackupActor = useCallback((by, byId) => { actorRef.current = { by: by || '', byId: byId || '' } }, [])

  useEffect(() => {
    loadState().then((s) => {
      stateRef.current = s
      setState(s)
      setLoading(false)
    })
    flushPending() // resend any reports captured while offline
  }, [])

  // Re-fetch everything. Called after sign-in/out so protected collections
  // (roster/tasks/activity) appear once the user is authorised to read them.
  const reload = useCallback(async () => {
    const s = await loadState()
    stateRef.current = s
    setState(s)
  }, [])

  const updateSlice = useCallback(async (slice, value) => {
    // Version history: file the value we are ABOUT to overwrite, so every save
    // leaves a restore point behind (see lib/backups.js). Fire-and-forget and
    // internally swallowed — a backup must never be what stops RHQ saving.
    // Skipped when nothing actually changed, so repeated Saves don't pile up
    // identical entries.
    const prevValue = stateRef.current?.[slice]
    if (isContentSlice(slice) && prevValue !== undefined
        && JSON.stringify(prevValue) !== JSON.stringify(value)) {
      recordBackup({ slice, value: prevValue, ...actorRef.current })
    }
    setState((prev) => {
      const next = { ...prev, [slice]: value }
      // Stamp "last updated" for operational content so the UI can show freshness.
      if (isContentSlice(slice)) {
        next.contentMeta = { ...prev.contentMeta, [slice]: { updatedAt: Date.now() } }
      }
      stateRef.current = next
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
      setState((prev) => {
        if (!prev) return prev
        const next = { ...prev, audit: [...(prev.audit || []), { id: makeId(), ...record }] }
        stateRef.current = next
        return next
      })
    } catch {
      /* audit is best-effort; ignore failures */
    }
  }, [])

  // Roster edits are deliberately NOT versioned — see the header of
  // lib/backups.js: it is the one collection carrying personal data, and
  // copying it on every edit would multiply that exposure for no gain.
  const replaceRoster = useCallback(async (rows) => {
    setState((prev) => {
      const next = { ...prev, roster: rows }
      stateRef.current = next
      persistSlice(next, 'roster')
      return next
    })
  }, [])

  // Append to an inbox collection (support / resetRequests). Works for
  // anonymous submitters who can create but not list the collection.
  const append = useCallback(async (coll, item) => {
    await appendItem(coll, item)
    setState((prev) => {
      if (!prev) return prev
      const next = { ...prev, [coll]: [...(prev[coll] || []), { id: makeId(), ...item }] }
      stateRef.current = next
      return next
    })
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

  const value = { state, loading, updateSlice, replaceRoster, append, reportError, reload, makeId, logAudit, setBackupActor }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
