import { useAuth } from '../context/AuthContext'

// Gate for personnel-only pages. Public content is never wrapped in this.
export default function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) {
    return (
      <div className="container" style={{ padding: 40 }}>
        <div className="panel panel-pad col center" style={{ gap: 12, padding: 40 }}>
          <div className="head hostile" style={{ letterSpacing: 2 }}>ACCESS RESTRICTED</div>
          <p className="mono dim" style={{ fontSize: 12 }}>
            Authenticate via the ACCESS button to view personnel data.
          </p>
        </div>
      </div>
    )
  }
  return children
}
