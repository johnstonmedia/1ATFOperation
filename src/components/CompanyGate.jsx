import { useCompany } from '../context/CompanyContext'
import { COMPANIES } from '../firebase/seed'
import Logo from './Logo'

// First-visit company selection, shown on the boot/"secure link" screen and
// never again — the choice is kept on the device (see CompanyContext). Picking
// here is what makes the Intel tab and the home-page new-intel alert
// company-specific.
export default function CompanyGate() {
  const { setCompany } = useCompany()
  const companies = COMPANIES.filter((c) => c.letter !== 'R')

  return (
    <div className="col center" style={{ minHeight: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
      <Logo size={78} />
      <div className="mono accent" style={{ letterSpacing: 4, fontSize: 13 }}>
        SECURE LINK ESTABLISHED
      </div>
      <div className="mono dim" style={{ fontSize: 12 }}>1ATF // OPERATIONAL PORTAL</div>

      <div className="divider" style={{ maxWidth: 420, width: '100%' }} />

      <div className="head" style={{ fontSize: 16, color: '#fff', letterSpacing: 2 }}>IDENTIFY YOUR COMPANY</div>

      <div className="row wrap center" style={{ gap: 10, maxWidth: 460, justifyContent: 'center' }}>
        {companies.map((c) => (
          <button
            key={c.letter}
            onClick={() => setCompany(c.letter)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', minHeight: 44,
              border: `1px solid ${c.accent}`, borderRadius: 4,
              background: 'transparent', color: 'var(--text)',
              fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer',
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: 4, background: c.accent, color: '#04121b',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Orbitron', fontWeight: 700, fontSize: 12,
            }}>{c.letter}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* Not in a company (staff, parents, visitors) — records the choice so
          they aren't asked again; they still see all unit-wide content. */}
      <button className="ghost" onClick={() => setCompany('')} style={{ fontSize: 11, marginTop: 4 }}>
        Skip
      </button>
    </div>
  )
}
