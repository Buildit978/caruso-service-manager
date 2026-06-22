import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchFoundingPartners,
  fetchFoundingProspects,
  fetchRelationshipProtections,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { FP_MODULE_TITLE, formatDateTime, apiErrorMessage } from "./foundingPartnerFormat";
import { ProtectionStatusBadge } from "./foundingPartnerBadges";

interface RecentItem {
  id: string;
  label: string;
  sublabel: string;
  date: string;
  href: string;
  kind: "prospect" | "protection";
}

export default function AdminFoundingPartnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerCount, setPartnerCount] = useState(0);
  const [prospectCount, setProspectCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [partners, prospects, approved, pending] = await Promise.all([
          fetchFoundingPartners({ limit: 1 }),
          fetchFoundingProspects({ limit: 5 }),
          fetchRelationshipProtections({ protectionStatus: "approved", limit: 1 }),
          fetchRelationshipProtections({ protectionStatus: "pending", limit: 5 }),
        ]);
        if (cancelled) return;

        setPartnerCount(partners.total);
        setProspectCount(prospects.total);
        setApprovedCount(approved.total);
        setPendingCount(pending.total);

        const recentItems: RecentItem[] = [
          ...prospects.items.map((p) => ({
            id: `prospect-${p.id}`,
            label: p.businessName,
            sublabel: `Prospect · ${p.status}`,
            date: p.createdAt ?? "",
            href: `/admin/founding-partners/prospects/${p.id}`,
            kind: "prospect" as const,
          })),
          ...pending.items.map((r) => ({
            id: `protection-${r.id}`,
            label: r.prospectBusinessName ?? "Introduction",
            sublabel: `Pending · ${r.partnerName ?? "Partner"}`,
            date: r.createdAt ?? r.introducedAt ?? "",
            href: `/admin/founding-partners/relationship-protections/${r.id}`,
            kind: "protection" as const,
          })),
        ]
          .filter((item) => item.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 8);

        setRecent(recentItems);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, "Failed to load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout title={FP_MODULE_TITLE}>
      <FoundingPartnerShell variant="list">
        <div className="fp-page-header">
          <h2 className="fp-page-title">Dashboard</h2>
        </div>

        {loading && <p className="fp-loading">Loading dashboard…</p>}
        {error && <p className="fp-error">{error}</p>}

        {!loading && !error && (
          <>
            <div className="fp-dashboard-stats">
              <div className="fp-stat-card">
                <p className="fp-stat-label">Partners</p>
                <p className="fp-stat-value">{partnerCount}</p>
              </div>
              <div className="fp-stat-card">
                <p className="fp-stat-label">Prospects</p>
                <p className="fp-stat-value">{prospectCount}</p>
              </div>
              <div className="fp-stat-card">
                <p className="fp-stat-label">Approved protections</p>
                <p className="fp-stat-value">{approvedCount}</p>
              </div>
              <div className="fp-stat-card">
                <p className="fp-stat-label">Pending introductions</p>
                <p className="fp-stat-value">{pendingCount}</p>
              </div>
            </div>

            <section className="fp-card">
              <h2 className="fp-section-title">Quick links</h2>
              <div className="fp-detail-actions">
                <Link className="fp-btn fp-btn-secondary" to="/admin/founding-partners/partners">
                  View partners
                </Link>
                <Link className="fp-btn fp-btn-secondary" to="/admin/founding-partners/prospects">
                  View prospects
                </Link>
                <Link
                  className="fp-btn fp-btn-secondary"
                  to="/admin/founding-partners/relationship-protections"
                >
                  View protections
                </Link>
              </div>
            </section>

            <section className="fp-card">
              <h2 className="fp-section-title">Recent activity</h2>
              {recent.length === 0 ? (
                <p className="fp-empty">No recent prospects or pending introductions.</p>
              ) : (
                <ul className="fp-activity-list">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <Link to={item.href} className="fp-activity-row">
                        <div className="fp-activity-row-main">
                          <span className="fp-activity-row-title">{item.label}</span>
                          <span className="fp-activity-row-meta">{item.sublabel}</span>
                        </div>
                        <span className="fp-activity-row-date">{formatDateTime(item.date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {pendingCount > 0 && (
                <p className="fp-muted" style={{ marginTop: "0.75rem" }}>
                  <ProtectionStatusBadge status="pending" /> {pendingCount} introduction
                  {pendingCount !== 1 ? "s" : ""} awaiting review
                </p>
              )}
            </section>
          </>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}
