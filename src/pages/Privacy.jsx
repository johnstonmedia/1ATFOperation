// Member-facing privacy notice. Deliberately short and in plain language —
// most members of a cadet unit are minors. Static (repo-versioned) rather
// than an RHQ-editable slice: a privacy notice shouldn't drift casually, and
// changes to it belong in version control.
export default function Privacy() {
  return (
    <div className="container" style={{ padding: '24px 20px 60px', maxWidth: 760 }}>
      <div className="panel panel-pad">
        <div className="tag">UNIT ADMIN</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 24, color: '#fff' }}>Privacy Notice</h1>
        <div className="mono dim" style={{ fontSize: 11 }}>SHORE CADET UNIT // 1ATF OPERATIONAL PORTAL</div>

        <Section title="What this site collects">
          The public pages of this site collect nothing — no accounts, no
          tracking, no analytics. For unit members with a login, the portal
          stores only what unit staff enter into the roster: your <b>name</b>,{' '}
          <b>student ID number</b>, <b>company</b>, and (if provided){' '}
          <b>email address</b>, plus the password you choose at registration.
        </Section>

        <Section title="Why it's collected">
          This information exists solely to run the unit's training exercise:
          signing you in, showing your company the right content, and letting
          unit staff (RHQ) administer the roster. It is never used for
          marketing, never sold, and never shared outside the unit.
        </Section>

        <Section title="Where it's stored and who can see it">
          Member records are stored in Google Firebase (the same cloud platform
          used by many schools and clubs), protected by security rules so that
          a signed-in member can only read <b>their own</b> record. Full roster
          access is limited to RHQ staff. Passwords are handled by Firebase
          Authentication — the unit cannot read the password you choose.
        </Section>

        <Section title="Cookies and device storage">
          The site uses your browser's local storage only to keep you signed in
          on your device and to remember simple preferences (like your selected
          company on the Intel page). There are no advertising or third-party
          tracking cookies.
        </Section>

        <Section title="Your choices">
          If you'd like your details corrected or removed from the roster, or
          you have any question about this notice, ask your unit staff or use
          the <b>Help</b> option in the site menu — requests go straight to
          RHQ. If you're under 18, you're welcome to have a parent or guardian
          raise it for you.
        </Section>

        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10 }}>
          The Meridian, its forces and all operational content on this site are
          fictional and exist only as part of a cadet training exercise.
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>{title.toUpperCase()}</div>
      <p style={{ marginTop: 6, marginBottom: 0, lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}
