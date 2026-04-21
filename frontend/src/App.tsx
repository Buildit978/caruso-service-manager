// src/App.tsx
//import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehiclesPage from "./pages/VehiclesPage.tsx";
import RevenueReportPage from "./pages/RevenueReportPage";
import SchedulerPage from "./pages/SchedulerPage";
import LoginPage from "./pages/LoginPage";
import StartPage from "./pages/StartPage";
import WelcomePage from "./pages/WelcomePage";
import TeamPage from "./pages/TeamPage";
import EstimatesPage from "./pages/EstimatesPage";
import EstimateDetailPage from "./pages/EstimateDetailPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminGatePage from "./pages/admin/AdminGatePage";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminAccountDetailPage from "./pages/admin/AdminAccountDetailPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminGuard from "./pages/admin/AdminGuard";

function App() {
  return (
    <Routes>
      <Route path="/start" element={<StartPage />} />
      <Route path="/register" element={<StartPage />} />
      <Route path="/signup" element={<StartPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/admin" element={<Outlet />}>
        <Route index element={<AdminGatePage />} />
        <Route path="accounts" element={<AdminGuard><AdminAccountsPage /></AdminGuard>} />
        <Route path="accounts/:accountId" element={<AdminGuard><AdminAccountDetailPage /></AdminGuard>} />
        <Route path="users" element={<AdminGuard><AdminUsersPage /></AdminGuard>} />
      </Route>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="scheduler" element={<SchedulerPage />} />
        <Route path="estimates" element={<EstimatesPage />} />
        <Route path="estimates/:id" element={<EstimateDetailPage />} />
        <Route path="work-orders/new" element={<WorkOrderCreatePage />} />
        <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
        <Route path="work-orders/:id/edit" element={<WorkOrderEditPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/new" element={<CustomerCreatePage />} />
        <Route path="customers/:id/edit" element={<CustomerEditPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="invoices" element={<Navigate to="/work-orders?view=financial" replace />} />
        <Route path="reports/revenue" element={<RevenueReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App

