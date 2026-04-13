// frontend/src/components/scheduler/SchedulerAgenda.tsx
import type { ScheduleEntry } from "../../api/scheduler";
import { toISODateLocal } from "../../utils/dateTime";
import { getWorkOrderTitle } from "../../utils/workOrderDisplay";

type Props = {
  entries: ScheduleEntry[];
  viewDate: Date;
  canEdit: boolean;
  onEntryClick: (entry: ScheduleEntry) => void;
  onAddClick?: () => void;
  isMobile?: boolean;
  /** Accepted for API symmetry with sidebar; unused here */
  highlightWorkOrderId?: string | null;
  highlightEntryId?: string | null;
};

const touchTargetStyle = {
  touchAction: "manipulation" as const,
  WebkitTapHighlightColor: "transparent",
  userSelect: "none" as const,
};

function formatSecondaryLine(entry: ScheduleEntry): string {
  const wo = entry.workOrder;
  if (!wo) return "";
  const parts: string[] = [];
  if (wo.customerLabel) parts.push(wo.customerLabel);
  if (wo.vehicleLabel) parts.push(wo.vehicleLabel);
  return parts.join(" • ");
}

export default function SchedulerAgenda({
  entries,
  viewDate,
  canEdit,
  onEntryClick,
  onAddClick,
  isMobile = false,
  highlightEntryId = null,
}: Props) {
  const dayStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const startStr = toISODateLocal(dayStart);
  const endStr = toISODateLocal(dayEnd);

  const dayEntries = entries
    .filter((e) => {
      const d = new Date(e.startAt);
      const dateStr = toISODateLocal(d);
      return dateStr >= startStr && dateStr <= endStr;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div
      style={{
        flex: 1,
        overflowY: isMobile ? "visible" : "auto",
        minHeight: isMobile ? undefined : 0,
        padding: "0.5rem 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          padding: "0 0.25rem",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            color: "#94a3b8",
          }}
        >
          {viewDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        </div>
        {canEdit && onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            style={{
              padding: isMobile ? "0.6rem 1rem" : "0.4rem 0.75rem",
              minHeight: isMobile ? 44 : undefined,
              fontSize: "0.85rem",
              borderRadius: "6px",
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              ...(isMobile ? touchTargetStyle : {}),
            }}
          >
            Schedule
          </button>
        )}
      </div>
      {dayEntries.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", padding: "0 0.25rem" }}>
          No scheduled entries for this day.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {dayEntries.map((entry) => {
            const highlighted = highlightEntryId && entry._id === highlightEntryId;
            return (
            <button
              key={entry._id}
              type="button"
              onClick={() => onEntryClick(entry)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: isMobile ? "1rem 1.25rem" : "0.75rem 1rem",
                minHeight: isMobile ? 44 : undefined,
                borderRadius: "8px",
                border: highlighted ? "2px solid #fbbf24" : "1px solid #1f2937",
                background: highlighted ? "rgba(37, 99, 235, 0.35)" : "#1e293b",
                color: "#e5e7eb",
                cursor: "pointer",
                ...(isMobile ? touchTargetStyle : {}),
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#60a5fa",
                  marginBottom: "0.25rem",
                }}
              >
                {new Date(entry.startAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {entry.technicianLabel ? ` • ${entry.technicianLabel}` : ""}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.2rem" }}>
                {getWorkOrderTitle(entry.workOrder)}
              </div>
              {formatSecondaryLine(entry) && (
                <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                  {formatSecondaryLine(entry)}
                </div>
              )}
            </button>
          );
          })}
        </div>
      )}
    </div>
  );
}
