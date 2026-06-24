import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchPartnerDashboard,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  type PartnerDashboard,
} from "../../api/partner";
import { formatDateTime } from "../admin/foundingPartners/foundingPartnerFormat";
import { NoteTypeBadge } from "../admin/foundingPartners/foundingPartnerBadges";

export default function PartnerDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPartnerDashboard();
        if (!cancelled) setData(res);
      } catch (err) {
        if (isPartnerUnauthorized(err)) {
          navigate("/partner/login", { replace: true });
          return;
        }
        if (!cancelled) setError(partnerApiErrorMessage(err, "Failed to load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <>
      <h1 className="partner-portal-page-title">Dashboard</h1>

      {loading && <p className="partner-portal-loading">Loading dashboard…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="partner-portal-stat-grid">
            <div className="partner-portal-stat-card">
              <p className="partner-portal-stat-label">Businesses</p>
              <p className="partner-portal-stat-value">{data.stewardedBusinessCount}</p>
            </div>
            <div className="partner-portal-stat-card">
              <p className="partner-portal-stat-label">Needs attention</p>
              <p className="partner-portal-stat-value">{data.attentionNeededCount}</p>
            </div>
            <div className="partner-portal-stat-card partner-portal-stat-card-wide">
              <p className="partner-portal-stat-label">Recent activity (7 days)</p>
              <p className="partner-portal-stat-value">{data.recentActivityCount}</p>
            </div>
          </div>

          <Link to="/partner/introductions/new" className="partner-portal-link-card">
            <p className="partner-portal-link-card-title">New Shop Introduction</p>
            <p className="partner-portal-link-card-sub">Capture the beginning of a relationship</p>
          </Link>

          <Link to="/partner/introductions" className="partner-portal-link-card">
            <p className="partner-portal-link-card-title">Introductions</p>
            <p className="partner-portal-link-card-sub">Review relationships you are building</p>
          </Link>

          <Link to="/partner/businesses" className="partner-portal-link-card">
            <p className="partner-portal-link-card-title">My Businesses</p>
            <p className="partner-portal-link-card-sub">
              View {data.stewardedBusinessCount} stewarded business
              {data.stewardedBusinessCount === 1 ? "" : "es"}
            </p>
          </Link>

          {data.attentionNeededCount > 0 && (
            <Link to="/partner/businesses" className="partner-portal-link-card">
              <p className="partner-portal-link-card-title">Review attention needed</p>
              <p className="partner-portal-link-card-sub">
                {data.attentionNeededCount} business
                {data.attentionNeededCount === 1 ? "" : "es"} may need follow-up
              </p>
            </Link>
          )}

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Recent activity</h2>
            {data.recentActivity.length === 0 ? (
              <p className="partner-portal-empty">No recent activity in the last 7 days.</p>
            ) : (
              data.recentActivity.map((item, idx) => (
                <div key={`${item.at}-${idx}`} className="partner-portal-activity-item">
                  <div className="partner-portal-note-meta">
                    <NoteTypeBadge type={item.noteType} />
                    <span>{formatDateTime(item.at)}</span>
                  </div>
                  {item.businessName && (
                    <p className="partner-portal-activity-business-name">
                      {item.prospectId ? (
                        <Link to={`/partner/businesses/${item.prospectId}`}>{item.businessName}</Link>
                      ) : (
                        item.businessName
                      )}
                    </p>
                  )}
                  <p className="partner-portal-note-summary">{item.summary}</p>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
