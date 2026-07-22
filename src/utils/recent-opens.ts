// Local (per-browser) history of the last links opened, shown in the search
// modal before the user types. Snapshots are stored, not ids, so recents
// render even when the row isn't in the currently loaded page.
const STORAGE_KEY = "recent-opens";
const MAX_RECENTS = 5;

export interface RecentOpen {
  id: string;
  title: string;
  url: string;
  category: string;
}

export function getRecentOpens(): RecentOpen[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function recordOpen(entry: RecentOpen): void {
  try {
    const next = [entry, ...getRecentOpens().filter((r) => r.id !== entry.id)].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}
