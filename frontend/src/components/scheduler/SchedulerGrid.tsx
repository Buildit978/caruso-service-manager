// frontend/src/components/scheduler/SchedulerGrid.tsx
import type { ScheduleEntry } from "../../api/scheduler";
import { toISODate } from "../../utils/dateTime";
import { getWorkOrderTitle, truncateText } from "../../utils/workOrderDisplay";
import { getThisWeekRangeMondayBased } from "../../utils/weekRange";

type ViewMode = "day" | "week";

type Props = {
  entries: ScheduleEntry[];
  viewDate: Date;
  viewMode: ViewMode;
  canEdit: boolean;
  onSlotClick: (date: Date, hour: number) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
};

const HOURS_START = 6;
const HOURS_END = 21;
const SLOT_HEIGHT = 48;

function formatTime(hour: number): string {
  const h = hour % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${ampm}`;
}

export default function SchedulerGrid({
  entries,
  viewDate,
  viewMode,
  canEdit,
  onSlotClick,
  onEntryClick,
}: Props) {
  const { start: weekStart, end: weekEnd } = getThisWeekRangeMondayBased(viewDate);

  const days: Date[] = [];
  if (viewMode === "day") {
    days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate()));
  } else {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
  }

  const rangeStart = viewMode === "day" ? new Date(days[0]) : new Date(weekStart);
  const rangeEnd = viewMode === "day" ? new Date(days[0]) : new Date(weekEnd);
  rangeEnd.setHours(23, 59, 59, 999);

  const startStr = toISODate(rangeStart);
  const endStr = toISODate(rangeEnd);

  const entriesInRange = entries.filter((e) => {
    const d = new Date(e.startAt);
    const dateStr = toISODate(d);
    return dateStr >= startStr && dateStr <= endStr;
  });

  const getEntryStyle = (entry: ScheduleEntry) => {
    const start = new Date(entry.startAt);
    const end = new Date(entry.endAt);
    const dayIdx = viewMode === "day" ? 0 : ((start.getDay() + 6) % 7);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - HOURS_START) * SLOT_HEIGHT;
    const height = Math.max(SLOT_HEIGHT / 2, (endHour - startHour) * SLOT_HEIGHT);
    const colWidth = 100 / days.length;
    const left = (dayIdx / days.length) * 100;
    return {
      position: "absolute" as const,
      top: `${top}px`,
      left: `${left}%`,
      width: `${colWidth}%`,
      height: `${height}px`,
      marginLeft: "2px",
      marginRight: "2px",
      boxSizing: "border-box" as const,
    };
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `60px ${days.map(() => "1fr").join(" ")}`,
          minWidth: "600px",
        }}
      >
        <div style={{ borderRight: "1px solid #1f2937" }} />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            style={{
              borderRight: "1px solid #1f2937",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#94a3b8",
              padding: "0.25rem 0",
              textAlign: "center",
            }}
          >
            {d.toLocaleDateString(undefined, { weekday: "short" })}
            <br />
            {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `60px ${days.map(() => "1fr").join(" ")}`,
          minWidth: "600px",
          position: "relative",
        }}
      >
        <div
          style={{
            borderRight: "1px solid #1f2937",
            paddingTop: "0.25rem",
          }}
        >
          {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => (
            <div
              key={i}
              style={{
                height: SLOT_HEIGHT,
                fontSize: "0.75rem",
                color: "#64748b",
                paddingRight: "0.5rem",
                textAlign: "right",
              }}
            >
              {formatTime(HOURS_START + i)}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            style={{
              borderRight: "1px solid #1f2937",
              position: "relative",
              height: (HOURS_END - HOURS_START) * SLOT_HEIGHT,
            }}
          >
            {Array.from({ length: HOURS_END - HOURS_START }, (_, i) => (
              <div
                key={i}
                style={{
                  height: SLOT_HEIGHT,
                  borderBottom: "1px solid #1e293b",
                }}
              >
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onSlotClick(day, HOURS_START + i)}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={`Add at ${formatTime(HOURS_START + i)}`}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "60px",
            right: 0,
            bottom: 0,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              height: (HOURS_END - HOURS_START) * SLOT_HEIGHT,
              marginLeft: 0,
            }}
          >
            {entriesInRange.map((entry) => (
              <button
                key={entry._id}
                type="button"
                onClick={() => onEntryClick(entry)}
                style={{
                  ...getEntryStyle(entry),
                  pointerEvents: "auto",
                  background: "#2563eb",
                  color: "#fff",
                  border: "1px solid #1d4ed8",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  padding: "2px 4px",
                  overflow: "hidden",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {truncateText(getWorkOrderTitle(entry.workOrder), 35)}
                </div>
                <div style={{ opacity: 0.9, fontSize: "0.7rem" }}>
                  {new Date(entry.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {entry.technicianLabel ? ` • ${entry.technicianLabel}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
