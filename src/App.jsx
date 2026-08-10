import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useData } from './context/DataContext'
import { useCompany } from './context/CompanyContext'
import Layout from './components/Layout'
import CompanyGate from './components/CompanyGate'
import Home from './pages/Home'
import Intel from './pages/Intel'
import Briefings from './pages/Briefings'
import Classified from './pages/Classified'
import Privacy from './pages/Privacy'
import StaffCentre from './pages/StaffCentre'
import OperationsCentre from './pages/ops/OperationsCentre'
import CommanderPanel from './pages/CommanderPanel'
import Boot from './components/Boot'
import { initAnalytics, trackPageView } from './lib/analytics'

export default function App() {
  const { loading } = useData()
  if (loading) return <Boot />

  return (
    <>
      <PageViews />
      <Routes>
      {/* Standalone full-screen pages (no chrome) */}
      <Route path="/Classified" element={<Classified />} />
      <Route path="/classified" element={<Classified />} />
      <Route path="/operations-centre/*" element={<OperationsCentre />} />
      <Route path="/company-command" element={<CommanderPanel />} />
      {/* URL-only staff overview, shared-password gated (see StaffCentre.jsx) */}
      <Route path="/staff-centre" element={<StaffCentre />} />
      <Route path="/staff-Centre" element={<StaffCentre />} />

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
    </>
  )
}

// Google Analytics page views for a single-page app. gtag only counts the very
// first load on its own, so every client-side route change has to be sent
// explicitly or the whole site reads as one page view per visit.
//
// The QUERY STRING IS STRIPPED deliberately: `?emulate=<company>` and anything
// else appended to a URL is unit business, and the privacy notice promises
// nothing identifying is sent. Path only.
//
// No-op unless VITE_GA_ID is set — see lib/analytics.js.
function PageViews() {
  const { pathname } = useLocation()
  useEffect(() => { initAnalytics() }, [])
  useEffect(() => { trackPageView(pathname) }, [pathname])
  return null
}

// Public tabs, gated once on first visit by the company picker. The RHQ /
// commander consoles and the standalone Classified landing page deliberately
// skip the gate — they aren't company-scoped.
function PublicShell() {
  const { chosen } = useCompany()
  return chosen ? <Layout /> : <CompanyGate />
}
