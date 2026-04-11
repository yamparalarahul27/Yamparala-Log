import { Resource } from "@/app/components/types";
import { getSupabaseConfig, SUPABASE_TABLES } from "../config";

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
  image_url: string | null;
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
    imageUrl: row.image_url ?? null,
    savedAt: String(row.saved_at ?? new Date().toISOString()),
    description: (row.description as string) ?? null,
    siteName: (row.site_name as string) ?? null,
    contentType: (row.content_type as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    author: (row.author as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    language: (row.language as string) ?? null,
    readingTimeMinutes: (row.reading_time_minutes as number) ?? null,
  };
}

function toRow(resource: CreateResourceDto | UpdateResourceDto) {
  return {
    title: resource.title,
    url: resource.url,
    category: resource.category,
    tool_subcategory: resource.category === "Tools" ? resource.toolSubcategory ?? null : null,
    source: resource.source,
    notes: resource.notes,
    image_url: resource.imageUrl ?? null,
    saved_at: resource.savedAt,
    description: resource.description ?? null,
    site_name: resource.siteName ?? null,
    content_type: resource.contentType ?? null,
    tags: resource.tags ?? [],
    author: resource.author ?? null,
    published_at: resource.publishedAt ?? null,
    language: resource.language ?? null,
    reading_time_minutes: resource.readingTimeMinutes ?? null,
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

export class ResourcesClient {
  async getAll(): Promise<Resource[]> {
    const rows = await supabaseRequest<ResourceRow[]>(
      `/${SUPABASE_TABLES.RESOURCES}?select=*&order=saved_at.desc`,
    );
    return rows.map(toResource);
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
