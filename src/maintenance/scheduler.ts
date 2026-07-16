export type MaintenanceSchedule = {
  enabled: boolean;
  eventTriggered: boolean;
  intervalMinutes: number;
  debounceMinutes: number;
  maxRunsPerHour: number;
  paused: boolean;
};

export type MaintenanceScheduleState = {
  lastRunAt?: number;
  nextRunAt?: number;
  pendingEventAt?: number;
  windowStartedAt?: number;
  runsInWindow: number;
  scanInProgress: boolean;
};

export type MaintenanceDecision = {
  run: boolean;
  reason: "disabled" | "paused" | "in-progress" | "budget" | "waiting" | "eligible";
  nextRunAt?: number;
};

export const DEFAULT_MAINTENANCE_SCHEDULE: MaintenanceSchedule = {
  enabled: false,
  eventTriggered: true,
  intervalMinutes: 60,
  debounceMinutes: 5,
  maxRunsPerHour: 4,
  paused: false
};

export function decideMaintenanceRun(
  schedule: MaintenanceSchedule,
  state: MaintenanceScheduleState,
  now: number
): MaintenanceDecision {
  if (!schedule.enabled) return { run: false, reason: "disabled" };
  if (schedule.paused) return { run: false, reason: "paused" };
  if (state.scanInProgress) return { run: false, reason: "in-progress" };
  const windowStartedAt = state.windowStartedAt ?? now;
  const runsInWindow = now - windowStartedAt >= 3_600_000 ? 0 : state.runsInWindow;
  if (runsInWindow >= schedule.maxRunsPerHour) {
    return { run: false, reason: "budget", nextRunAt: windowStartedAt + 3_600_000 };
  }
  const intervalAt = (state.lastRunAt ?? now) + schedule.intervalMinutes * 60_000;
  const eventAt =
    state.pendingEventAt !== undefined
      ? state.pendingEventAt + schedule.debounceMinutes * 60_000
      : Number.POSITIVE_INFINITY;
  const eligibleAt = Math.min(intervalAt, eventAt);
  return now >= eligibleAt
    ? { run: true, reason: "eligible" }
    : { run: false, reason: "waiting", nextRunAt: eligibleAt };
}

export function nextScheduleState(
  schedule: MaintenanceSchedule,
  state: MaintenanceScheduleState,
  now: number,
  started: boolean
): MaintenanceScheduleState {
  if (!started) return { ...state, pendingEventAt: now };
  const windowStartedAt =
    state.windowStartedAt && now - state.windowStartedAt < 3_600_000 ? state.windowStartedAt : now;
  const runsInWindow = windowStartedAt === state.windowStartedAt ? state.runsInWindow + 1 : 1;
  return {
    lastRunAt: now,
    nextRunAt: now + schedule.intervalMinutes * 60_000,
    windowStartedAt,
    runsInWindow,
    scanInProgress: true
  };
}
