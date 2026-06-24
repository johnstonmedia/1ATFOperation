import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { FIREBASE_ENABLED, auth, db } from '../firebase/config'
import { useData } from './DataContext'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const LS_USER = '1atf-current-user'

// Members sign in with their ID number, not an email. Firebase Auth requires an
// email, so we synthesise a stable one from the ID number. The real email (if
// any) lives on the profile/roster for contact + secondary matching.
function idToEmail(idNumber) {
  const clean = String(idNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return `id-${clean}@1atf.unit`
}

// Match a freshly-registered account against the roster so it inherits the
// rank/company/role provisioned by RHQ. Matches on ID number first, then email.
function matchRoster(roster, { idNumber, email }) {
  if (!roster) return null
  const byId = idNumber && roster.find((r) => String(r.idNumber) === String(idNumber))
  if (byId) return byId
  const byEmail = email && roster.find((r) => (r.email || '').toLowerCase() === String(email).toLowerCase())
  return byEmail || null
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
          const profile = snap.exists() ? snap.data() : {}
          setUser({ uid: fbUser.uid, ...profile })
        } else {
          setUser(null)
        }
        setReady(true)
      })
    })()
    return () => unsub()
  }, [])

  const register = useCallback(
    async ({ idNumber, password, email }) => {
      const matched = matchRoster(state?.roster, { idNumber, email })
      const profile = {
        idNumber: idNumber || matched?.idNumber || '',
        email: email || matched?.email || '',
        name: matched?.name || 'Unassigned Cadet',
        rank: matched?.rank || 'Cadet',
        company: matched?.company || '',
        role: matched?.role || 'General',
        linked: Boolean(matched),
      }
      const authEmail = idToEmail(idNumber)
      if (FIREBASE_ENABLED) {
        const { createUserWithEmailAndPassword } = await import('firebase/auth')
        const { doc, setDoc } = await import('firebase/firestore')
        const cred = await createUserWithEmailAndPassword(auth, authEmail, password)
        await setDoc(doc(db, 'users', cred.user.uid), profile)
        setUser({ uid: cred.user.uid, ...profile })
      } else {
        const u = { uid: 'local-' + idNumber, ...profile }
        saveLocalUser(idNumber, password, u)
        localStorage.setItem(LS_USER, JSON.stringify(u))
        setUser(u)
      }
      return profile
    },
    [state],
  )

  const login = useCallback(async ({ idNumber, password }) => {
    if (FIREBASE_ENABLED) {
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(auth, idToEmail(idNumber), password)
    } else {
      const u = verifyLocalUser(idNumber, password)
      if (!u) throw new Error('Invalid ID number or password')
      localStorage.setItem(LS_USER, JSON.stringify(u))
      setUser(u)
    }
  }, [])

  const logout = useCallback(async () => {
    if (FIREBASE_ENABLED) {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    } else {
      localStorage.removeItem(LS_USER)
      setUser(null)
    }
  }, [])

  const value = { user, ready, register, login, logout, isRHQ: user?.role === 'RHQ' }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ---- local-mode credential helpers (preview only; keyed by ID number) ---- */
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
function verifyLocalUser(idNumber, password) {
  const all = readLocalUsers()
  const rec = all[String(idNumber).toLowerCase()]
  if (rec && rec.password === password) return rec.profile
  return null
}
