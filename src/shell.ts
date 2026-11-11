/** App shell — dock shortcuts, home widgets, contextual filters. */

export type AppTab = "home" | "today" | "mpc" | "accounts" | "q4" | "more";

export type DockId = "home" | "today" | "mpc" | "accounts" | "q4" | "more";

export const DEFAULT_DOCK: DockId[] = ["home", "today", "mpc", "accounts", "more"];

export const DOCK_META: Record<DockId, { label: string }> = {
  home: { label: "Home" },
  today: { label: "Today" },
  mpc: { label: "MPC" },
  accounts: { label: "Accounts" },
  q4: { label: "Q4" },
  more: { label: "More" },
};

export type HomeWidgetId =
  | "today"
  | "mpc"
  | "scout"
  | "q4"
  | "lists"
  | "capture"
  | "brief"
  | "import"
  | "settings";

export type HomeWidget = {
  id: HomeWidgetId;
  label: string;
  blurb: string;
};

export const HOME_WIDGETS: HomeWidget[] = [
  { id: "today", label: "Today desk", blurb: "Office / Car loop" },
  { id: "mpc", label: "MPC match", blurb: "Resume → market fit" },
  { id: "scout", label: "Scout", blurb: "Hiring signals" },
  { id: "q4", label: "Q4 wrap", blurb: "Close the day" },
  { id: "lists", label: "Lists", blurb: "Hot · Quiet · Hits" },
  { id: "capture", label: "Capture", blurb: "Notes & photos" },
  { id: "brief", label: "Morning brief", blurb: "Newsletter" },
  { id: "import", label: "Import", blurb: "Drive / files" },
  { id: "settings", label: "Settings", blurb: "Dialer · dock" },
];

export type TodayFilter = "all" | "hot" | "quiet" | "leads" | "plan" | "scout" | "q4";
export type MpcFilter = "all" | "great" | "good" | "hiring" | "inbook" | "outside";
export type ListsFilter = "hot" | "gone" | "hits" | "priority";

export function normalizeDock(raw: unknown): DockId[] {
  const allowed = new Set<DockId>(["home", "today", "mpc", "accounts", "q4", "more"]);
  if (!Array.isArray(raw)) return [...DEFAULT_DOCK];
  const cleaned = raw.filter((id): id is DockId => typeof id === "string" && allowed.has(id as DockId));
  const uniq = [...new Set(cleaned)];
  if (!uniq.includes("home")) uniq.unshift("home");
  if (!uniq.includes("more")) uniq.push("more");
  while (uniq.length < 4) {
    for (const id of DEFAULT_DOCK) {
      if (!uniq.includes(id)) uniq.splice(Math.max(1, uniq.length - 1), 0, id);
      if (uniq.length >= 4) break;
    }
  }
  return uniq.slice(0, 5);
}

export function moveDockItem(dock: DockId[], index: number, dir: -1 | 1): DockId[] {
  const next = [...dock];
  const j = index + dir;
  if (j < 0 || j >= next.length) return dock;
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  return next;
}
