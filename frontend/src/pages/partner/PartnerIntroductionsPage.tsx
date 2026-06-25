import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchPartnerIntroductions,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  PARTNER_RELATIONSHIP_STAGE_LABELS,
  type PartnerIntroductionListItem,
} from "../../api/partner";
import { formatDate } from "../admin/foundingPartners/foundingPartnerFormat";
import "./partnerPortal.css";

function StageBadge({ stage }: { stage: PartnerIntroductionListItem["stage"] }) {
  return (
    <span className={`partner-portal-stage-badge partner-portal-stage-badge-${stage}`}>
      {PARTNER_RELATIONSHIP_STAGE_LABELS[stage]}
    </span>
  );
}

export default function PartnerIntroductionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerIntroductionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPartnerIntroductions({ limit: 100 });
        if (!cancelled) setItems(res.items);
      } catch (err) {
        if (isPartnerUnauthorized(err)) {
          navigate("/partner/login", { replace: true });
          return;
        }
        if (!cancelled) setError(partnerApiErrorMessage(err, "Failed to load introductions"));
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
      <div className="partner-portal-page-header-row">
        <h1 className="partner-portal-page-title">Introductions</h1>
        <Link to="/partner/introductions/new" className="partner-portal-btn partner-portal-btn-primary partner-portal-btn-inline">
          New
        </Link>
      </div>
      <p className="partner-portal-intro-copy label-muted-readable">
        Relationships you are building before admin relationship protection is granted.
      </p>

      {loading && <p className="partner-portal-loading label-muted-readable">Loading introductions…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="partner-portal-card">
          <p className="partner-portal-empty label-muted-readable">No introductions yet.</p>
          <Link to="/partner/introductions/new" className="partner-portal-btn partner-portal-btn-primary">
            Record new introduction
          </Link>
        </div>
      )}

      {!loading &&
        !error &&
        items.map((row) => (
          <button
            type="button"
            key={row.prospectId}
            className="partner-portal-business-card"
            onClick={() => navigate(`/partner/introductions/${row.prospectId}`)}
          >
            <p className="partner-portal-business-name">{row.businessName}</p>
            <div className="partner-portal-business-meta">
              <StageBadge stage={row.stage} />
              {row.isStewarding && (
                <span className="partner-portal-stewarding-pill">Stewarding</span>
              )}
            </div>
            {row.lastMeaningfulConversation ? (
              <p className="partner-portal-link-card-sub label-muted-readable partner-portal-list-snippet">
                Last meaningful: {row.lastMeaningfulConversation.summary.slice(0, 120)}
                {row.lastMeaningfulConversation.summary.length > 120 ? "…" : ""}
              </p>
            ) : (
              <p className="partner-portal-link-card-sub label-muted-readable">No meaningful conversation recorded yet</p>
            )}
            <p className="partner-portal-link-card-sub label-muted-readable">
              Last activity {formatDate(row.lastActivityAt ?? row.lastVisitDate ?? row.stageUpdatedAt)}
            </p>
          </button>
        ))}
    </>
  );
}
