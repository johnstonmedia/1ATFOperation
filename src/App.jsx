import { Routes, Route } from 'react-router-dom'
import { useData } from './context/DataContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Intel from './pages/Intel'
import Briefings from './pages/Briefings'
import Classified from './pages/Classified'
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

      {/* Main app shell with top bar + hamburger — three tabs */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/intel" element={<Intel />} />
        <Route path="/briefings" element={<Briefings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
