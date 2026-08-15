import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAINTENANCE_SCHEDULE,
  decideMaintenanceRun,
  nextScheduleState
} from "../../src/maintenance/scheduler.js";

describe("maintenance scheduler", () => {
  it("is disabled by default and never overlaps an active scan", () => {
    expect(
      decideMaintenanceRun(
        DEFAULT_MAINTENANCE_SCHEDULE,
        { runsInWindow: 0, scanInProgress: false },
        1
      )
    ).toMatchObject({ reason: "disabled" });
    expect(
      decideMaintenanceRun(
        { ...DEFAULT_MAINTENANCE_SCHEDULE, enabled: true },
        { runsInWindow: 0, scanInProgress: true },
        1
      )
    ).toMatchObject({ reason: "in-progress" });
  });

  it("coalesces events and enforces the hourly resource budget", () => {
    const schedule = {
      ...DEFAULT_MAINTENANCE_SCHEDULE,
      enabled: true,
      intervalMinutes: 60,
      debounceMinutes: 5,
      maxRunsPerHour: 1
    };
    expect(
      decideMaintenanceRun(
        schedule,
        { runsInWindow: 0, scanInProgress: false, pendingEventAt: 0, lastRunAt: 0 },
        4 * 60_000
      )
    ).toMatchObject({ reason: "waiting" });
    expect(
      decideMaintenanceRun(
        schedule,
        { runsInWindow: 0, scanInProgress: false, pendingEventAt: 0, lastRunAt: 0 },
        5 * 60_000
      )
    ).toMatchObject({ run: true });
    expect(
      decideMaintenanceRun(
        schedule,
        { runsInWindow: 1, windowStartedAt: 0, scanInProgress: false },
        10 * 60_000
      )
    ).toMatchObject({ reason: "budget" });
  });

  it("records a started run and clears a coalesced event", () => {
    const next = nextScheduleState(
      { ...DEFAULT_MAINTENANCE_SCHEDULE, enabled: true },
      { runsInWindow: 0, scanInProgress: false, pendingEventAt: 1 },
      2,
      true
    );
    expect(next).toMatchObject({ lastRunAt: 2, runsInWindow: 1, scanInProgress: true });
    expect(next.pendingEventAt).toBeUndefined();
  });

  it("preserves a metadata-only record of the latest conservative scan plan", () => {
    const state = {
      runsInWindow: 0,
      scanInProgress: false,
      lastPlanMode: "full" as const,
      lastPlanReason: "ambiguous-event"
    };
    expect(nextScheduleState(DEFAULT_MAINTENANCE_SCHEDULE, state, 5, false)).toMatchObject({
      lastPlanMode: "full",
      lastPlanReason: "ambiguous-event"
    });
  });
});
