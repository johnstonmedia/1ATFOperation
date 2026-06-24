import { Routes, Route } from 'react-router-dom'
import { useData } from './context/DataContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Activity from './pages/Activity'
import Tasks from './pages/Tasks'
import CompanyPage from './pages/CompanyPage'
import Classified from './pages/Classified'
import OperationsCentre from './pages/ops/OperationsCentre'
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

      {/* Main app shell with top bar + hamburger */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/company/:letter" element={<CompanyPage />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
