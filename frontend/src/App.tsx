// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import CustomersPage from './pages/CustomersPage'
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/settings" element={<SettingsPage />} />   {/* 👈 new */}
      </Routes>
    </Layout>
  )
}

export default App

