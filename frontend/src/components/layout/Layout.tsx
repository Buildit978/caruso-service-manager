// src/components/layout/Layout.tsx
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useSettingsAccess } from '../../contexts/SettingsAccessContext'
import { useAccess } from '../../contexts/AccessContext'
import { useMe } from "../../auth/useMe";
import { clearToken } from "../../api/http";
import { useSettings } from "../../hooks/useSettings";

function Layout() {
  const location = useLocation()
  const { hasAccess } = useSettingsAccess()
  const { customersAccess, vehiclesAccess } = useAccess()

  // ✅ NEW: fetch server-truth identity (role/account) using x-auth-token
  const { me, loading: meLoading } = useMe()

  // Fetch settings for shop name (technicians may get 403, use fallback)
  const { shopName } = useSettings()

  // Logout handler
  function handleLogout() {
    // Clear token
    clearToken();
    
    // Hard redirect to login (resets all state including access flags)
    window.location.href = "/login";
  }

  // ✅ Optional: avoid UI flicker before role is known
  if (meLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: '#020617',
        color: '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Loading…
      </div>
    )
  }

  // Use shop name from settings, fallback to default
  const displayTitle = shopName || "Auto Service Manager"

  const linkStyle = (path: string) => ({
    display: 'block',
    padding: '0.35rem 0.6rem',
    marginBottom: '0.25rem',
    borderRadius: '4px',
    textDecoration: 'none',
    fontSize: '0.9rem',
    color: location.pathname === path ? '#fff' : '#e5e7eb',
    background: location.pathname === path ? '#1f74d4' : 'transparent',
  })


  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      background: '#020617',
      color: '#e5e7eb',
    }}>
      <aside style={{
        width: '220px',
        padding: '1rem',
        borderRight: '1px solid #1f2937',
        background: '#020617',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <h1 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
        }}>
          {displayTitle}
        </h1>

        {/* Session badge */}
        {me && (
          <div style={{
            fontSize: "0.75rem",
            color: "#9ca3af",
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid #1f2937",
          }}>
            {me.email || me.name || "Unknown"} • {me.role}
          </div>
        )}

        <nav>
          <Link to="/" style={linkStyle('/')}>Dashboard</Link>
          <Link to="/work-orders" style={linkStyle('/work-orders')}>Work Orders</Link>

          {me?.role === "owner" && (
            <Link to="/team" style={linkStyle('/team')}>Team</Link>
          )}

          {customersAccess !== false && (
            <Link to="/customers" style={linkStyle('/customers')}>Customers</Link>
          )}

          {vehiclesAccess !== false && (
            <Link to="/vehicles" style={linkStyle('/vehicles')}>Vehicles</Link>
          )}

          {hasAccess !== false && (
            <Link to="/settings" style={linkStyle('/settings')}>Settings</Link>
          )}
        </nav>

        {/* Logout button */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1f2937' }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#e5e7eb',
              background: 'transparent',
              border: '1px solid #4b5563',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1f2937';
              e.currentTarget.style.borderColor = '#6b7280';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#4b5563';
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '1.5rem 2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
