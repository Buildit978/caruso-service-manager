import { Link } from "react-router-dom";
import type { PendingIntroduction } from "../../../api/adminFoundingPartners";
import { ProtectionStatusBadge } from "./foundingPartnerBadges";
import { formatDate } from "./foundingPartnerFormat";

interface PendingIntroductionsSectionProps {
  items: PendingIntroduction[];
}

export default function PendingIntroductionsSection({ items }: PendingIntroductionsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="fp-card">
      <h2 className="fp-section-title">Pending Introductions ({items.length})</h2>
      <ul className="fp-notes-list">
        {items.map((item) => (
          <li key={item.id} className="fp-note-item">
            <div className="fp-note-meta">
              <ProtectionStatusBadge status={item.protectionStatus} />
              <span>Introduced {formatDate(item.introducedAt)}</span>
            </div>
            <p className="fp-note-summary">
              <Link className="fp-link" to={`/admin/founding-partners/partners/${item.partnerId}`}>
                {item.partnerName}
              </Link>
              {" · "}
              <Link
                className="fp-link"
                to={`/admin/founding-partners/relationship-protections/${item.id}`}
              >
                View introduction
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
