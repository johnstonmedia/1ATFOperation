import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { FIREBASE_ENABLED, auth, db } from '../firebase/config'
import { useData } from './DataContext'
import { getAuthVersion } from '../lib/store'
import { appError } from '../lib/errors'

// Firebase reports both "no such account" and "wrong password" as these codes
// (email-enumeration protection). Only these fall through to the claim path;
// anything else (network, internal, config) propagates so it can be reported.
const isMissingAccount = (e) =>
  ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(e?.code)

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const LS_USER = '1atf-current-user'

// Bootstrap administrator: signs in directly (no temporary password), even
// before any roster has been imported.
const ADMIN_ID = '190990'
const ADMIN_PROFILE = { name: 'Unit Administrator', company: 'S', role: 'RHQ', email: '', rank: '' }

const cleanId = (id) => String(id).trim().toLowerCase().replace(/[^a-z0-9]/g, '')

// Members sign in with their ID number; Firebase Auth needs an email, so we
// synthesise one. A version > 0 (bumped on password reset) yields a fresh
// address so a reset effectively re-issues the account.
function idToEmail(id, version = 0) {
  const c = cleanId(id)
  return version > 0 ? `id-${c}.v${version}@1atf.unit` : `id-${c}@1atf.unit`
}

function matchRoster(roster, idNumber) {
  if (!roster) return null
  return roster.find((r) => String(r.idNumber).trim() === String(idNumber).trim()) || null
}

function profileFromRoster(idNumber, r) {
  return {
    idNumber: String(idNumber).trim(),
    email: r.email || '',
    name: r.name || 'Unnamed',
    rank: r.rank || '',
    company: r.company || '',
    role: r.role || 'General',
    linked: true,
  }
}

