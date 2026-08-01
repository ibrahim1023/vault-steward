import type { MaintenanceSchedule, MaintenanceScheduleState } from "../maintenance/scheduler.js";

export function MaintenanceScheduleView({
  schedule,
  state,
  setPaused
}: {
  schedule: MaintenanceSchedule;
  state: MaintenanceScheduleState;
  setPaused: (paused: boolean) => Promise<void>;
}) {
  const nextRun = state.nextRunAt ? new Date(state.nextRunAt).toLocaleString() : "Not scheduled";
  const lastRun = state.lastRunAt ? new Date(state.lastRunAt).toLocaleString() : "Not run yet";
  return (
    <section aria-label="Maintenance schedule">
      <h2>Maintenance schedule</h2>
      <p>{schedule.enabled ? (schedule.paused ? "Paused" : "Active") : "Disabled"}</p>
      <p>Next run: {nextRun}</p>
      <p>Last scheduled run: {lastRun}</p>
      {state.lastPlanMode ? (
        <p>
          Last scan plan:{" "}
          {state.lastPlanMode === "incremental" ? "changed notes reused" : "full vault check"}
          {state.lastPlanReason ? ` (${state.lastPlanReason})` : ""}.
        </p>
      ) : null}
      <button
        type="button"
        disabled={!schedule.enabled}
        onClick={() => void setPaused(!schedule.paused)}
      >
        {schedule.paused ? "Resume maintenance" : "Pause maintenance"}
      </button>
    </section>
  );
}
