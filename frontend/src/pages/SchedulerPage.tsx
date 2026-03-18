// frontend/src/pages/SchedulerPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useMe } from "../auth/useMe";
import {
  fetchScheduleEntries,
  fetchUnscheduledWorkOrders,
} from "../api/scheduler";
import { listUsers as listTeamUsers } from "../api/users";
import type { ScheduleEntry, UnscheduledWorkOrder } from "../api/scheduler";
import { toISODate } from "../utils/dateTime";
import { getThisWeekRangeMondayBased } from "../utils/weekRange";
import SchedulerToolbar from "../components/scheduler/SchedulerToolbar";
import SchedulerSidebar from "../components/scheduler/SchedulerSidebar";
import SchedulerGrid from "../components/scheduler/SchedulerGrid";
import SchedulerAgenda from "../components/scheduler/SchedulerAgenda";
import ScheduleEntryModal from "../components/scheduler/ScheduleEntryModal";
import type { HttpError } from "../api/http";

const MOBILE_BREAKPOINT = 768;

type ViewMode = "day" | "week";

export default function SchedulerPage() {
  const { me, loading: meLoading } = useMe();
  const canEdit = me?.role === "owner" || me?.role === "manager";

  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [technicianId, setTechnicianId] = useState("");
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [unscheduledWorkOrders, setUnscheduledWorkOrders] = useState<UnscheduledWorkOrder[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [debouncedSidebarSearch, setDebouncedSidebarSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [modalWorkOrder, setModalWorkOrder] = useState<UnscheduledWorkOrder | null>(null);
  const [modalEntry, setModalEntry] = useState<ScheduleEntry | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>();
  const [modalInitialHour, setModalInitialHour] = useState<number>(9);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isMobile) setViewMode("day");
  }, [isMobile]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSidebarSearch(sidebarSearch), 250);
    return () => clearTimeout(t);
  }, [sidebarSearch]);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (viewMode === "day") {
      const d = new Date(viewDate);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start: d, end };
    }
    return getThisWeekRangeMondayBased(viewDate);
  }, [viewDate, viewMode]);

  const startStr = toISODate(rangeStart);
  const endStr = toISODate(rangeEnd);

  useEffect(() => {
    let cancelled = false;
    async function loadTechnicians() {
      if (me?.role === "technician") {
        setTechnicians([{ id: me.id, name: me.displayName || me.name || "My schedule" }]);
        return;
      }
      try {
        const res = await listTeamUsers();
        if (cancelled) return;
        const techs = (res.users ?? [])
          .filter((u) => u.role === "technician" && u.isActive)
          .map((u) => ({
            id: u.id,
            name: u.name || u.email || u.id,
          }));
        setTechnicians(techs);
      } catch (err) {
        if ((err as HttpError)?.status === 403) {
          setTechnicians([]);
        }
      }
    }
    if (me) loadTechnicians();
    return () => { cancelled = true; };
  }, [me]);

  useEffect(() => {
    let cancelled = false;
    async function loadEntries() {
      setEntriesLoading(true);
      try {
        const data = await fetchScheduleEntries({
          start: startStr,
          end: endStr,
          technicianId: technicianId || undefined,
        });
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error("[SchedulerPage] fetch entries error", err);
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    }
    loadEntries();
    return () => { cancelled = true; };
  }, [startStr, endStr, technicianId]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnscheduled() {
      setSidebarLoading(true);
      try {
        const data = await fetchUnscheduledWorkOrders({
          search: debouncedSidebarSearch || undefined,
          limit: 50,
        });
        if (!cancelled) setUnscheduledWorkOrders(data);
      } catch (err) {
        console.error("[SchedulerPage] fetch unscheduled error", err);
        if (!cancelled) setUnscheduledWorkOrders([]);
      } finally {
        if (!cancelled) setSidebarLoading(false);
      }
    }
    loadUnscheduled();
    return () => { cancelled = true; };
  }, [debouncedSidebarSearch]);

  const handleSlotClick = (date: Date, hour: number) => {
    if (!canEdit) return;
    setModalMode("create");
    setModalWorkOrder(null);
    setModalEntry(null);
    setModalInitialDate(date);
    setModalInitialHour(hour);
    setModalOpen(true);
  };

  const handleEntryClick = (entry: ScheduleEntry) => {
    setModalMode(canEdit ? "edit" : "view");
    setModalWorkOrder(null);
    setModalEntry(entry);
    setModalInitialDate(undefined);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const handleSelectWorkOrder = (wo: UnscheduledWorkOrder) => {
    setModalMode("create");
    setModalWorkOrder(wo);
    setModalEntry(null);
    setModalInitialDate(viewDate);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const handleMobileAddClick = () => {
    if (!canEdit) return;
    setModalMode("create");
    setModalWorkOrder(null);
    setModalEntry(null);
    setModalInitialDate(viewDate);
    setModalInitialHour(9);
    setModalOpen(true);
  };

  const handleModalSaved = () => {
    setEntriesLoading(true);
    setSidebarLoading(true);
    fetchScheduleEntries({ start: startStr, end: endStr, technicianId: technicianId || undefined })
      .then(setEntries)
      .finally(() => setEntriesLoading(false));
    fetchUnscheduledWorkOrders({ search: debouncedSidebarSearch || undefined, limit: 50 })
      .then(setUnscheduledWorkOrders)
      .finally(() => setSidebarLoading(false));
  };

  if (meLoading) {
    return (
      <div style={{ padding: "1rem", color: "#94a3b8" }}>Loading…</div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: isMobile ? undefined : "calc(100vh - 60px)",
        minHeight: isMobile ? "100vh" : 0,
        background: "#020617",
        overflowY: isMobile ? "visible" : undefined,
      }}
    >
      <div style={{ padding: "0 1rem", borderBottom: "1px solid #1f2937", flexShrink: 0 }}>
        <h1 style={{ margin: 0, padding: "1rem 0 0", fontSize: "1.25rem", fontWeight: 600, color: "#e5e7eb" }}>
          Scheduler
        </h1>
        <SchedulerToolbar
          viewDate={viewDate}
          viewMode={viewMode}
          technicianId={technicianId}
          technicians={technicians}
          onViewDateChange={setViewDate}
          onViewModeChange={setViewMode}
          onTechnicianChange={setTechnicianId}
          hideViewToggle={isMobile}
          isMobile={isMobile}
        />
      </div>
      <div
        style={{
          display: "flex",
          flex: isMobile ? undefined : 1,
          minHeight: isMobile ? undefined : 0,
          flexDirection: isMobile ? "column" : "row",
          overflow: isMobile ? "visible" : undefined,
        }}
      >
        <SchedulerSidebar
          workOrders={unscheduledWorkOrders}
          loading={sidebarLoading}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          onSelectWorkOrder={handleSelectWorkOrder}
          canEdit={canEdit}
          compact={isMobile}
          isMobile={isMobile}
        />
        <div
          style={{
            flex: isMobile ? undefined : 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: isMobile ? undefined : 0,
            padding: isMobile ? "0.75rem" : "1rem",
          }}
        >
          {entriesLoading ? (
            <p style={{ color: "#94a3b8" }}>Loading schedule…</p>
          ) : isMobile ? (
            <SchedulerAgenda
              entries={entries}
              viewDate={viewDate}
              canEdit={canEdit}
              onEntryClick={handleEntryClick}
              onAddClick={handleMobileAddClick}
              isMobile={true}
            />
          ) : (
            <SchedulerGrid
              entries={entries}
              viewDate={viewDate}
              viewMode={viewMode}
              canEdit={canEdit}
              onSlotClick={handleSlotClick}
              onEntryClick={handleEntryClick}
            />
          )}
        </div>
      </div>
      <ScheduleEntryModal
        open={modalOpen}
        mode={modalMode}
        workOrder={modalWorkOrder}
        entry={modalEntry}
        unscheduledWorkOrders={unscheduledWorkOrders}
        initialDate={modalInitialDate}
        initialHour={modalInitialHour}
        technicians={technicians}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
      />
    </div>
  );
}
