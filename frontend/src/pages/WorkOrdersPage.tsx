// src/pages/WorkOrdersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import type { WorkOrder } from "../types/workOrder";
import type { Customer } from "../types/customer";
import { fetchWorkOrders } from "../api/workOrders";
import { formatMoney } from "../utils/money";

type ViewFilter = "active" | "financial" | "archive" | "all";

type InvoiceFinancialStatus = "paid" | "partial" | "due";

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // URL params (stable)
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const viewParam = query.get("view"); // e.g. financial
  const customerId = query.get("customerId") || null;

  // State
  const [view, setView] = useState<ViewFilter>(() => {
    if (
      viewParam === "active" ||
      viewParam === "financial" ||
      viewParam === "archive" ||
      viewParam === "all"
    ) {
      return viewParam;
    }
    return "active";
  });

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<
    | "createdAt-desc"
    | "createdAt-asc"
    | "status-asc"
    | "status-desc"
    | "customer-asc"
    | "customer-desc"
  >("createdAt-desc");

  const [search, setSearch] = useState("");

  // If URL view changes (Dashboard click again), sync it into state
  useEffect(() => {
    if (
      viewParam === "active" ||
      viewParam === "financial" ||
      viewParam === "archive" ||
      viewParam === "all"
    ) {
      setView(viewParam);
    }
  }, [viewParam]);

  // Helpers
  const formatCustomerName = (customer?: Customer) => {
    if (!customer) return "No customer";
    return (
      customer.name ||
      customer.fullName ||
      `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
      "(No name)"
    );
  };

  function isValidMongoId(id: string) {
    return /^[a-f\d]{24}$/i.test(id);
  }

  function resolveInvoiceId(wo: any): string | null {
    const raw = wo?.invoiceId ?? wo?.invoice?._id ?? wo?.invoice?.id ?? null;
    if (!raw) return null;

    if (typeof raw === "string") return raw;

    if (typeof raw === "object") {
      if (typeof raw._id === "string") return raw._id;
      if (raw._id && typeof raw._id.toString === "function")
        return raw._id.toString();
      if (typeof raw.toString === "function") return raw.toString();
    }

    return null;
  }

  function handleView(wo: any) {
    const inFinancialMode = view === "financial" || view === "archive";
    const invoiceId = resolveInvoiceId(wo);

    if (inFinancialMode && invoiceId && isValidMongoId(invoiceId)) {
      navigate(`/invoices/${invoiceId}`);
      return;
    }

    navigate(`/work-orders/${wo._id}`);
  }

  // ✅ One invoice label function used everywhere (VOID overrides money)
  function getInvoiceLabel(inv?: any): "VOID" | "PAID" | "PARTIAL" | "DUE" | "—" {
    if (!inv) return "—";

    const lifecycle = String(inv.status || "").toLowerCase();
    if (lifecycle === "void") return "VOID";

    const fs = (inv.financialStatus as InvoiceFinancialStatus | undefined) || undefined;
    if (fs === "paid") return "PAID";
    if (fs === "partial") return "PARTIAL";
    if (fs === "due") return "DUE";

    // fallback (legacy safety)
    const total = Number(inv.total ?? 0);
    const paid = Number(inv.paidAmount ?? 0);
    const bal =
      typeof inv.balanceDue !== "undefined"
        ? Number(inv.balanceDue ?? 0)
        : Math.max(0, total - paid);

    if (total > 0 && bal <= 0) return "PAID";
    if (paid > 0 && bal > 0) return "PARTIAL";
    if (total > 0) return "DUE";
    return "—";
  }

  function invoicePillClass(label: string) {
    switch (label) {
      case "PAID":
        return "bg-green-50 text-green-700 border border-green-600";
      case "PARTIAL":
        return "bg-amber-50 text-amber-700 border border-amber-600";
      case "DUE":
        return "bg-red-50 text-red-700 border border-red-600";
      case "VOID":
        return "bg-gray-100 text-gray-700 border border-gray-400";
      default:
        return "bg-gray-50 text-gray-600 border border-gray-300";
    }
  }

  // Fetch work orders (server sort where applicable)
  useEffect(() => {
    const loadWorkOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const isCustomerSort = sort === "customer-asc" || sort === "customer-desc";

        let sortBy: "createdAt" | "status" | undefined;
        let sortDir: "asc" | "desc" | undefined;

        if (!isCustomerSort) {
          switch (sort) {
            case "status-asc":
              sortBy = "status";
              sortDir = "asc";
              break;
            case "status-desc":
              sortBy = "status";
              sortDir = "desc";
              break;
            case "createdAt-asc":
              sortBy = "createdAt";
              sortDir = "asc";
              break;
            case "createdAt-desc":
            default:
              sortBy = "createdAt";
              sortDir = "desc";
              break;
          }
        }

        const raw = await fetchWorkOrders({
          customerId: customerId || undefined,
          view,
          ...(sortBy ? { sortBy } : {}),
          ...(sortDir ? { sortDir } : {}),
        });

        // ✅ Normalize and preserve invoice.financialStatus
        const normalized = (raw || []).map((wo: any) => {
          const inv = wo?.invoice ?? wo?.invoiceId;

          return {
            ...wo,
            customer:
              wo.customerId && typeof wo.customerId === "object"
                ? wo.customerId
                : undefined,

            invoice: inv
              ? {
                  _id: inv._id,
                  invoiceNumber: inv.invoiceNumber,
                  status: inv.status,
                  total: inv.total,
                  paidAmount: inv.paidAmount,
                  balanceDue: inv.balanceDue,
                  payments: inv.payments,
                  sentAt: inv.sentAt,
                  paidAt: inv.paidAt,
                  financialStatus: inv.financialStatus,
                }
              : undefined,
          };
        });

        setWorkOrders(normalized);
      } catch (err: any) {
        console.error("Error fetching work orders:", err);
        setError(err.message || "Failed to load work orders");
      } finally {
        setLoading(false);
      }
    };

    loadWorkOrders();
  }, [customerId, sort, view]);

  // Title
  const title = customerId ? "Work Orders for Selected Customer" : "All Work Orders";

  if (loading) return <div className="p-6">Loading work orders...</div>;

  if (error) {
    return (
      <div className="p-6 text-red-600">
        There was a problem loading work orders: {error}
      </div>
    );
  }

  // Client-side search + customer sort only (view filtering is server-driven)
  const displayedWorkOrders = (() => {
    let list = Array.isArray(workOrders) ? [...workOrders] : [];

    // Search
    const q = String(search || "").trim().toLowerCase();
    if (q) {
      list = list.filter((wo: any) =>
        formatCustomerName(wo?.customer).toLowerCase().includes(q)
      );
    }

    // Customer sorting (frontend)
    if (sort === "customer-asc" || sort === "customer-desc") {
      const dir = sort === "customer-asc" ? 1 : -1;

      list.sort((a: any, b: any) => {
        const nameA = formatCustomerName(a?.customer).toLowerCase();
        const nameB = formatCustomerName(b?.customer).toLowerCase();
        if (nameA < nameB) return -1 * dir;
        if (nameA > nameB) return 1 * dir;
        return 0;
      });
    }

    return list;
  })();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div
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
          {/* Left: Title */}
          <h1 className="text-2xl font-semibold">{title}</h1>

          {/* Right: Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* 🔍 Search */}
            <input
              type="text"
              placeholder="Search by customer…"
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
                minWidth: "220px",
              }}
            />

            {/* 🧾 View Filter */}
            <select
              aria-label="Filter by status"
              title="Filter by status"
              value={view}
              onChange={(e) => setView(e.target.value as ViewFilter)}
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
              <option value="active">Active</option>
              <option value="financial">Financial</option>
              <option value="archive">Archive</option>
              <option value="all">All</option>
            </select>

            {/* 🔃 Sort */}
            <select
              aria-label="Sort work orders"
              title="Sort work orders"
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value as
                    | "createdAt-desc"
                    | "createdAt-asc"
                    | "status-asc"
                    | "status-desc"
                    | "customer-asc"
                    | "customer-desc"
                )
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
              <option value="status-asc">Status A–Z</option>
              <option value="status-desc">Status Z–A</option>
              <option value="customer-asc">Customer A–Z</option>
              <option value="customer-desc">Customer Z–A</option>
            </select>

            {/* ➕ Button */}
            <Link
              to="/work-orders/new"
              className="inline-block font-medium text-sm px-4 py-2 rounded"
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                whiteSpace: "nowrap",
              }}
            >
              + New Work Order
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6"></div>

      {displayedWorkOrders.length === 0 ? (
        <p className="text-sm text-slate-500">
          {customerId
            ? "No work orders found for this customer yet."
            : "No work orders found yet."}
        </p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  ID
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Customer
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  View
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Status
                </th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">
                  Total
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              {displayedWorkOrders.map((wo: any) => {
                const inv = wo?.invoice;
                const label = getInvoiceLabel(inv);

                const paidAmt = Number(inv?.paidAmount || 0);
                const bal = Number(inv?.balanceDue || 0);
                const total = Number(inv?.total || 0);

                const detail =
                  label === "PARTIAL"
                    ? `${formatMoney(paidAmt)} • Bal ${formatMoney(bal)}`
                    : label === "DUE"
                    ? `${formatMoney(total)} • Bal ${formatMoney(bal)}`
                    : label === "PAID"
                    ? `${formatMoney(total)}`
                    : "";

                return (
                  <tr
                    key={wo._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {wo._id}
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatCustomerName(wo.customer)}
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleView(wo)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "28px",
                          padding: "0 20px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#0a0337ff",
                          color: "#f9fafbff",
                          fontSize: "1rem",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>
                    </td>

                    {/* ✅ Invoice / Financial Status */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {inv ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${invoicePillClass(
                              label
                            )}`}
                          >
                            {label}
                          </span>
                          {detail ? (
                            <span className="text-slate-600">{detail}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      {formatMoney(wo.total ?? 0)}
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                      {wo.createdAt
                        ? new Date(wo.createdAt).toLocaleDateString("en-CA")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}