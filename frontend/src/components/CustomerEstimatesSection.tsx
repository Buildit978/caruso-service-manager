// frontend/src/components/CustomerEstimatesSection.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCustomerEstimates, type Estimate } from "../api/estimates";

interface CustomerEstimatesSectionProps {
  customerId: string;
}

export default function CustomerEstimatesSection({
  customerId,
}: CustomerEstimatesSectionProps) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getCustomerEstimates(customerId)
      .then((data) => {
        if (!cancelled) {
          setEstimates(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load estimates.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function getWorkOrderId(est: Estimate): string | null {
    const raw = est.convertedToWorkOrderId;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    return (raw as { _id?: string })?._id ?? null;
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>Estimates</h3>
      <p
        style={{
          fontSize: "0.85rem",
          color: "#9ca3af",
          marginBottom: "0.75rem",
          marginTop: 0,
        }}
      >
        Estimates for this customer. Convert approved estimates to work orders from the Estimates page.
      </p>

      {loading ? (
        <p>Loading estimates…</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : estimates.length === 0 ? (
        <p>No estimates for this customer yet.</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem", marginBottom: "1rem" }}>
          {estimates.map((est) => {
            const woId = getWorkOrderId(est);
            return (
              <li key={est._id} style={{ marginBottom: "0.25rem" }}>
                <div
                  className="cust-estimate-row"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <div className="cust-estimate-info">
                    <span>
                      {est.estimateNumber} — {est.status}
                    </span>
                  </div>
                  <div
                    className="cust-estimate-actions"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    {woId ? (
                      <Link
                        to={`/work-orders/${woId}`}
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.85rem",
                          color: "#3b82f6",
                        }}
                      >
                        View Work Order
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
