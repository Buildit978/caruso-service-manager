// src/pages/WorkOrdersPage.tsx
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import type { WorkOrder } from "../types/workOrder";
import type { Customer } from "../types/customer";
import { fetchWorkOrders } from "../api/workOrders";


function useQuery() {
    const { search } = useLocation();
    return new URLSearchParams(search);
}

      type StatusFilter =
  | "active"
  | "open"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "all";




export default function WorkOrdersPage() {
    const query = useQuery();
    const customerId = query.get("customerId");

    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  // 🔹 NEW: sort state
  


   const [sort, setSort] = useState<
  | "createdAt-desc"
  | "createdAt-asc"
  | "status-asc"
  | "status-desc"
  | "customer-asc"
  | "customer-desc"
>("createdAt-desc");

  const [search, setSearch] = useState("");

  const [status, setStatus] = useState<StatusFilter>("active");


  

    // Helper: format customer name safely
    const formatCustomerName = (customer?: Customer) => {
        if (!customer) return "No customer";
        return (
            customer.name || // optional precomputed name
            customer.fullName ||
            `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
            "(No name)"
        );
    };

useEffect(() => {
  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // If we're sorting by customer, do NOT refetch — we'll sort in render
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
        status: status === "all" ? undefined : status, // ✅ key line
        ...(sortBy ? { sortBy } : {}),
        ...(sortDir ? { sortDir } : {}),
      });

      const normalized: WorkOrder[] = raw.map((wo: any) => ({
        ...wo,
        customer:
          wo.customer ??
          (typeof wo.customerId === "object" ? wo.customerId : undefined),
      }));

      setWorkOrders(normalized);
    } catch (err: any) {
      console.error("Error fetching work orders:", err);
      setError(err.message || "Failed to load work orders");
    } finally {
      setLoading(false);
    }
  };

  loadWorkOrders();
}, [customerId, sort, status]);




    const title = customerId
        ? "Work Orders for Selected Customer"
        : "All Work Orders";

    if (loading) {
        return <div className="p-6">Loading work orders...</div>;
    }

    if (error) {
        return (
            <div className="p-6 text-red-600">
                There was a problem loading work orders: {error}
            </div>
        );
    }

 
const displayedWorkOrders = (() => {
  let list = [...workOrders];

  // 🔍 Search by customer name
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((wo) =>
      formatCustomerName(wo.customer).toLowerCase().includes(q)
    );
  }

  // 🔤 Customer A–Z / Z–A sorting (frontend)
  if (sort === "customer-asc" || sort === "customer-desc") {
    const dir = sort === "customer-asc" ? 1 : -1;

    list.sort((a, b) => {
      const nameA = formatCustomerName(a.customer).toLowerCase();
      const nameB = formatCustomerName(b.customer).toLowerCase();

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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
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
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="invoiced">Invoiced</option>
          <option value="all">All</option>
        </select>

          <select
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
    {workOrders.length === 0 ? (
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
                                {displayedWorkOrders.map((wo) => (

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
                                            <Link
                                                to={`/work-orders/${wo._id}`}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                View
                    </Link>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    wo.status === "completed"
                                                        ? "bg-green-100 text-green-700"
                                                        : wo.status === "in_progress"
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : wo.status === "invoiced"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-blue-100 text-blue-700"
                                                    }`}
                                            >
                                                {wo.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                            {(wo.total ?? 0).toLocaleString("en-CA", {
                                                style: "currency",
                                                currency: "CAD",
                                            })}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                                            {new Date(wo.createdAt).toLocaleDateString("en-CA")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
        </div>
    );
}
