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

        <Section title="If you're just using this site">
          Then nothing about you is stored — which covers almost everyone in the
          unit. Reading the operation brief, looking at the map and solving
          intel fragments needs <b>no account and no sign-in</b>, so there is
          nothing to attach to you — no name and no ID number. There is{' '}
          <b>no advertising</b> on this site and nothing here is ever sold. Two
          things do leave your device, and neither can identify you: the counter
          described under <b>Decrypt counts</b>, and — if the unit has switched
          it on — the visit counting described under <b>Site analytics</b>.
        </Section>

        <Section title="Decrypt counts">
          When someone solves an intel fragment on the <b>Intel</b> page, the
          site adds <b>1</b> to a counter for that fragment and the company
          selected on the device. <b>No name, no ID number, no login, no device
          identifier</b> is sent or stored with it, and there is no way to work
          backwards from a count to who solved what. Unit staff use it only to
          see which puzzles are being played, so they know what's worth making
          more of. Your own progress — which fragments you've cracked — stays on
          your device and is never sent anywhere.
        </Section>

        <Section title="Site analytics">
          The unit may switch on <b>Google Analytics</b> to count how many
          people open the site and which pages get used, so staff know whether
          anyone is actually reading the briefings. If it is on, your browser
          tells Google the <b>page address</b> you opened (never the bits after
          a <b>?</b>), roughly where in the world you are, and what browser and
          device type you're using. It is set up so that Google{' '}
          <b>cannot use any of it to build a profile of you or target
          advertising at you</b> — the settings that would allow that are turned
          off in the site's code, which is why they can't be changed quietly.
          Your name, ID number and login are never sent, and if you sign in,
          nothing links your account to what you looked at. If your browser or
          phone has a <b>“Do Not Track”</b> setting turned on, this site obeys
          it and sends nothing at all.
        </Section>

        <Section title="If you've been issued a login">
          A small number of people need an account to run the portal — RHQ,
          company commanders and unit staff. For those accounts the roster holds
          only what unit staff enter: <b>name</b>, <b>student ID number</b>,{' '}
          <b>company</b>, and (if provided) <b>email address</b>. Nothing you do
          once signed in is logged against you.
        </Section>

        <Section title="Why it's collected">
          This information exists solely to run the unit's training exercise:
          signing you in, showing your company the right content, and letting
          unit staff (RHQ) administer the roster. It is never used for
          marketing, never sold, and never shared outside the unit.
        </Section>

        <Section title="Where it's stored and who can see it">
          Member records are stored in Google Firebase (the same cloud platform
          used by many schools and clubs), protected by security rules so that a
          signed-in member can only read <b>their own</b> record. The roster as
          a whole is reachable only by the RHQ staff who maintain it, and only
          for unit administration — it holds the details they entered, and
          nothing about how anyone uses the site. Your password is different
          again: it is handled by Firebase Authentication, which stores it{' '}
          <b>hashed</b> — scrambled in a way that cannot be reversed. Nobody at
          the unit, RHQ included, can read it or look it up. If you forget it,
          it can only be reset, never recovered. The one-time code you're given
          to register the first time isn't your password — you replace it with
          one only you know.
        </Section>

        <Section title="Cookies and device storage">
          The site uses your browser's local storage only to keep you signed in
          on your device and to remember simple things that never leave it:
          your selected company, which pages you've already opened, and which
          intel fragments you've decrypted. Clearing your browser data resets
          those. There are <b>no advertising cookies</b>. If the unit has
          switched on the visit counting described above, Google Analytics also
          sets a cookie so a returning visitor isn't counted twice — clearing
          your browser data resets that too.
        </Section>

        <Section title="Questions, corrections or removal">
          If you hold a login and want your details corrected or removed, or you
          have any question about this notice, pass it up through your chain of
          command, speak to unit staff, or email CUO Digby Wood at{' '}
          <a href="mailto:DW.164667@student.shore.nsw.edu.au" className="accent">
            DW.164667@student.shore.nsw.edu.au
          </a>
          . If you're under 18, a parent or guardian is welcome to raise it on
          your behalf. If you don't have a login, there is nothing on the site
          to correct or remove.
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
