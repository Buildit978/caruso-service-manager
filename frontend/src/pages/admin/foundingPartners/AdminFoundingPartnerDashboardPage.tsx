import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchFoundingPartners,
  fetchFoundingProspects,
  fetchRelationshipProtections,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { FP_MODULE_TITLE, apiErrorMessage } from "./foundingPartnerFormat";

const RECENT_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

function countRecentActivity(
  businesses: { createdAt?: string }[],
  pendingIntroductions: { createdAt?: string; introducedAt?: string }[]
): number {
  const cutoff = Date.now() - RECENT_ACTIVITY_MS;
  let count = 0;
  for (const b of businesses) {
    if (b.createdAt && new Date(b.createdAt).getTime() >= cutoff) count++;
  }
  for (const intro of pendingIntroductions) {
    const at = intro.createdAt ?? intro.introducedAt;
    if (at && new Date(at).getTime() >= cutoff) count++;
  }
  return count;
}

export default function AdminFoundingPartnerDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerCount, setPartnerCount] = useState(0);
  const [businessCount, setBusinessCount] = useState(0);
  const [introductionCount, setIntroductionCount] = useState(0);
  const [recentActivityCount, setRecentActivityCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [partners, businesses, introductions, recentBusinesses, recentPending] =
          await Promise.all([
            fetchFoundingPartners({ limit: 1 }),
            fetchFoundingProspects({ limit: 1 }),
            fetchRelationshipProtections({ limit: 1 }),
            fetchFoundingProspects({ limit: 50 }),
            fetchRelationshipProtections({ protectionStatus: "pending", limit: 50 }),
          ]);
        if (cancelled) return;

        setPartnerCount(partners.total);
        setBusinessCount(businesses.total);
        setIntroductionCount(introductions.total);
        setRecentActivityCount(
          countRecentActivity(recentBusinesses.items, recentPending.items)
        );
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
          <div className="fp-dashboard-stats">
            <button
              type="button"
              className="fp-stat-card"
              onClick={() => navigate("/admin/founding-partners/prospects")}
            >
              <p className="fp-stat-label">Businesses</p>
              <p className="fp-stat-value">{businessCount}</p>
            </button>
            <button
              type="button"
              className="fp-stat-card"
              onClick={() => navigate("/admin/founding-partners/relationship-protections")}
            >
              <p className="fp-stat-label">Introductions</p>
              <p className="fp-stat-value">{introductionCount}</p>
            </button>
            <button
              type="button"
              className="fp-stat-card"
              onClick={() => navigate("/admin/founding-partners/partners")}
            >
              <p className="fp-stat-label">Partners</p>
              <p className="fp-stat-value">{partnerCount}</p>
            </button>
            <button
              type="button"
              className="fp-stat-card"
              onClick={() => navigate("/admin/founding-partners/prospects")}
            >
              <p className="fp-stat-label">Recent activity</p>
              <p className="fp-stat-value">{recentActivityCount}</p>
            </button>
          </div>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}
