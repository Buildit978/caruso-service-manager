import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearPartnerToken, fetchPartnerMe, isPartnerUnauthorized } from "../../api/partner";
import "../admin/foundingPartners/foundingPartners.css";
import "./partnerPortal.css";

export default function PartnerLayout() {
  const navigate = useNavigate();
  const [partnerName, setPartnerName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPartnerMe()
      .then((me) => {
        if (!cancelled) setPartnerName(me.name);
      })
      .catch((err) => {
        if (isPartnerUnauthorized(err)) {
          navigate("/partner/login", { replace: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function handleLogout() {
    clearPartnerToken();
    navigate("/partner/login", { replace: true });
  }

  return (
    <div className="partner-portal">
      <header className="partner-portal-header">
        <div>
          <p className="partner-portal-brand">Shop Service Manager</p>
          {partnerName && <p className="partner-portal-subtitle">Partner Portal · {partnerName}</p>}
          {!partnerName && <p className="partner-portal-subtitle">Partner Portal</p>}
        </div>
        <button type="button" className="partner-portal-logout" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <nav className="partner-portal-nav" aria-label="Partner portal">
        <NavLink
          to="/partner"
          end
          className={({ isActive }) =>
            `partner-portal-nav-link${isActive ? " partner-portal-nav-link-active" : ""}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/partner/introductions"
          className={({ isActive }) =>
            `partner-portal-nav-link${isActive ? " partner-portal-nav-link-active" : ""}`
          }
        >
          Introductions
        </NavLink>
        <NavLink
          to="/partner/businesses"
          className={({ isActive }) =>
            `partner-portal-nav-link${isActive ? " partner-portal-nav-link-active" : ""}`
          }
        >
          My Businesses
        </NavLink>
      </nav>

      <main className="partner-portal-main">
        <Outlet />
      </main>
    </div>
  );
}
