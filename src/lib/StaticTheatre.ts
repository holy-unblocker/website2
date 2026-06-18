import gamesData from "@config/games.json";
import type {
  ListData,
  ListOptions,
  TheatreEntry,
  TheatreEntryMin,
} from "@lib/TheatreAPI";

// Static, file-backed replacement for the Postgres-backed TheatreWrapper.
// Game data is loaded once from config/games.json instead of querying a database.

const rawEntries = gamesData as TheatreEntry[];

// give each entry a stable index for ordering / limitPerCategory
const entries: (TheatreEntry & { index: number })[] = rawEntries.map(
  (entry, index) => ({
    ...entry,
    index,
  }),
);

function toMin(entry: TheatreEntry): TheatreEntryMin {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
  };
}

// crude trigram-ish similarity for search ranking (case-insensitive substring + ratio)
function similarity(name: string, search: string): number {
  const a = name.toUpperCase();
  const b = search.toUpperCase();
  if (a === b) return 1;
  if (a.includes(b)) return 0.5 + b.length / (a.length + 1);
  // fall back to shared-character ratio
  let shared = 0;
  for (const ch of new Set(b)) if (a.includes(ch)) shared++;
  return shared / (b.length || 1) / 2;
}

export default class StaticTheatre {
  async show(id: string): Promise<TheatreEntry | undefined> {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return undefined;
    return { ...entry, category: [...entry.category] };
  }

  // plays are not persisted in the static dataset; this is a no-op success
  async countPlay(id: string): Promise<boolean> {
    return entries.some((e) => e.id === id);
  }

  async list(
    options: ListOptions = {},
    _signal?: AbortSignal,
  ): Promise<ListData> {
    let results = entries.slice();

    if (typeof options.ids === "object" && options.ids !== null) {
      const ids = new Set(options.ids);
      results = results.filter((e) => ids.has(e.id));
    }

    if (
      typeof options.category === "object" &&
      options.category !== null &&
      options.category.length !== 0
    ) {
      const wanted = options.category;
      results = results.filter((e) =>
        e.category.some((c) => wanted.includes(c)),
      );
    } else if (typeof options.category === "string") {
      const wanted = options.category;
      results = results.filter((e) => e.category.includes(wanted));
    }

    if (typeof options.limitPerCategory === "number") {
      const limit = options.limitPerCategory;
      // mirror the SQL behavior: keep an entry if fewer than `limit` earlier
      // entries (by index) share any of its categories
      results = results.filter((entry) => {
        let seen = 0;
        for (const other of results) {
          if (other.index >= entry.index) continue;
          if (other.category.some((c) => entry.category.includes(c))) seen++;
          if (seen >= limit) return false;
        }
        return true;
      });
    }

    // sorting
    if (typeof options.search === "string") {
      const search = options.search;
      results.sort(
        (a, b) =>
          similarity(b.name, search) - similarity(a.name, search) ||
          a.name.localeCompare(b.name),
      );
    } else if (options.sort === "name") {
      results.sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      );
    } else if (options.sort === "plays") {
      results.sort(
        (a, b) =>
          b.plays - a.plays ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      );
    }

    if (options.order === "asc") results.reverse();

    const total = results.length;

    if (typeof options.offset === "number")
      results = results.slice(options.offset);

    if (typeof options.limit === "number")
      results = results.slice(0, options.limit);

    return {
      total,
      entries: results.map(toMin),
    };
  }
}
