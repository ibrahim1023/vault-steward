import type { PreparedRepairItem } from "./prepare-repair-batch.js";

export type PreparedRepairGroup = {
  id: string;
  label: string;
  affectedNotes: string[];
  items: PreparedRepairItem[];
};

export function groupPreparedRepairItems(
  items: readonly PreparedRepairItem[]
): PreparedRepairGroup[] {
  const groups = new Map<string, PreparedRepairGroup>();

  for (const item of items) {
    const folder = sourceFolder(item.sourcePath);
    const affectedNotes = [...new Set(item.affectedNotes)].sort();
    const id = [item.repairFamily, folder, ...affectedNotes].join("|");
    const existing = groups.get(id);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(id, {
      id,
      label: `${repairFamilyLabel(item.repairFamily)} in ${folder}`,
      affectedNotes,
      items: [item]
    });
  }

  return [...groups.values()].sort(
    (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
  );
}

function sourceFolder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "Vault root" : path.slice(0, slash);
}

function repairFamilyLabel(family: PreparedRepairItem["repairFamily"]): string {
  switch (family) {
    case "reference":
      return "Reference fixes";
    case "task":
      return "Task fixes";
    case "decision":
      return "Decision fixes";
    case "entity":
      return "Entity fixes";
    case "schema":
      return "Template fixes";
  }
}
