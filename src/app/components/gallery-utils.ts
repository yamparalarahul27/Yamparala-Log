import type { Resource } from "@/app/components/types";

export interface GalleryItem {
  id: string;
  image: string;
  title: string;
  url: string;
  description?: string;
  source?: string;
  date?: string;
  tags?: string[];
}

function proxyImage(url: string): string {
  try {
    new URL(url);
  } catch {
    return url;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=800&output=webp&q=75`;
}

export function resourceToGalleryItem(r: Resource): GalleryItem | null {
  if (!r.imageUrl) return null;
  return {
    id: r.id,
    image: proxyImage(r.imageUrl),
    title: r.title,
    url: r.url,
    description: r.notes || r.description || undefined,
    source: r.source,
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(r.savedAt)),
    tags: r.tags?.length ? r.tags : undefined,
  };
}
