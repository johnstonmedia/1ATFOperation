// Brief "system boot" splash while initial state loads.
export default function Boot() {
  return (
    <div className="col center" style={{ height: '100vh', gap: 18 }}>
      <div className="mono accent blink" style={{ letterSpacing: 4 }}>
        ESTABLISHING SECURE LINK…
      </div>
      <div className="mono dim" style={{ fontSize: 12 }}>1ATF // OPERATIONAL PORTAL</div>
    </div>
  )
}
