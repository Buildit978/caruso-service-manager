// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
//import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import CustomersPage from './pages/CustomersPage'
import SettingsPage from './pages/SettingsPage';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import WorkOrderEditPage from './pages/WorkOrderEditPage';
import WorkOrderCreatePage from "./pages/WorkOrderCreatePage";
import CustomerCreatePage from "./pages/CustomerCreatePage";
import CustomerEditPage from "./pages/CustomerEditPage"; 
import CustomerDetailPage from "./pages/CustomerDetailPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";



function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/work-orders/new" element={<WorkOrderCreatePage />} />
        <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
        <Route path="/work-orders/:id/edit" element={<WorkOrderEditPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />   {/* 👈 new */}
        <Route path="/customers/new" element={<CustomerCreatePage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      </Routes>
    </Layout>
  )
}

export default App

