import { Resource } from "@/app/components/types";
import { getSupabaseConfig, SUPABASE_TABLES } from "../config";
import { normalizeUrl } from "@/utils/normalize-url";

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

export interface CreateResourceDto extends Omit<Resource, "id"> {}

export interface UpdateResourceDto extends Partial<CreateResourceDto> {}

interface ResourceRow {
  id: string;
  title: string;
  url: string;
  category: string | null;
  tool_subcategory: "Dev tool" | "UX tool" | null;
  source: string | null;
  notes: string | null;
  task: string | null;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  saved_at: string | null;
  created_at?: string | null;
  description: string | null;
  site_name: string | null;
  content_type: string | null;
  tags: string[] | null;
  author: string | null;
  published_at: string | null;
  language: string | null;
  reading_time_minutes: number | null;
  task_done: boolean | null;
  is_favourite: boolean | null;
  normalized_url: string | null;
}

function inferSource(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]?.replace(/[-_]/g, " ") || "Web";
  } catch {
    return "Web";
  }
}

function toResource(row: Partial<ResourceRow> & Record<string, unknown>): Resource {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Untitled resource"),
    url: String(row.url ?? ""),
    category: String(row.category ?? "Other"),
    toolSubcategory:
      row.tool_subcategory === "Dev tool" || row.tool_subcategory === "UX tool" ? row.tool_subcategory : null,
    source: String(row.source ?? inferSource(String(row.url ?? ""))),
    notes: String(row.notes ?? ""),
    // `task` is written only by the Telegram webhook; toRow deliberately omits
    // it so web saves/edits can never clobber a pending task.
    task: String(row.task ?? ""),
    imageUrl: row.image_url ?? null,
    imageWidth: typeof row.image_width === "number" ? row.image_width : null,
    imageHeight: typeof row.image_height === "number" ? row.image_height : null,
    savedAt: String(row.saved_at ?? new Date().toISOString()),
    description: (row.description as string) ?? null,
    siteName: (row.site_name as string) ?? null,
    contentType: (row.content_type as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    author: (row.author as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    language: (row.language as string) ?? null,
    readingTimeMinutes: (row.reading_time_minutes as number) ?? null,
    taskDone: Boolean(row.task_done ?? false),
    // Like `task`, written only through its own endpoint (setFavourite) and
    // omitted from toRow so a web save/edit can never clear a star.
    isFavourite: Boolean(row.is_favourite ?? false),
  };
}

function toRow(resource: CreateResourceDto | UpdateResourceDto) {
  return {
    title: resource.title,
    url: resource.url,
    normalized_url: resource.url ? normalizeUrl(resource.url) : null,
    category: resource.category,
    tool_subcategory: resource.category === "Tools" ? resource.toolSubcategory ?? null : null,
    source: resource.source,
    notes: resource.notes,
    image_url: resource.imageUrl ?? null,
    image_width: resource.imageWidth ?? null,
    image_height: resource.imageHeight ?? null,
    saved_at: resource.savedAt,
    description: resource.description ?? null,
    site_name: resource.siteName ?? null,
    content_type: resource.contentType ?? null,
    tags: resource.tags ?? [],
    author: resource.author ?? null,
    published_at: resource.publishedAt ?? null,
    language: resource.language ?? null,
    reading_time_minutes: resource.readingTimeMinutes ?? null,
    task_done: resource.taskDone ?? false,
  };
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${anonKey}`);

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = String(errorData.message || errorData.error || `Supabase request failed (${response.status})`);
    const err = new Error(message) as Error & ApiError;
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface GetPageOptions {
  cursor?: string;
  limit: number;
  search?: string;
}

const SEARCH_FIELDS = ["title", "url", "notes", "description", "site_name", "author", "source"] as const;

function buildSearchFilter(query: string): string {
  // Quote the value so commas / parens / spaces in user input don't break PostgREST's or=(...) parsing.
  // Inside the quoted value we still need to escape backslashes and double quotes.
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const value = encodeURIComponent(`"*${escaped}*"`);
  const filters = SEARCH_FIELDS.map((f) => `${f}.ilike.${value}`).join(",");
  // tags is text[], so no ilike — cs (contains) matches when the query equals a
  // whole tag, which fits the single-word curated vocabulary.
  const tagFilter = `tags.cs.${encodeURIComponent(`{"${escaped}"}`)}`;
  return `or=(${filters},${tagFilter})`;
}

export interface ResourceLite {
  id: string;
  title: string;
  url: string;
  category: string;
  source: string;
  savedAt: string;
}

interface ResourceLiteRow {
  id: string;
  title: string | null;
  url: string | null;
  category: string | null;
  source: string | null;
  saved_at: string | null;
}

// Supabase PostgREST caps a single request at `db-max-rows` (1000 by default).
// We loop on the saved_at cursor so the catalogue can grow past that ceiling
// without breaking list view.
const LIST_PAGE_SIZE = 1000;

export interface InboxRow {
  id: string;
  title: string;
  url: string;
  category: string;
  tags: string[];
  notes: string;
  description: string | null;
  savedAt: string;
}

export interface EnrichmentPatch {
  category: string;
  tags: string[];
  notes?: string;
}

export class ResourcesClient {
  // Rows that still need enrichment: no tags or no context note. Same
  // cursor loop as getAllLight so the scan survives the 1000-row cap.
  async getInbox(): Promise<InboxRow[]> {
    const all: InboxRow[] = [];
    let cursor: string | undefined;
    while (true) {
      const params = new URLSearchParams();
      params.set("select", "id,title,url,category,tags,notes,description,saved_at");
      params.set("order", "saved_at.desc");
      params.set("limit", String(LIST_PAGE_SIZE));
      if (cursor) {
        params.set("saved_at", `lt.${cursor}`);
      }
      const rows = await supabaseRequest<Array<Partial<ResourceRow>>>(
        `/${SUPABASE_TABLES.RESOURCES}?${params.toString()}&or=(notes.is.null,notes.eq."",tags.is.null,tags.eq.{})`,
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        all.push({
          id: String(row.id),
          title: String(row.title ?? "Untitled resource"),
          url: String(row.url ?? ""),
          category: String(row.category ?? "Others"),
          tags: (row.tags as string[]) ?? [],
          notes: String(row.notes ?? ""),
          description: (row.description as string) ?? null,
          savedAt: String(row.saved_at ?? new Date().toISOString()),
        });
      }
      if (rows.length < LIST_PAGE_SIZE) break;
      cursor = rows[rows.length - 1].saved_at ?? undefined;
      if (!cursor) break;
    }
    return all;
  }

  // Patches exactly the enrichment columns — deliberately not toRow(), which
  // builds a full row and would null out url-derived fields on partial input.
  async applyEnrichment(id: string, patch: EnrichmentPatch): Promise<void> {
    await supabaseRequest<void>(
      `/${SUPABASE_TABLES.RESOURCES}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
  }

  // Every favourite, not just the ones the infinite-scroll cursor has reached —
  // a Favourites tab that only knew about loaded rows would hide older stars.
  // No cursor loop here: favourites are a curated slice, well under the 1000-row cap.
  async getFavourites(): Promise<Resource[]> {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("is_favourite", "is.true");
    params.set("order", "saved_at.desc");
    const rows = await supabaseRequest<ResourceRow[]>(
      `/${SUPABASE_TABLES.RESOURCES}?${params.toString()}`,
    );
    return rows.map(toResource);
  }

  // Patches the single column, for the same reason as applyEnrichment: toRow()
  // builds a full row and would clobber url-derived fields on partial input.
  async setFavourite(id: string, isFavourite: boolean): Promise<void> {
    await supabaseRequest<void>(
      `/${SUPABASE_TABLES.RESOURCES}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_favourite: isFavourite }),
      },
    );
  }

  async getAllLight(): Promise<ResourceLite[]> {
    const all: ResourceLite[] = [];
    let cursor: string | undefined;
    while (true) {
      const params = new URLSearchParams();
      params.set("select", "id,title,url,category,source,saved_at");
      params.set("order", "saved_at.desc");
      params.set("limit", String(LIST_PAGE_SIZE));
      if (cursor) {
        params.set("saved_at", `lt.${cursor}`);
      }
      const rows = await supabaseRequest<ResourceLiteRow[]>(
        `/${SUPABASE_TABLES.RESOURCES}?${params.toString()}`,
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        const url = String(row.url ?? "");
        all.push({
          id: String(row.id),
          title: String(row.title ?? "Untitled resource"),
          url,
          category: String(row.category ?? "Other"),
          source: String(row.source ?? inferSource(url)),
          savedAt: String(row.saved_at ?? new Date().toISOString()),
        });
      }
      if (rows.length < LIST_PAGE_SIZE) break;
      cursor = rows[rows.length - 1].saved_at ?? undefined;
      if (!cursor) break;
    }
    return all;
  }

  async getPage(options: GetPageOptions): Promise<Resource[]> {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("order", "saved_at.desc");
    params.set("limit", String(options.limit));
    if (options.cursor) {
      params.set("saved_at", `lt.${options.cursor}`);
    }
    let path = `/${SUPABASE_TABLES.RESOURCES}?${params.toString()}`;
    const search = options.search?.trim();
    if (search) {
      path += `&${buildSearchFilter(search)}`;
    }
    const rows = await supabaseRequest<ResourceRow[]>(path);
    return rows.map(toResource);
  }

  async findByNormalizedUrl(url: string): Promise<Resource | null> {
    const normalized = normalizeUrl(url);
    const rows = await supabaseRequest<ResourceRow[]>(
      `/${SUPABASE_TABLES.RESOURCES}?normalized_url=eq.${encodeURIComponent(normalized)}&select=*&limit=1`,
    );
    return rows.length > 0 ? toResource(rows[0]) : null;
  }

  async create(resource: CreateResourceDto): Promise<Resource> {
    const rows = await supabaseRequest<ResourceRow[]>(
      `/${SUPABASE_TABLES.RESOURCES}?select=*`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(toRow(resource)),
      },
    );

    return toResource(rows[0]);
  }

  async update(id: string, updates: UpdateResourceDto): Promise<Resource> {
    const rows = await supabaseRequest<ResourceRow[]>(
      `/${SUPABASE_TABLES.RESOURCES}?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(toRow(updates)),
      },
    );

    return toResource(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await supabaseRequest<void>(
      `/${SUPABASE_TABLES.RESOURCES}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  }
}
