import type { ScanPlan, ScanPlanOptions, VaultEvent } from "../contracts/incremental.js";

export function planIncrementalScan(
  events: readonly VaultEvent[],
  options: ScanPlanOptions
): ScanPlan {
  if (events.length === 0 || events.length > options.maxEvents)
    return { mode: "full", reasons: ["event-overflow"] };
  if (
    events.some((event) => !isSafePath(event.path) || (event.oldPath && !isSafePath(event.oldPath)))
  )
    return { mode: "full", reasons: ["unsafe-event"] };
  if (
    events.some(
      (event) => event.kind === "delete" || event.kind === "rename" || event.kind === "create"
    )
  )
    return { mode: "full", reasons: ["ambiguous-event"] };
  const paths = [...new Set(events.map((event) => event.path))].sort((left, right) =>
    left.localeCompare(right)
  );
  return { mode: "incremental", paths, reasons: ["modified"] };
}

function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.endsWith(".md") &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..")
  );
}
