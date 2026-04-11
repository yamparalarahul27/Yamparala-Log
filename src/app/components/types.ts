export interface Resource {
  id: string;
  title: string;
  url: string;
  category: string;
  toolSubcategory: "Dev tool" | "UX tool" | null;
  source: string;
  notes: string;
  imageUrl: string | null;
  savedAt: string;
  description: string | null;
  siteName: string | null;
  contentType: string | null;
  tags: string[];
  author: string | null;
  publishedAt: string | null;
  language: string | null;
  readingTimeMinutes: number | null;
}
