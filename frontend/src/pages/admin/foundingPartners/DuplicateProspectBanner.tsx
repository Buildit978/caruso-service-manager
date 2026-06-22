import { Link } from "react-router-dom";
import type { DuplicateProspectMatch } from "../../../api/adminFoundingPartners";

interface DuplicateProspectBannerProps {
  matches: DuplicateProspectMatch[];
}

export default function DuplicateProspectBanner({ matches }: DuplicateProspectBannerProps) {
  if (matches.length === 0) return null;

  return (
    <div className="fp-duplicate-banner fp-no-print" role="status">
      <strong>Possible duplicate prospects</strong> — review before saving. No records will be merged
      automatically.
      <ul>
        {matches.map((m) => (
          <li key={m.prospectId}>
            <Link className="fp-link" to={`/admin/founding-partners/prospects/${m.prospectId}`}>
              {m.businessName}
            </Link>
            {m.email ? ` · ${m.email}` : ""}
            {` · matched on ${m.matchedOn.join(", ")} (${m.confidence})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
