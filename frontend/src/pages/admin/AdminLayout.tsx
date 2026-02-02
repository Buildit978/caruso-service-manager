import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAdminToken, getAdminRole } from "../../api/admin";
import "./Admin.css";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export default function AdminLayout({ children, title = "Admin", showBack }: AdminLayoutProps) {
  const navigate = useNavigate();
  const adminRole = getAdminRole();

  function handleLogout() {
    clearAdminToken();
    navigate("/admin", { replace: true });
  }

  return (
    <div className="admin-root">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          {showBack && (
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              ← Back
            </button>
          )}
          <h1 className="admin-topbar-title">{title}</h1>
          {adminRole && (
            <span className="admin-role-badge" aria-label={`Role: ${adminRole}`}>
              {adminRole}
            </span>
          )}
        </div>
        <div className="admin-topbar-actions">
          <Link to="/admin/accounts" className="admin-btn admin-btn-secondary">
            Accounts
          </Link>
          {adminRole === "superadmin" && (
            <Link to="/admin/users" className="admin-btn admin-btn-secondary">
              Users
            </Link>
          )}
          <button type="button" className="admin-btn admin-btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
