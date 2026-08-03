import { Routes, Route } from 'react-router-dom'
import { useData } from './context/DataContext'
import { useCompany } from './context/CompanyContext'
import Layout from './components/Layout'
import CompanyGate from './components/CompanyGate'
import Home from './pages/Home'
import Intel from './pages/Intel'
import Briefings from './pages/Briefings'
import Classified from './pages/Classified'
import Privacy from './pages/Privacy'
import OperationsCentre from './pages/ops/OperationsCentre'
import CommanderPanel from './pages/CommanderPanel'
import Boot from './components/Boot'

export default function App() {
  const { loading } = useData()
  if (loading) return <Boot />

  return (
    <Routes>
      {/* Standalone full-screen pages (no chrome) */}
      <Route path="/Classified" element={<Classified />} />
      <Route path="/classified" element={<Classified />} />
      <Route path="/operations-centre/*" element={<OperationsCentre />} />
      <Route path="/company-command" element={<CommanderPanel />} />

      {/* Main app shell with top bar + hamburger — three tabs. First-time
          visitors pick their company before the shell renders. */}
      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/intel" element={<Intel />} />
        <Route path="/briefings" element={<Briefings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}

// Public tabs, gated once on first visit by the company picker. The RHQ /
// commander consoles and the standalone Classified landing page deliberately
// skip the gate — they aren't company-scoped.
function PublicShell() {
  const { chosen } = useCompany()
  return chosen ? <Layout /> : <CompanyGate />
}