export function AuthProvider({ children }) {
  const { state, reload, append } = useData()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (FIREBASE_ENABLED) return
    try {
      const raw = localStorage.getItem(LS_USER)
      if (raw) setUser(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!FIREBASE_ENABLED) return
    let unsub = () => {}
    ;(async () => {
      const { onAuthStateChanged } = await import('firebase/auth')
      const { doc, getDoc } = await import('firebase/firestore')
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const snap = await getDoc(doc(db, 'users', fbUser.uid))
          if (snap.exists()) setUser({ uid: fbUser.uid, ...snap.data() })
          reload()
        } else {
          setUser(null)
          reload()
        }
        setReady(true)
      })
    })()
    return () => unsub()
  }, [])

  // Ensure the bootstrap admin appears in the roster (so they show in Users).
  const ensureAdminRoster = useCallback(async (id) => {
    if (!FIREBASE_ENABLED) return
    try {
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'roster', 'rhq-admin'), {
        _id: 'rhq-admin', idNumber: id, name: ADMIN_PROFILE.name,
        company: 'S', role: 'RHQ', email: '', rank: '', tempPassword: '',
      })
    } catch {
      /* non-fatal */
    }
  }, [])

  // Returning members (and the admin's first sign-in) authenticate here.
  const signIn = useCallback(
    async ({ idNumber, password, remember = true }) => {
      const id = String(idNumber || '').trim()
      if (!id || !password) throw appError('VALIDATION', 'Enter your ID number and password.')
      const version = await getAuthVersion(cleanId(id))

      if (FIREBASE_ENABLED) {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } = await import('firebase/auth')
        const { doc, setDoc } = await import('firebase/firestore')
        // "Keep me signed in" → persist across sessions; otherwise clear on close.
        try { await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence) } catch { /* non-fatal */ }
        const authEmail = idToEmail(id, version)
        try {
          await signInWithEmailAndPassword(auth, authEmail, password)
          if (id === ADMIN_ID) await ensureAdminRoster(id)
          return
        } catch (e) {
          if (!isMissingAccount(e)) throw e // network / config / internal -> report
          /* else fall through: no account yet, or wrong password */
        }
        if (id === ADMIN_ID) {
          try {
            const cred = await createUserWithEmailAndPassword(auth, authEmail, password)
            const profile = { idNumber: id, ...ADMIN_PROFILE, linked: true }
            await setDoc(doc(db, 'users', cred.user.uid), profile)
            await ensureAdminRoster(id)
            setUser({ uid: cred.user.uid, ...profile })
            return
          } catch (e) {
            if (e.code === 'auth/email-already-in-use') throw appError('BAD_PASSWORD', 'Incorrect password.')
            throw e
          }
        }
        throw appError('NO_ACCOUNT', 'No account found.')
      }

      // ---- LOCAL MODE ----
      const key = `${id.toLowerCase()}:v${version}`
      const existing = readLocalUsers()[key]
      if (existing) {
        if (existing.password !== password) throw appError('BAD_PASSWORD', 'Incorrect password.')
        localStorage.setItem(LS_USER, JSON.stringify(existing.profile))
        setUser(existing.profile)
        return
      }
      if (id === ADMIN_ID) {
        const profile = { uid: 'local-' + id, idNumber: id, ...ADMIN_PROFILE, linked: true }
        saveLocalUser(key, password, profile)
        localStorage.setItem(LS_USER, JSON.stringify(profile))
        setUser(profile)
        return
      }
      throw appError('NO_ACCOUNT', 'No account found.')
    },
    [ensureAdminRoster],
  )

  // First-time setup / post-reset: validate the issued temporary password and
  // set the member's own password.
  const register = useCallback(
    async ({ idNumber, tempPassword, newPassword }) => {
      const id = String(idNumber || '').trim()
      const temp = String(tempPassword || '').trim()
      if (!id || !temp || !newPassword) throw appError('VALIDATION', 'Fill in every field.')
      if (newPassword.length < 6) throw appError('VALIDATION', 'New password must be at least 6 characters.')
      const version = await getAuthVersion(cleanId(id))

      if (FIREBASE_ENABLED) {
        const { createUserWithEmailAndPassword, deleteUser } = await import('firebase/auth')
        const { doc, setDoc, collection, query, where, getDocs } = await import('firebase/firestore')
        const authEmail = idToEmail(id, version)
        let cred
        try {
          cred = await createUserWithEmailAndPassword(auth, authEmail, newPassword)
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') throw appError('ALREADY_REG', 'Already registered.')
          throw e
        }
        const qs = await getDocs(query(collection(db, 'roster'), where('idNumber', '==', id)))
        const rec = qs.docs[0]?.data()
        const valid = (rec && String(rec.tempPassword || '') === temp) || id === ADMIN_ID
        if (!valid) {
          await deleteUser(cred.user)
          throw appError('BAD_TEMP', 'Invalid temporary password.')
        }
        const profile = rec ? profileFromRoster(id, rec) : { idNumber: id, ...ADMIN_PROFILE, linked: true }
        await setDoc(doc(db, 'users', cred.user.uid), profile)
        if (id === ADMIN_ID) await ensureAdminRoster(id)
        setUser({ uid: cred.user.uid, ...profile })
        return
      }

      // ---- LOCAL MODE ----
      const key = `${id.toLowerCase()}:v${version}`
      if (readLocalUsers()[key]) throw appError('ALREADY_REG', 'Already registered.')
      const matched = matchRoster(state?.roster, id)
      const valid = (matched && String(matched.tempPassword || '') === temp) || id === ADMIN_ID
      if (!valid) throw appError('BAD_TEMP', 'Invalid temporary password.')
      const base = matched ? profileFromRoster(id, matched) : { idNumber: id, ...ADMIN_PROFILE, linked: true }
      const profile = { uid: 'local-' + id, ...base }
      saveLocalUser(key, newPassword, profile)
      localStorage.setItem(LS_USER, JSON.stringify(profile))
      setUser(profile)
    },
    [state, ensureAdminRoster],
  )

  // Raise a forgotten-password request for RHQ to action.
  const forgotPassword = useCallback(
    async ({ idNumber }) => {
      const id = String(idNumber || '').trim()
      if (!id) throw appError('VALIDATION', 'Enter your ID number.')
      await append('resetRequests', { idNumber: id, ts: Date.now(), status: 'open' })
    },
    [append],
  )

  const logout = useCallback(async () => {
    if (FIREBASE_ENABLED) {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    } else {
      localStorage.removeItem(LS_USER)
      setUser(null)
    }
  }, [])

  const value = { user, ready, signIn, register, forgotPassword, logout, isRHQ: user?.role === 'RHQ' }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ---- local-mode credential store (preview only; keyed by ID + version) ---- */
const LS_USERS = '1atf-local-users'
function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || '{}')
  } catch {
    return {}
  }
}
function saveLocalUser(key, password, profile) {
  const all = readLocalUsers()
  all[key] = { password, profile }
  localStorage.setItem(LS_USERS, JSON.stringify(all))
}
