// frontend/src/components/scheduler/SchedulerToolbar.tsx
import { toISODateLocal } from "../../utils/dateTime";

type ViewMode = "day" | "week";

type Props = {
  viewDate: Date;
  viewMode: ViewMode;
  technicianId: string;
  technicians: { id: string; name: string }[];
  onViewDateChange: (d: Date) => void;
  onViewModeChange: (m: ViewMode) => void;
  onTechnicianChange: (id: string) => void;
  hideViewToggle?: boolean;
  isMobile?: boolean;
};

const touchTargetStyle = {
  touchAction: "manipulation" as const,
  WebkitTapHighlightColor: "transparent",
  userSelect: "none" as const,
};

const btnStyle = (isMobile?: boolean) => ({
  height: isMobile ? "44px" : "32px",
  minHeight: isMobile ? 44 : undefined,
  padding: isMobile ? "0 14px" : "0 10px",
  fontSize: "0.9rem",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#e5e7eb",
  cursor: "pointer" as const,
  ...(isMobile ? touchTargetStyle : {}),
});

const inputStyle = (isMobile?: boolean) => ({
  height: isMobile ? "44px" : "32px",
  minHeight: isMobile ? 44 : undefined,
  padding: isMobile ? "0 14px" : "0 10px",
  fontSize: "0.9rem",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "#e5e7eb",
});

export default function SchedulerToolbar({
  viewDate,
  viewMode,
  technicianId,
  technicians,
  onViewDateChange,
  onViewModeChange,
  onTechnicianChange,
  hideViewToggle = false,
  isMobile = false,
}: Props) {
  const btn = btnStyle(isMobile);
  const inp = inputStyle(isMobile);
  const handleToday = () => {
    onViewDateChange(new Date());
  };

  const handlePrev = () => {
    const d = new Date(viewDate);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() - 7);
    onViewDateChange(d);
  };

  const handleNext = () => {
    const d = new Date(viewDate);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else d.setDate(d.getDate() + 7);
    onViewDateChange(d);
  };

  const dateStr = viewDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
        padding: "0.75rem 0",
        borderBottom: "1px solid #1f2937",
      }}
    >
      <button type="button" onClick={handleToday} style={btn}>
        Today
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <button type="button" onClick={handlePrev} style={btn} aria-label="Previous">
          ←
        </button>
        <button type="button" onClick={handleNext} style={btn} aria-label="Next">
          →
        </button>
      </div>
      <input
        type="date"
        value={toISODateLocal(viewDate)}
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            const [y, m, d] = v.split("-").map(Number);
            onViewDateChange(new Date(y, (m ?? 1) - 1, d ?? 1));
          }
        }}
        style={inp}
      />
      <span style={{ fontSize: "0.95rem", color: "#94a3b8" }}>{dateStr}</span>
      {!hideViewToggle && (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => onViewModeChange("day")}
            style={{
              ...btn,
              background: viewMode === "day" ? "#2563eb" : "#1e293b",
            }}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("week")}
            style={{
              ...btn,
              background: viewMode === "week" ? "#2563eb" : "#1e293b",
            }}
          >
            Week
          </button>
        </div>
      )}
      <select
        value={technicianId}
        onChange={(e) => onTechnicianChange(e.target.value)}
        style={{
          ...inp,
          minWidth: "140px",
        }}
      >
        <option value="">All technicians</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
