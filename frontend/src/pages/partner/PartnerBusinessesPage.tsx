import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPartnerBusinesses,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  type PartnerBusinessListItem,
} from "../../api/partner";
import { filterFoundingPartnerListItems } from "../../utils/foundingPartnerListSearch";
import { formatDate } from "../admin/foundingPartners/foundingPartnerFormat";
import {
  HealthStatusBadge,
  LifecycleStatusBadge,
} from "../admin/foundingPartners/foundingPartnerBadges";

export default function PartnerBusinessesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerBusinessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPartnerBusinesses({ limit: 100 });
        if (!cancelled) setItems(res.items);
      } catch (err) {
        if (isPartnerUnauthorized(err)) {
          navigate("/partner/login", { replace: true });
          return;
        }
        if (!cancelled) setError(partnerApiErrorMessage(err, "Failed to load businesses"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const filtered = useMemo(
    () =>
      filterFoundingPartnerListItems(items, query, (row) => ({
        businessName: row.businessName,
        ownerName: row.contactName,
        phone: row.phone,
        email: row.email,
        address: row.location,
      })),
    [items, query]
  );

  return (
    <>
      <h1 className="partner-portal-page-title">My Businesses</h1>

      <input
        type="search"
        className="partner-portal-search"
        placeholder="Search by business name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search businesses"
      />

      {loading && <p className="partner-portal-loading label-muted-readable">Loading businesses…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="partner-portal-empty label-muted-readable">
          {items.length === 0 ? "No stewarded businesses yet." : "No businesses match your search."}
        </p>
      )}

      {!loading &&
        !error &&
        filtered.map((row) => (
          <button
            type="button"
            key={row.prospectId}
            className="partner-portal-business-card"
            onClick={() => navigate(`/partner/businesses/${row.prospectId}`)}
          >
            <p className="partner-portal-business-name">{row.businessName}</p>
            <div className="partner-portal-business-meta">
              <LifecycleStatusBadge status={row.lifecycleStatus} />
              {row.healthStatus != null && <HealthStatusBadge status={row.healthStatus} />}
              {row.lastActivityAt ? (
                <span>Last activity {formatDate(row.lastActivityAt)}</span>
              ) : (
                <span>No activity recorded</span>
              )}
            </div>
          </button>
        ))}
    </>
  );
}
