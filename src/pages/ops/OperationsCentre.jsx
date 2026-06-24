import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/Logo'
import NarrativeEditor from './NarrativeEditor'
import MapEditor from './MapEditor'
import ClassifiedEditor from './ClassifiedEditor'
import BrandingEditor from './BrandingEditor'
import DigitalActivities from './DigitalActivities'
import CompanyEditor from './CompanyEditor'
import UsersAdmin from './UsersAdmin'
import LoginModal from '../../components/LoginModal'

const SECTIONS = [
  { id: 'narrative', label: 'Main Narrative', group: 'CONTENT' },
  { id: 'map', label: 'Operational Map', group: 'CONTENT' },
  { id: 'classified', label: 'Classified Page', group: 'CONTENT' },
  { id: 'branding', label: 'Branding & Assets', group: 'CONTENT' },
  { id: 'activities', label: 'Digital Activities', group: 'TASKING' },
  { id: 'company', label: 'Company Pages', group: 'TASKING' },
  { id: 'users', label: 'Users', group: 'ADMIN' },
]

export default function OperationsCentre() {
  const { user, isRHQ } = useAuth()
  const [section, setSection] = useState('narrative')
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
        <div className="mono dim" style={{ fontSize: 10 }}>{user.rank} {user.name}</div>
      </aside>

      {/* Work area */}
      <div className="ops-work">
        {section === 'narrative' && <NarrativeEditor />}
        {section === 'map' && <MapEditor />}
        {section === 'classified' && <ClassifiedEditor />}
        {section === 'branding' && <BrandingEditor />}
        {section === 'activities' && <DigitalActivities />}
        {section === 'company' && <CompanyEditor />}
        {section === 'users' && <UsersAdmin />}
      </div>
    </div>
  )
}

// Shared header used by all ops panels.
export function OpsHeader({ title, sub, children }) {
  return (
    <div className="row between center wrap" style={{ marginBottom: 20, gap: 12 }}>
      <div>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 3 }}>{sub}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, color: '#fff' }}>{title}</h1>
      </div>
      <div className="row" style={{ gap: 8 }}>{children}</div>
    </div>
  )
}

// Small saved-confirmation hook helper.
export function useSaved() {
  const [saved, setSaved] = useState(false)
  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }
  return [saved, flash]
}
