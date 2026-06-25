import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { FIREBASE_ENABLED, auth, db } from '../firebase/config'
import { useData } from './DataContext'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const LS_USER = '1atf-current-user'

// Bootstrap administrator: can sign in directly (no temporary password needed),
// even before any roster has been imported.
const ADMIN_ID = '190990'
const ADMIN_PROFILE = { name: 'Unit Administrator', company: 'S', role: 'RHQ', email: '', rank: '' }

// Members sign in with their ID number; Firebase Auth needs an email, so we
// synthesise a stable one from the ID.
function idToEmail(idNumber) {
  const clean = String(idNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return `id-${clean}@1atf.unit`
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
  const { state, reload } = useData()
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
          reload() // now authorised to read roster/tasks/activity
        } else {
          setUser(null)
          reload() // back to public view
        }
        setReady(true)
      })
    })()
    return () => unsub()
  }, [])

  // Returning users (and the bootstrap admin's first login) sign in here.
  const signIn = useCallback(
    async ({ idNumber, password }) => {
      const id = String(idNumber || '').trim()
      if (!id || !password) throw new Error('Enter your ID number and password.')

      if (FIREBASE_ENABLED) {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth')
        const { doc, setDoc } = await import('firebase/firestore')
        const authEmail = idToEmail(id)
        try {
          await signInWithEmailAndPassword(auth, authEmail, password)
          return
        } catch {
          /* no account yet, or wrong password */
        }
        if (id === ADMIN_ID) {
          // Bootstrap: create the admin account on first sign-in.
          try {
            const cred = await createUserWithEmailAndPassword(auth, authEmail, password)
            const profile = { idNumber: id, ...ADMIN_PROFILE, linked: true }
            await setDoc(doc(db, 'users', cred.user.uid), profile)
            setUser({ uid: cred.user.uid, ...profile })
            return
          } catch (e) {
            if (e.code === 'auth/email-already-in-use') throw new Error('Incorrect password.')
            throw e
          }
        }
        throw new Error('No account found. Register with your temporary password first.')
      }

      // ---- LOCAL MODE ----
      const existing = readLocalUsers()[id.toLowerCase()]
      if (existing) {
        if (existing.password !== password) throw new Error('Incorrect password.')
        localStorage.setItem(LS_USER, JSON.stringify(existing.profile))
        setUser(existing.profile)
        return
      }
      if (id === ADMIN_ID) {
        const profile = { uid: 'local-' + id, idNumber: id, ...ADMIN_PROFILE, linked: true }
        saveLocalUser(id, password, profile)
        localStorage.setItem(LS_USER, JSON.stringify(profile))
        setUser(profile)
        return
      }
      throw new Error('No account found. Register with your temporary password first.')
    },
    [],
  )

  // Registration via the Classified landing page: validate the issued temporary
  // password against the roster, then set the member's own password.
  const register = useCallback(
    async ({ idNumber, tempPassword, newPassword }) => {
      const id = String(idNumber || '').trim()
      const temp = String(tempPassword || '').trim()
      if (!id || !temp || !newPassword) throw new Error('Fill in every field.')
      if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.')

      if (FIREBASE_ENABLED) {
        const { createUserWithEmailAndPassword, deleteUser } = await import('firebase/auth')
        const { doc, setDoc, collection, query, where, getDocs } = await import('firebase/firestore')
        const authEmail = idToEmail(id)

        let cred
        try {
          cred = await createUserWithEmailAndPassword(auth, authEmail, newPassword)
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            throw new Error('This ID is already registered. Use Sign in instead.')
          }
          throw e
        }
        // Now signed in -> we may read the roster to verify the temp password.
        const qs = await getDocs(query(collection(db, 'roster'), where('idNumber', '==', id)))
        const rec = qs.docs[0]?.data()
        const valid = (rec && String(rec.tempPassword || '') === temp) || id === ADMIN_ID
        if (!valid) {
          await deleteUser(cred.user) // roll back unauthorised account
          throw new Error('Invalid ID number or temporary password.')
        }
        const profile = rec
          ? profileFromRoster(id, rec)
          : { idNumber: id, ...ADMIN_PROFILE, linked: true }
        await setDoc(doc(db, 'users', cred.user.uid), profile)
        setUser({ uid: cred.user.uid, ...profile })
        return
      }

      // ---- LOCAL MODE ----
      if (readLocalUsers()[id.toLowerCase()]) {
        throw new Error('This ID is already registered. Use Sign in instead.')
      }
      const matched = matchRoster(state?.roster, id)
      const valid = (matched && String(matched.tempPassword || '') === temp) || id === ADMIN_ID
      if (!valid) throw new Error('Invalid ID number or temporary password.')
      const base = matched ? profileFromRoster(id, matched) : { idNumber: id, ...ADMIN_PROFILE, linked: true }
      const profile = { uid: 'local-' + id, ...base }
      saveLocalUser(id, newPassword, profile)
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

  const value = { user, ready, signIn, register, logout, isRHQ: user?.role === 'RHQ' }
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
