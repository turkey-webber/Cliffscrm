import type { DirectoryPrefs, DisqualifyReason, IncumbentStaffing, BookStatus, Contact } from "./types";

const KEY = "territory-directory-prefs-v1";

export const EMPTY_PREFS: DirectoryPrefs = {
  hiddenIds: [],
  disqualified: {},
  watchlistIds: [],
  blitzIds: [],
  bookOverrides: {},
  incumbentOverrides: {},
  manualContacts: {},
  disputedFields: {},
};

export function loadPrefs(): DirectoryPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PREFS };
    return { ...EMPTY_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_PREFS };
  }
}

export function savePrefs(prefs: DirectoryPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function hideCompany(prefs: DirectoryPrefs, id: string): DirectoryPrefs {
  const next = {
    ...prefs,
    hiddenIds: prefs.hiddenIds.includes(id) ? prefs.hiddenIds : [...prefs.hiddenIds, id],
    blitzIds: prefs.blitzIds.filter((x) => x !== id),
  };
  savePrefs(next);
  return next;
}

export function unhideCompany(prefs: DirectoryPrefs, id: string): DirectoryPrefs {
  const next = { ...prefs, hiddenIds: prefs.hiddenIds.filter((x) => x !== id) };
  savePrefs(next);
  return next;
}

export function disqualifyCompany(
  prefs: DirectoryPrefs,
  id: string,
  reason: DisqualifyReason,
  note?: string,
): DirectoryPrefs {
  const next = {
    ...prefs,
    disqualified: { ...prefs.disqualified, [id]: { reason, note, at: new Date().toISOString() } },
    hiddenIds: prefs.hiddenIds.filter((x) => x !== id),
    blitzIds: prefs.blitzIds.filter((x) => x !== id),
  };
  savePrefs(next);
  return next;
}

export function restoreDisqualified(prefs: DirectoryPrefs, id: string): DirectoryPrefs {
  const disqualified = { ...prefs.disqualified };
  delete disqualified[id];
  const next = { ...prefs, disqualified };
  savePrefs(next);
  return next;
}

export function toggleWatchlist(prefs: DirectoryPrefs, id: string): DirectoryPrefs {
  const watchlistIds = prefs.watchlistIds.includes(id)
    ? prefs.watchlistIds.filter((x) => x !== id)
    : [...prefs.watchlistIds, id];
  const next = { ...prefs, watchlistIds };
  savePrefs(next);
  return next;
}

export function toggleBlitz(prefs: DirectoryPrefs, id: string): DirectoryPrefs {
  const blitzIds = prefs.blitzIds.includes(id)
    ? prefs.blitzIds.filter((x) => x !== id)
    : [...prefs.blitzIds, id];
  const next = { ...prefs, blitzIds };
  savePrefs(next);
  return next;
}

export function setBookStatus(prefs: DirectoryPrefs, id: string, status: BookStatus): DirectoryPrefs {
  const next = { ...prefs, bookOverrides: { ...prefs.bookOverrides, [id]: status } };
  savePrefs(next);
  return next;
}

export function setIncumbent(prefs: DirectoryPrefs, id: string, value: IncumbentStaffing): DirectoryPrefs {
  const next = { ...prefs, incumbentOverrides: { ...prefs.incumbentOverrides, [id]: value } };
  savePrefs(next);
  return next;
}

export function addManualContact(prefs: DirectoryPrefs, companyId: string, contact: Contact): DirectoryPrefs {
  const list = prefs.manualContacts[companyId] ?? [];
  const next = {
    ...prefs,
    manualContacts: { ...prefs.manualContacts, [companyId]: [...list, contact] },
  };
  savePrefs(next);
  return next;
}
