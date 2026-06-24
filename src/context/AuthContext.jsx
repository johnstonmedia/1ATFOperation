import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { FIREBASE_ENABLED, auth, db } from '../firebase/config'
import { useData } from './DataContext'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const LS_USER = '1atf-current-user'

// Bootstrap administrator: this ID can always claim an RHQ account, even before
// any roster has been imported (solves the empty-backend chicken-and-egg).
const ADMIN_ID = '190990'
const ADMIN_PROFILE = {
  name: 'Unit Administrator',
  rank: 'RHQ',
  company: 'S',
  role: 'RHQ',
  email: '',
}

// Members sign in with their ID number, not an email. Firebase Auth requires an
// email, so we synthesise a stable one from the ID number.
function idToEmail(idNumber) {
  const clean = String(idNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return `id-${clean}@1atf.unit`
}

// Find the roster record provisioned by RHQ (spreadsheet import / Users admin).
function matchRoster(roster, idNumber) {
  if (!roster) return null
  return roster.find((r) => String(r.idNumber).trim() === String(idNumber).trim()) || null
}

// Build an account profile from a roster record.
function profileFromRoster(idNumber, r) {
  return {
    idNumber: String(idNumber).trim(),
    email: r.email || '',
    name: r.name || 'Unnamed',
    rank: r.rank || 'Cadet',
    company: r.company || '',
    role: r.role || 'General',
    linked: true,
  }
}

export function AuthProvider({ children }) {
  const { state } = useData()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // --- LOCAL MODE: restore session from localStorage ---
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

  // --- FIREBASE MODE: subscribe to auth + profile ---
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
          // if no profile yet, signIn() is mid-claim and will set it
        } else {
          setUser(null)
        }
        setReady(true)
      })
    })()
    return () => unsub()
  }, [])

  // First login with a roster ID claims the account and sets its password.
  // Subsequent logins verify that password. Unknown IDs are rejected.
  const signIn = useCallback(
    async ({ idNumber, password }) => {
      const id = String(idNumber || '').trim()
      if (!id || !password) throw new Error('Enter your ID number and a password.')

      if (FIREBASE_ENABLED) {
        const {
          signInWithEmailAndPassword,
          createUserWithEmailAndPassword,
          deleteUser,
        } = await import('firebase/auth')
        const { doc, getDoc, setDoc } = await import('firebase/firestore')
        const authEmail = idToEmail(id)

        // 1) Existing account? Try to sign in.
        try {
          await signInWithEmailAndPassword(auth, authEmail, password)
          return // profile loaded by onAuthStateChanged
        } catch {
          /* not found or wrong password — fall through to claim attempt */
        }

        // 2) Claim attempt: create the auth account.
        let cred
        try {
          cred = await createUserWithEmailAndPassword(auth, authEmail, password)
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            throw new Error('Incorrect password for this ID number.')
          }
          throw e
        }

        // 3) Must correspond to a provisioned roster record (or be the admin).
        const snap = await getDoc(doc(db, 'roster', id))
        let profile
        if (snap.exists()) {
          profile = profileFromRoster(id, snap.data())
        } else if (id === ADMIN_ID) {
          profile = { idNumber: id, ...ADMIN_PROFILE, linked: true }
        } else {
          await deleteUser(cred.user) // roll back the unauthorised account
          throw new Error('ID number not recognised. Contact RHQ.')
        }
        await setDoc(doc(db, 'users', cred.user.uid), profile)
        setUser({ uid: cred.user.uid, ...profile })
        return
      }

      // ---- LOCAL MODE ----
      const existing = readLocalUsers()[id.toLowerCase()]
      if (existing) {
        if (existing.password !== password) throw new Error('Incorrect password for this ID number.')
        localStorage.setItem(LS_USER, JSON.stringify(existing.profile))
        setUser(existing.profile)
        return
      }
      // First login — claim if the ID is on the roster (or is the admin).
      const matched = matchRoster(state?.roster, id)
      let base
      if (matched) base = profileFromRoster(id, matched)
      else if (id === ADMIN_ID) base = { idNumber: id, ...ADMIN_PROFILE, linked: true }
      else throw new Error('ID number not recognised. Contact RHQ.')
      const profile = { uid: 'local-' + id, ...base }
      saveLocalUser(id, password, profile)
      localStorage.setItem(LS_USER, JSON.stringify(profile))
      setUser(profile)
    },
    [state],
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

  const value = { user, ready, signIn, logout, isRHQ: user?.role === 'RHQ' }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ---- local-mode credential store (preview only; keyed by ID number) ---- */
const LS_USERS = '1atf-local-users'
function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || '{}')
  } catch {
    return {}
  }
}
function saveLocalUser(idNumber, password, profile) {
  const all = readLocalUsers()
  all[String(idNumber).toLowerCase()] = { password, profile }
  localStorage.setItem(LS_USERS, JSON.stringify(all))
}
