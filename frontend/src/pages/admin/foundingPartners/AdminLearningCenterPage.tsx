import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchLearningCenterObservations,
  type LearningCenterObservation,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { FP_MODULE_TITLE, formatDateTime, apiErrorMessage } from "./foundingPartnerFormat";

export default function AdminLearningCenterPage() {
  const [items, setItems] = useState<LearningCenterObservation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLearningCenterObservations({ limit: 100 });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load observations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout title={FP_MODULE_TITLE}>
      <FoundingPartnerShell variant="list">
        <div className="fp-page-header">
          <h1 className="fp-page-title">Learning Center</h1>
          <p className="fp-muted">
            Observations shared by founding partners from their visits. Newest first.
          </p>
        </div>

        {error && <p className="fp-error">{error}</p>}
        {loading && <p className="fp-loading">Loading observations…</p>}

        {!loading && items.length === 0 && (
          <p className="fp-empty">No observations shared yet.</p>
        )}

        {!loading && items.length > 0 && (
          <>
            <p className="fp-muted fp-learning-center-count">{total} observation{total === 1 ? "" : "s"}</p>
            <ul className="fp-learning-center-list">
              {items.map((item) => (
                <li key={item.id} className="fp-card fp-learning-center-item">
                  <dl className="fp-learning-center-meta">
                    <div>
                      <dt>Date</dt>
                      <dd>{formatDateTime(item.date)}</dd>
                    </div>
                    <div>
                      <dt>Partner</dt>
                      <dd>
                        {item.partnerId ? (
                          <Link to={`/admin/founding-partners/partners/${item.partnerId}`}>
                            {item.partnerName}
                          </Link>
                        ) : (
                          item.partnerName
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Business</dt>
                      <dd>
                        {item.prospectId ? (
                          <Link to={`/admin/founding-partners/prospects/${item.prospectId}`}>
                            {item.businessName}
                          </Link>
                        ) : (
                          item.businessName
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="fp-learning-center-observation">{item.observation}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}
