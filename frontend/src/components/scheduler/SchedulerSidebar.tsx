// frontend/src/components/scheduler/SchedulerSidebar.tsx
import type { UnscheduledWorkOrder } from "../../api/scheduler";
import { getWorkOrderTitle, truncateText } from "../../utils/workOrderDisplay";

type Props = {
  workOrders: UnscheduledWorkOrder[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectWorkOrder: (wo: UnscheduledWorkOrder) => void;
  canEdit: boolean;
  compact?: boolean;
  isMobile?: boolean;
};

function formatSecondaryLine(wo: UnscheduledWorkOrder): string {
  const parts: string[] = [];
  if (wo.customerLabel) parts.push(wo.customerLabel);
  if (wo.vehicleLabel) parts.push(wo.vehicleLabel);
  return parts.join(" • ") || "";
}

const touchTargetStyle = {
  touchAction: "manipulation" as const,
  WebkitTapHighlightColor: "transparent",
  userSelect: "none" as const,
};

export default function SchedulerSidebar({
  workOrders,
  loading,
  search,
  onSearchChange,
  onSelectWorkOrder,
  canEdit,
  compact = false,
  isMobile = false,
}: Props) {
  return (
    <div
      style={{
        width: compact ? "100%" : "280px",
        minWidth: compact ? undefined : "280px",
        maxHeight: compact && !isMobile ? "35vh" : undefined,
        overflowY: compact && isMobile ? "visible" : undefined,
        borderRight: compact ? undefined : "1px solid #1f2937",
        borderBottom: compact ? "1px solid #1f2937" : undefined,
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid #1f2937" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#e5e7eb" }}>
          Unscheduled Work Orders
        </h2>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            marginTop: "0.5rem",
            width: "100%",
            padding: "0.5rem 0.75rem",
            fontSize: "0.9rem",
            borderRadius: "6px",
            border: "1px solid #475569",
            background: "#020617",
            color: "#e5e7eb",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          overflowY: isMobile ? "visible" : "auto",
          padding: "0.5rem",
        }}
      >
        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Loading…</p>
        ) : workOrders.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No unscheduled work orders.</p>
        ) : (
          workOrders.map((wo) => (
            <button
              key={wo._id}
              type="button"
              onClick={() => canEdit && onSelectWorkOrder(wo)}
              disabled={!canEdit}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: isMobile ? "0.75rem 1rem" : "0.6rem 0.75rem",
                minHeight: isMobile ? 44 : undefined,
                marginBottom: "0.25rem",
                borderRadius: "6px",
                border: "1px solid #1f2937",
                background: canEdit ? "#1e293b" : "#0f172a",
                color: "#e5e7eb",
                fontSize: "0.85rem",
                cursor: canEdit ? "pointer" : "default",
                ...(isMobile ? touchTargetStyle : {}),
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                {truncateText(getWorkOrderTitle(wo), 50)}
              </div>
              {formatSecondaryLine(wo) && (
                <div style={{ color: "#94a3b8", lineHeight: 1.3, fontSize: "0.8rem" }}>
                  {formatSecondaryLine(wo)}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
