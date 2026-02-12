// src/components/layout/Layout.tsx
import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useSettingsAccess } from '../../contexts/SettingsAccessContext'
import { useAccess } from '../../contexts/AccessContext'
import { useMe } from "../../auth/useMe";
import { clearToken, getMustChangePassword } from "../../api/http";
import { useSettings } from "../../hooks/useSettings";
import BillingLockBanner from "../common/BillingLockBanner";
import { createCheckoutSession, createPortalSession, getBillingStatus, type BillingStatusResponse } from "../../api/billing";

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasAccess } = useSettingsAccess()
  const { customersAccess, vehiclesAccess } = useAccess()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [billingStatusInfo, setBillingStatusInfo] = useState<BillingStatusResponse | null>(null)

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await getBillingStatus();
        if (!cancelled) {
          setBillingStatusInfo(s);
        }
      } catch {
        if (!cancelled) {
          setBillingStatusInfo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ NEW: fetch server-truth identity (role/account) using x-auth-token
  const { me, loading: meLoading } = useMe()

  // Fetch settings for shop name and subscription flags (technicians may get 403, use fallback)
  const { shopName, billingStatus: settingsBillingStatus, stripeSubscriptionId } = useSettings()

  // Route guard: redirect to /change-password if mustChangePassword is true
  useEffect(() => {
    if (!meLoading && getMustChangePassword() && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [meLoading, location.pathname, navigate]);

  // Logout handler
  function handleLogout() {
    // Clear token and mustChangePassword flag
    clearToken();
    
    // Hard redirect to login (resets all state including access flags)
    window.location.href = "/login";
  }

  const closeDrawer = () => setDrawerOpen(false)

  const hasSubscription =
    Boolean(stripeSubscriptionId) ||
    settingsBillingStatus === "active" ||
    settingsBillingStatus === "past_due";

  const billingButtonLabel = hasSubscription ? "Manage billing" : "Start subscription";

  async function handleBillingClick() {
    closeDrawer();
    if (hasSubscription) {
      const { url } = await createPortalSession();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const { url } = await createCheckoutSession();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
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

  const isOwner = me?.role === "owner";
  const isManager = me?.role === "manager";

  const daysLeft = billingStatusInfo?.daysUntilLock ?? null;
  const inTrial = billingStatusInfo?.reason === "trial";

  const shouldShowTrial =
    !billingStatusInfo?.locked &&
    inTrial &&
    (isOwner || isManager) &&
    daysLeft !== null &&
    daysLeft > 0;

  const canShowUpgradeButton = Boolean(billingStatusInfo?.showBillingCta) && isOwner;

  return (
    <div className={`layout-root${drawerOpen ? ' is-drawer-open' : ''}`}>
      {/* Mobile only: top bar with hamburger */}
      <header className="layout-mobile-topbar">
        <button
          type="button"
          className="layout-mobile-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <span className="layout-mobile-menu-icon" aria-hidden>☰</span>
        </button>
        <span className="layout-mobile-topbar-title">Shop Service Manager</span>
      </header>

      {/* Mobile only: backdrop when drawer is open */}
      <div
        className="layout-drawer-backdrop"
        aria-hidden={!drawerOpen}
        onClick={closeDrawer}
      />

      <aside className="layout-sidebar">
        <div style={{ marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            margin: 0,
            marginBottom: shopName ? '0.25rem' : 0,
          }}>
            Shop Service Manager
          </h1>
          {(shouldShowTrial || canShowUpgradeButton) && (
            <div
              style={{
                marginTop: "0.5rem",
                marginBottom: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.375rem",
                background: "#0f172a",
                border: "1px solid #4b5563",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.6rem",
              }}
            >
              {shouldShowTrial && (
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {daysLeft === 0
                    ? "Trial ends today"
                    : `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                </div>
              )}
              {canShowUpgradeButton && (
                <button
                  type="button"
                  onClick={() => {
                    void handleBillingClick();
                  }}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "#1d4ed8",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {billingButtonLabel}
                </button>
              )}
            </div>
          )}
          {shopName && (
            <div style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              fontWeight: 400,
            }}>
              {shopName}
            </div>
          )}
        </div>

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
          <Link to="/" style={linkStyle('/')} onClick={closeDrawer}>Dashboard</Link>
          <Link to="/work-orders" style={linkStyle('/work-orders')} onClick={closeDrawer}>Work Orders</Link>

          {me?.role === "owner" && (
            <Link to="/team" style={linkStyle('/team')} onClick={closeDrawer}>Team</Link>
          )}

          {customersAccess !== false && (
            <Link to="/customers" style={linkStyle('/customers')} onClick={closeDrawer}>Customers</Link>
          )}

          {vehiclesAccess !== false && (
            <Link to="/vehicles" style={linkStyle('/vehicles')} onClick={closeDrawer}>Vehicles</Link>
          )}

          {hasAccess !== false && (
            <Link to="/settings" style={linkStyle('/settings')} onClick={closeDrawer}>Settings</Link>
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

      <main className="layout-main">
        <BillingLockBanner />
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
