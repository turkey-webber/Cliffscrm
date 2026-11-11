/** App shell — dock shortcuts, home widgets, contextual filters. */

export type AppTab = "home" | "today" | "mpc" | "accounts" | "q4" | "more";

/** Dock items — primary four pin left; swipe left on the bar for the rest. */
export type DockId =
  | "home"
  | "dialer"
  | "today"
  | "scout"
  | "mpc"
  | "accounts"
  | "q4"
  | "more";

/** Always first: Dashboard · Dialer · Today · Scout */
export const DOCK_PRIMARY: DockId[] = ["home", "dialer", "today", "scout"];

/** Full default strip — drag/swipe left to reveal items after Scout */
export const DEFAULT_DOCK: DockId[] = [
  "home",
  "dialer",
  "today",
  "scout",
  "mpc",
  "accounts",
  "q4",
  "more",
];

export const DOCK_META: Record<DockId, { label: string }> = {
  home: { label: "Dashboard" },
  dialer: { label: "Dialer" },
  today: { label: "Today" },
  scout: { label: "Scout" },
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

/** Primary Home tools — Brief / Import / Settings live under More. */
export const HOME_WIDGETS: HomeWidget[] = [
  { id: "today", label: "Today", blurb: "Office / Car day" },
  { id: "mpc", label: "MPC", blurb: "Resume ↔ jobs" },
  { id: "scout", label: "Scout", blurb: "Hiring signals" },
  { id: "q4", label: "Q4", blurb: "Close wraps" },
  { id: "lists", label: "Lists", blurb: "Hot · Quiet · Hits" },
  { id: "capture", label: "Capture", blurb: "Notes & photos" },
];

export const HOME_MORE_WIDGETS: HomeWidget[] = [
  { id: "brief", label: "Morning brief", blurb: "Daily email" },
  { id: "import", label: "Import", blurb: "Drive / files" },
  { id: "settings", label: "Settings", blurb: "Phone · dock" },
];

export type TodayFilter = "all" | "hot" | "quiet" | "leads" | "plan" | "scout" | "q4";
export type MpcFilter = "all" | "great" | "good" | "hiring" | "inbook" | "outside";
export type ListsFilter = "hot" | "gone" | "hits" | "priority";

const ALLOWED = new Set<DockId>(DEFAULT_DOCK);

/** Migrate older 5-slot docks and keep primary four up front. */
export function normalizeDock(raw: unknown): DockId[] {
  const fromRaw = Array.isArray(raw)
    ? raw.filter((id): id is DockId => typeof id === "string" && ALLOWED.has(id as DockId))
    : [];
  const next = fromRaw.length ? [...fromRaw] : [...DEFAULT_DOCK];

  // Insert Dialer + Scout for saved docks from before this layout
  if (!next.includes("dialer")) {
    const hi = next.indexOf("home");
    next.splice(hi >= 0 ? hi + 1 : 0, 0, "dialer");
  }
  if (!next.includes("scout")) {
    const ti = next.indexOf("today");
    next.splice(ti >= 0 ? ti + 1 : Math.min(2, next.length), 0, "scout");
  }

  const rest = next.filter((id) => !DOCK_PRIMARY.includes(id));
  const ordered = [...DOCK_PRIMARY, ...rest];
  for (const id of DEFAULT_DOCK) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.filter((id, i, arr) => arr.indexOf(id) === i);
}

export function moveDockItem(dock: DockId[], index: number, dir: -1 | 1): DockId[] {
  const next = [...dock];
  const j = index + dir;
  if (j < 0 || j >= next.length) return dock;
  // Keep primary four locked in the first four slots when rearranging
  if (index < 4 || j < 4) {
    // Allow reorder only within overflow (index >= 4) or within primary
    if ((index < 4) !== (j < 4)) return dock;
  }
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  return next;
}
