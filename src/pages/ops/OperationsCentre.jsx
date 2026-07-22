import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Logo from '../../components/Logo'
import LastUpdated from '../../components/LastUpdated'
import NarrativeEditor from './NarrativeEditor'
import MapEditor from './MapEditor'
import BriefingsEditor from './BriefingsEditor'
import ClassifiedEditor from './ClassifiedEditor'
import BrandingEditor from './BrandingEditor'
import IntelEditor from './IntelEditor'
import UsersAdmin from './UsersAdmin'
import HelpAdmin from './HelpAdmin'
import AuditLog from './AuditLog'
import LoginModal from '../../components/LoginModal'

const SECTIONS = [
  { id: 'narrative', label: 'Map: Narrative', group: 'MAP PAGE' },
  { id: 'map', label: 'Map: Territory', group: 'MAP PAGE' },
  { id: 'intel', label: 'Intercepted Intelligence', group: 'CONTENT' },
  { id: 'briefings', label: 'Briefings', group: 'CONTENT' },
  { id: 'classified', label: 'Welcome Page', group: 'CONTENT' },
  { id: 'branding', label: 'Branding & Assets', group: 'CONTENT' },
  { id: 'users', label: 'Users', group: 'ADMIN' },
  { id: 'help', label: 'Help', group: 'ADMIN' },
  { id: 'audit', label: 'Audit Log', group: 'ADMIN' },
]

export default function OperationsCentre() {
  const { user, isRHQ, logout } = useAuth()
  const [section, setSection] = useState('map')
  const [authOpen, setAuthOpen] = useState(false)

  // Gate: RHQ only. URL-only page — not linked from the main navigation.
  if (!user || !isRHQ) {
    return (
      <div className="col center" style={{ minHeight: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <Logo size={90} />
        <div className="head hostile" style={{ letterSpacing: 3 }}>OPERATIONS CENTRE</div>
        <div className="mono dim" style={{ fontSize: 12, maxWidth: 420 }}>
          {user
            ? 'Your clearance does not authorise access to the Operations Centre. RHQ personnel only.'
            : 'RHQ authentication required to access the Operations Centre.'}
        </div>
        {!user && <button className="primary" onClick={() => setAuthOpen(true)}>Authenticate</button>}
        <Link to="/" className="mono dim" style={{ fontSize: 11 }}>← Return to portal</Link>
        {authOpen && <LoginModal onClose={() => setAuthOpen(false)} />}
      </div>
    )
  }

  const groups = [...new Set(SECTIONS.map((s) => s.group))]

  return (
    <div className="ops-shell">
      {/* Side rail */}
      <aside className="ops-rail">
        <Link to="/" className="row center" style={{ gap: 10, color: 'inherit', marginBottom: 8 }}>
          <Logo size={38} />
          <div>
            <div className="head accent" style={{ fontSize: 13 }}>OPS CENTRE</div>
            <div className="mono dim" style={{ fontSize: 9 }}>RHQ CONSOLE</div>
          </div>
        </Link>
        <div className="divider" />
        {groups.map((g) => (
          <div key={g}>
            <div className="mono dim" style={{ fontSize: 9, letterSpacing: 2, margin: '8px 0 4px' }}>{g}</div>
            {SECTIONS.filter((s) => s.group === g).map((s) => (
              <button
                key={s.id}
                className="ghost"
                onClick={() => setSection(s.id)}
                style={{
                  width: '100%', textAlign: 'left', textTransform: 'none', letterSpacing: 0.5,
                  fontSize: 13, padding: '9px 12px', marginBottom: 2,
                  borderColor: section === s.id ? 'var(--accent)' : 'transparent',
                  background: section === s.id ? 'rgba(54,224,192,0.1)' : 'transparent',
                  color: section === s.id ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        ))}
        <div className="grow" />
        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10 }}>Signed in as</div>
        <div className="mono accent" style={{ fontSize: 11, marginBottom: 6 }}>{user.rank} {user.name}</div>
        <button className="ghost" onClick={logout} style={{ width: '100%', fontSize: 12 }}>Sign out</button>
      </aside>

      {/* Work area */}
      <div className="ops-work">
        {section === 'narrative' && <NarrativeEditor />}
        {section === 'map' && <MapEditor />}
        {section === 'briefings' && <BriefingsEditor />}
        {section === 'classified' && <ClassifiedEditor />}
        {section === 'branding' && <BrandingEditor />}
        {section === 'intel' && <IntelEditor />}
        {section === 'users' && <UsersAdmin />}
        {section === 'help' && <HelpAdmin />}
        {section === 'audit' && <AuditLog />}
      </div>
    </div>
  )
}

// Shared header used by all ops panels. Pass `updatedAt` to show when this
// content was last saved.
export function OpsHeader({ title, sub, updatedAt, children }) {
  return (
    <div className="row between center wrap" style={{ marginBottom: 20, gap: 12 }}>
      <div>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 3 }}>{sub}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, color: '#fff' }}>{title}</h1>
        {updatedAt !== undefined && <LastUpdated ts={updatedAt} style={{ display: 'block', marginTop: 4 }} />}
      </div>
      <div className="row" style={{ gap: 8 }}>{children}</div>
    </div>
  )
}

// Small saved-confirmation hook helper. Also pops a consistent toast so saves
// are confirmed the same way across every editor.
export function useSaved() {
  const { push } = useToast()
  const [saved, setSaved] = useState(false)
  const flash = (msg = 'Changes saved') => {
    setSaved(true)
    push(msg, { type: 'success' })
    setTimeout(() => setSaved(false), 1800)
  }
  return [saved, flash]
}
