import { Link } from "react-router-dom";
import type { ProspectRelationshipOwnership } from "../../../api/adminFoundingPartners";
import { LifecycleStatusBadge, ProtectionStatusBadge } from "./foundingPartnerBadges";
import { formatDate, formatDateTime } from "./foundingPartnerFormat";

interface RelationshipOwnershipSectionProps {
  ownership: ProspectRelationshipOwnership | null;
}

export default function RelationshipOwnershipSection({ ownership }: RelationshipOwnershipSectionProps) {
  return (
    <section className="fp-card">
      <h2 className="fp-section-title">Relationship Ownership</h2>
      {!ownership ? (
        <p className="fp-empty">No active protection</p>
      ) : (
        <dl className="fp-detail-dl">
          <dt>Protected By</dt>
          <dd>
            {ownership.protectedBy ? (
              <Link
                className="fp-link"
                to={`/admin/founding-partners/partners/${ownership.protectedBy.partnerId}`}
              >
                {ownership.protectedBy.partnerName}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt>Protection Status</dt>
          <dd>
            {ownership.protectionStatus ? (
              <ProtectionStatusBadge status={ownership.protectionStatus} />
            ) : (
              "—"
            )}
          </dd>
          <dt>Relationship Lifecycle</dt>
          <dd>
            {ownership.lifecycleStatus ? (
              ownership.relationshipProtectionId ? (
                <Link
                  className="fp-link"
                  to={`/admin/founding-partners/relationship-protections/${ownership.relationshipProtectionId}`}
                >
                  <LifecycleStatusBadge status={ownership.lifecycleStatus} />
                </Link>
              ) : (
                <LifecycleStatusBadge status={ownership.lifecycleStatus} />
              )
            ) : (
              "—"
            )}
          </dd>
          <dt>Introduced Date</dt>
          <dd>{formatDate(ownership.introducedAt)}</dd>
          <dt>Last Activity Date</dt>
          <dd>
            {ownership.lastActivityAt
              ? formatDateTime(ownership.lastActivityAt)
              : "No activity recorded"}
          </dd>
        </dl>
      )}
    </section>
  );
}
