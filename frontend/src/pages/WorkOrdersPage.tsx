// src/pages/WorkOrdersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import type { WorkOrder } from "../types/workOrder";
import type { Customer } from "../types/customer";
import { fetchWorkOrders } from "../api/workOrders";
import { formatMoney } from "../utils/money";




type ViewFilter = "active" | "financial" | "archive" | "all";

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // URL params (stable)
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const viewParam = query.get("view"); // e.g. financial
  const customerId = query.get("customerId") || null;

  // State
  const [view, setView] = useState<ViewFilter>(() => {
    if (viewParam === "active" || viewParam === "financial" || viewParam === "archive" || viewParam === "all") {
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
    if (viewParam === "active" || viewParam === "financial" || viewParam === "archive" || viewParam === "all") {
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
      if (raw._id && typeof raw._id.toString === "function") return raw._id.toString();
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

  function formatStatusLabel(s?: string) {
    if (!s) return "";
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function workPillClass(status?: string) {
    const s = (status || "").toLowerCase();
    if (s === "completed") return "bg-green-100 text-green-700";
    if (s === "in_progress") return "bg-yellow-100 text-yellow-700";
    if (s === "on_hold") return "bg-orange-100 text-orange-700";
    if (s === "cancelled") return "bg-red-100 text-red-700";
    return "bg-blue-100 text-blue-700";
  }

  // One and only one invoice pill class function
  function invoicePillClass(label?: string) {
    const s = (label || "").toLowerCase();
    if (s === "paid") return "bg-green-100 text-green-700";
    if (s === "partial") return "bg-amber-100 text-amber-800";
    if (s === "sent") return "bg-blue-100 text-blue-700";
    if (s === "void") return "bg-red-100 text-red-700";
    if (s === "draft") return "bg-slate-100 text-slate-700";
    if (s === "no invoice") return "bg-slate-50 text-slate-500";
    return "bg-slate-50 text-slate-500";
  }

  function getInvoiceDisplayLabel(inv?: any) {
  if (!inv) return "—";

  // lifecycle-only states still matter
  if (inv.status === "void") return "VOID";
  if (inv.status === "draft") return "DRAFT";

  // ✅ ONE financial truth for money label
  const fs = inv.financialStatus as "due" | "partial" | "paid" | undefined;
  if (fs) return fs.toUpperCase(); // DUE / PARTIAL / PAID

  // fallback (shouldn't happen if backend is correct)
  return "DUE";
}

  
  function invoicePillClass(label: string) {
  switch (label) {
    case "PAID":
      return "bg-green-50 text-green-700 border border-green-600";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 border border-amber-600";
    case "SENT":
      return "bg-blue-50 text-blue-700 border border-blue-600";
    case "DRAFT":
      return "bg-gray-100 text-gray-700 border border-gray-400";
    case "VOID":
      return "bg-red-50 text-red-700 border border-red-600";
    case "NO INVOICE":
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

const normalized = (raw || []).map((wo: any) => {
  const inv = wo?.invoice ?? wo?.invoiceId; // or however you're choosing it

  return {
    ...wo,
    customer:
      wo.customerId && typeof wo.customerId === "object"
        ? wo.customerId
        : undefined,

    // ✅ keep invoice normalized but DO NOT drop financialStatus
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
          financialStatus: inv.financialStatus, // ✅ ADD THIS
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
    return <div className="p-6 text-red-600">There was a problem loading work orders: {error}</div>;
  }

  console.log("[WO] workOrders raw:", workOrders, "len:", Array.isArray(workOrders) ? workOrders.length : "not-array");
console.log("[WO] view:", view, "search:", search, "sort:", sort);


 // Filtering/sorting (client-side)
  const displayedWorkOrders = (() => {
  let list = Array.isArray(workOrders) ? [...workOrders] : [];


    if (view === "financial") {
  const w0 = list?.[0];
  console.log("[FIN SHAPE 0]", {
    keys: w0 ? Object.keys(w0) : null,
    invoiceKeys: w0?.invoice ? Object.keys(w0.invoice) : null,
    invoiceIdType: typeof (w0 as any)?.invoiceId,
    invoiceIdKeys:
      (w0 as any)?.invoiceId && typeof (w0 as any).invoiceId === "object"
        ? Object.keys((w0 as any).invoiceId)
        : null,
  });
  console.log("[FIN RAW 0]", w0);
}


  console.log("[DEBUG] workOrders len:", Array.isArray(workOrders) ? workOrders.length : "not-array", workOrders);



  const norm = (x: any) => String(x || "").trim().toLowerCase();

  const getInv = (wo: any) =>
  wo?.invoice ?? // ✅ prefer populated invoice (has financialStatus)
  (wo as any)?.invoiceId ?? // fallback (often missing financialStatus)
  (wo as any)?.latestInvoice ??
  (Array.isArray((wo as any)?.invoices) ? (wo as any).invoices[0] : undefined);


  const getLifecycle = (wo: any) => norm(getInv(wo)?.status); // draft | sent | void
    const getFinancial = (wo: any) => norm(wo?.financialStatus ?? getInv(wo)?.financialStatus); // due | partial | paid
    
    if (view === "financial") console.log("[FIN quick counts]", {
          due: list.filter((w:any) => getFinancial(w)==="due").length,
          partial: list.filter((w:any) => getFinancial(w)==="partial").length,
          paid: list.filter((w:any) => getFinancial(w)==="paid").length,
        });


  const isArchived = (wo: any) => {
    // ✅ archive is NOT money truth — it's closure + void
    if (wo?.closedAt) return true;
    if (getLifecycle(wo) === "void") return true;
    return false;
  };

  const isFinancialOpen = (wo: any) => {
    // ✅ financial list shows only open money: due/partial
    const fs = getFinancial(wo);
    if (!fs) return false;
    return fs === "due" || fs === "partial";
  };

  // Search
  const q = String(search || "").trim().toLowerCase();
  if (q) {
    list = list.filter((wo: any) =>
      formatCustomerName(wo?.customer).toLowerCase().includes(q)
    );
  }

    if (view === "financial") {
  console.log("[DEBUG:PRE-FILTER:FINANCIAL]", {
    total: list.length,
    withInvoice: list.filter((w: any) => !!w?.invoice).length,
    withAnyInvoiceLike:
      list.filter(
        (w: any) =>
          w?.invoice ||
          w?.latestInvoice ||
          (Array.isArray(w?.invoices) && w.invoices.length > 0)
      ).length,
    financialStatuses: list.map((w: any) => ({
      id: w?._id,
      fs:
        w?.invoice?.financialStatus ??
        w?.latestInvoice?.financialStatus ??
        (Array.isArray(w?.invoices) ? w.invoices[0]?.financialStatus : undefined),
    })),
  });
}


    if (view === "financial") {
  console.log("[DEBUG:PRE-FILTER:FIN]", {
    listLen: list.length,
    sampleKeys0: list[0] ? Object.keys(list[0]) : null,
    sampleInvoice0: list[0]?.invoice,
    sampleLatestInvoice0: (list[0] as any)?.latestInvoice,
    sampleInvoices0: (list[0] as any)?.invoices,
  });
}


    // View filter
    list = list.filter((wo: any) => {
      const inv =
        wo?.invoice ??
        (wo as any)?.latestInvoice ??
        (Array.isArray((wo as any)?.invoices) ? (wo as any).invoices[0] : undefined);

      const lifecycle = String(inv?.status || "").trim().toLowerCase();        // draft | sent | void
      const fs = String(getInv(wo)?.financialStatus || "")
      .trim()
      .toLowerCase(); // due | partial | paid

     

      // ✅ Archive definition: paid OR closed OR void
      const archived = fs === "paid" || !!wo?.closedAt || lifecycle === "void";

      // ✅ DEBUG (SAFE): now lifecycle/fs exist
      if (view === "financial") {
        console.log("[DEBUG:FILTER:FIN]", {
          id: wo?._id,
          hasInv: !!inv,
          lifecycle,
          fs,
          closedAt: !!wo?.closedAt,
          archived,
          passes: !archived && (fs === "due" || fs === "partial"),
        });
      }

      switch (view) {
        case "archive":
          return archived;

        case "active":
          return !archived;

        case "financial":
          // ✅ Financial = open money only (due/partial), not archived, not void
          return !archived && (fs === "due" || fs === "partial");

        case "all":
        default:
          return true;
      }
    });


if (view === "financial") {
  console.log("[FIN RESULT]", {
    afterFilter: list.length,
    due: list.filter((w: any) => String(w?.financialStatus ?? w?.invoiceId?.financialStatus ?? w?.invoice?.financialStatus ?? "").toLowerCase() === "due").length,
    partial: list.filter((w: any) => String(w?.financialStatus ?? w?.invoiceId?.financialStatus ?? w?.invoice?.financialStatus ?? "").toLowerCase() === "partial").length,
    paid: list.filter((w: any) => String(w?.financialStatus ?? w?.invoiceId?.financialStatus ?? w?.invoice?.financialStatus ?? "").toLowerCase() === "paid").length,
    closed: list.filter((w: any) => !!w?.closedAt).length,
  });
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

 if (view === "financial") {
  console.log("[RENDER CHECK SAMPLE IDS]", displayedWorkOrders.slice(0, 5).map((w: any) => w?._id));
}


// ---- Financial helpers (backend truth only) ----
type InvoiceFinancialStatus = "paid" | "partial" | "due";

function getInvoiceFinancialLabel(
  wo: any
): "NO INVOICE" | "VOID" | "PAID" | "PARTIAL" | "SENT" {
  const inv = wo?.invoice;
  if (!inv) return "NO INVOICE";

  const lifecycle = String(inv.status || "").toLowerCase();
  if (lifecycle === "void") return "VOID";

  const fin = inv.financialStatus as InvoiceFinancialStatus | undefined;

  if (fin === "paid") return "PAID";
  if (fin === "partial") return "PARTIAL";

  // due → use existing UI language
  return "SENT";
}


  // ✅ JSX return starts after this...



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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
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

          {/* 🔃 Sort */}
          {/* 🧾 Status Filter */}
        <select aria-label="Filter by status" title="Filter by status"
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


          <select aria-label="Sort work orders" title="Sort work orders"
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
    {/* ⬇️ everything below this stays exactly as you had it (no changes) */}
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
  {displayedWorkOrders.length === 0 ? (
    <tr>
      <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
        No work orders found.
      </td>
    </tr>
  ) : (
    displayedWorkOrders.map((wo: any) => (
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

        {/* ✅ Financial status column (ONE truth) */}
     

        <td className="px-4 py-2 whitespace-nowrap">
  {(() => {
    const inv = wo?.invoice;
    if (!inv) return null;

    const fs = (inv.financialStatus as "due" | "partial" | "paid" | undefined) || undefined;

    const label =
      fs === "paid"
        ? "PAID "
        : fs === "partial"
        ? "PARTIAL "
        : fs === "due"
        ? "DUE "
        : "— ";

    const paidAmt = Number(inv.paidAmount || 0);
    const bal = Number(inv.balanceDue || 0);
    const total = Number(inv.total || 0);

    // ✅ Detail text without repeating the label word
    const detail =
      fs === "partial"
        ? `${formatMoney(paidAmt)} • Bal ${formatMoney(bal)}`
        : fs === "due"
        ? `${formatMoney(total)} • Bal ${formatMoney(bal)}`
        : fs === "paid"
        ? `${formatMoney(total)}`
        : "";

    return (
  <div className="flex items-center gap-2">
    <span className="font-semibold">{label}</span>
    {detail ? (
      <span className="text-slate-600">{detail}</span>
    ) : null}
  </div>
);
  })()}
</td>


        <td className="px-4 py-2 whitespace-nowrap text-right">
          {formatMoney(wo.total ?? 0)}
        </td>

        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
          {wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-CA") : "—"}
        </td>
      </tr>
    ))
  )}
</tbody>


                          
                        </table>
                    </div>
                )}
        </div>
    );
}
