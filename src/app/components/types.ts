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
}
