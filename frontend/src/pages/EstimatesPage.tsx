// frontend/src/pages/EstimatesPage.tsx
import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  fetchEstimates,
  createNonClientEstimate,
  type Estimate,
  type EstimateView,
} from "../api/estimates";

function formatCustomerName(customer: Estimate["customerId"]): string {
  if (!customer) return "No customer";
  if (typeof customer === "object" && customer !== null) {
    const c = customer as { firstName?: string; lastName?: string };
    return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
  }
  return "—";
}

function getEmptyStateText(view: EstimateView): string {
  switch (view) {
    case "open":
      return "No open estimates in the pipeline. Create one from a customer page.";
    case "drafts":
      return "No draft estimates. Create one from a customer page.";
    case "all":
      return "No estimates yet. Create one from a customer page.";
    default:
      return "No estimates found.";
  }
}

export default function EstimatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creatingNonClient, setCreatingNonClient] = useState(false);

  const viewParam = searchParams.get("view");
  const view: EstimateView =
    viewParam === "open" || viewParam === "drafts" || viewParam === "all"
      ? viewParam
      : "open";

  const setView = (v: EstimateView) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [paging, setPaging] = useState({
    skip: 0,
    limit: 50,
    returned: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt-desc" | "createdAt-asc">("createdAt-desc");

  const sortParam =
    sort === "createdAt-asc" ? "createdAt_asc" : "createdAt_desc";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchEstimates({
          view,
          q: search.trim() || undefined,
          limit: 50,
          skip: 0,
          sort: sortParam,
        });
        if (!cancelled) {
          setEstimates(res.items ?? []);
          setPaging(res.paging ?? { skip: 0, limit: 50, returned: 0, total: 0 });
        }
      } catch (err) {
        console.error("[EstimatesPage] fetch error:", err);
        if (!cancelled) {
          setEstimates([]);
          setPaging({ skip: 0, limit: 50, returned: 0, total: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [view, search, sort]);

  const handleCreateNonClient = async () => {
    if (creatingNonClient) return;
    setCreatingNonClient(true);
    try {
      const est = await createNonClientEstimate();
      navigate(`/estimates/${est._id}`);
    } catch (err) {
      console.error(err);
      alert("Could not create non-client estimate.");
    } finally {
      setCreatingNonClient(false);
    }
  };

  const displayedEstimates = estimates;

  return (
    <div className="page">
      <div
        style={{
          marginBottom: "40px",
        }}
      >
        <div
          className="page-header"
          style={{
            maxWidth: "1100px",
            marginLeft: "auto",
            marginRight: "auto",
            paddingRight: "100px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <h1 className="text-xl font-semibold" style={{ margin: 0 }}>
            Estimates
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <input
              type="text"
              placeholder="Search by estimate #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                height: "32px",
                padding: "0 10px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "white",
                color: "#111827",
                minWidth: "200px",
              }}
            />

            <button
              type="button"
              onClick={handleCreateNonClient}
              disabled={creatingNonClient}
              style={{
                height: "32px",
                padding: "0 12px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: creatingNonClient ? "#e2e8f0" : "white",
                color: creatingNonClient ? "#94a3b8" : "#111827",
                cursor: creatingNonClient ? "not-allowed" : "pointer",
              }}
            >
              + Non-Client Estimate
            </button>

            <div
              role="tablist"
              aria-label="Estimate view"
              style={{
                display: "flex",
                gap: 0,
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              {(["open", "drafts", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.9rem",
                    border: "none",
                    background: view === v ? "#0f172a" : "white",
                    color: view === v ? "white" : "#111827",
                    cursor: "pointer",
                  }}
                >
                  {v === "open" ? "Open" : v === "drafts" ? "Drafts" : "All"}
                </button>
              ))}
            </div>

            <select
              aria-label="Sort estimates"
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "createdAt-desc" | "createdAt-asc")
              }
              style={{
                height: "32px",
                padding: "0 8px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "white",
                color: "#111827",
              }}
            >
              <option value="createdAt-desc">Created (Newest)</option>
              <option value="createdAt-asc">Created (Oldest)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading estimates…</p>
      ) : displayedEstimates.length === 0 ? (
        <p className="text-sm text-slate-500">{getEmptyStateText(view)}</p>
      ) : (
        <div className="table-scroll">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  #
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Customer
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Status
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Converted
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedEstimates.map((est: Estimate) => (
                <tr
                  key={est._id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 whitespace-nowrap font-mono text-slate-700">
                    <Link
                      to={`/estimates/${est._id}`}
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      {est.estimateNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {(est as { kind?: string }).kind === "non_client"
                      ? (() => {
                          const first = (est.nonClient?.name ?? "").trim();
                          const last = (est.nonClient?.lastName ?? "").trim();
                          const full = `${first} ${last}`.trim();
                          return full || "Non-client";
                        })()
                      : formatCustomerName(est.customerId)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300"
                    >
                      {est.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {est.convertedToWorkOrderId ? (
                      <Link
                        to={`/work-orders/${typeof est.convertedToWorkOrderId === "string" ? est.convertedToWorkOrderId : (est.convertedToWorkOrderId as any)?._id ?? ""}`}
                        style={{ color: "#2563eb", textDecoration: "underline" }}
                      >
                        View Work Order
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                    {est.createdAt
                      ? new Date(est.createdAt).toLocaleDateString("en-CA")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && paging.total > 0 && (
        <p className="text-sm text-slate-500 mt-2">
          Showing {paging.returned} of {paging.total} estimates
        </p>
      )}
    </div>
  );
}
