import { useCallback, useEffect, useState } from "react";
import { Resource } from "@/app/components/types";
import { getSupabaseConfig } from "@/services/config";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";

type ResourceDraft = Omit<Resource, "id">;
const TOOL_SUBCATEGORY_CHOICES: Array<NonNullable<Resource["toolSubcategory"]>> = ["Dev tool", "UX tool"];

interface AddResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (resource: ResourceDraft) => Promise<boolean>;
  saving: boolean;
  error: string | null;
  categoryOptions: string[];
  editingResource?: Resource | null;
}

export function AddResourceDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  error,
  categoryOptions,
  editingResource,
}: AddResourceDialogProps) {
  const categoryChoices = Array.from(
    new Set(["Articles", "Tools", "Docs", "Inspiration", "Assets", "Courses", "Skill", "Other", ...categoryOptions]),
  );
  const [title, setTitle] = useState(editingResource?.title ?? "");
  const [url, setUrl] = useState(editingResource?.url ?? "");
  const [category, setCategory] = useState(editingResource?.category ?? categoryChoices[0] ?? "Other");
  const [toolSubcategory, setToolSubcategory] = useState<Resource["toolSubcategory"]>(
    editingResource?.category === "Tools" ? editingResource.toolSubcategory ?? "Dev tool" : null,
  );
  const [source, setSource] = useState(editingResource?.source ?? "");
  const [notes, setNotes] = useState(editingResource?.notes ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(editingResource?.imageUrl ?? null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const fetchMeta = useCallback(async (rawUrl: string) => {
    const normalized = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    try {
      new URL(normalized);
    } catch {
      return;
    }
    try {
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ url: normalized }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.imageUrl) setImageUrl(data.imageUrl);
      if (data.title && !title) setTitle(data.title);
    } catch {
      // metadata fetch is best-effort
    }
  }, [title]);

  useEffect(() => {
    if (!editingResource && url.trim().length > 10) {
      const timer = setTimeout(() => fetchMeta(url), 600);
      return () => clearTimeout(timer);
    }
  }, [url, editingResource, fetchMeta]);

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const guessSource = (value: string) => {
    try {
      const hostname = new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
      return hostname.split(".")[0]?.replace(/[-_]/g, " ") || "Web";
    } catch {
      return "Web";
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    if (!title.trim()) {
      setFieldError("Add a title so the resource is easy to scan later.");
      return;
    }

    if (!url.trim()) {
      setFieldError("Add the original link for this resource.");
      return;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url);
      new URL(normalizedUrl);
    } catch {
      setFieldError("Use a valid URL, for example https://example.com.");
      return;
    }

    const didSave = await onSave({
      title: title.trim(),
      url: normalizedUrl,
      category,
      toolSubcategory: category === "Tools" ? toolSubcategory ?? "Dev tool" : null,
      source: source.trim() || guessSource(normalizedUrl),
      notes: notes.trim(),
      imageUrl,
      savedAt: editingResource?.savedAt ?? new Date().toISOString(),
    });

    if (didSave) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingResource ? "Edit resource" : "Save resource"}</DialogTitle>
          <DialogDescription>
            {editingResource
              ? "Update the details so the link stays useful later."
              : "Capture the link, source, and a short note while it is still fresh."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Design systems article"
              required
            />
          </div>

          <div>
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setFieldError(null);
              }}
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Twitter, GitHub, YouTube"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setToolSubcategory(value === "Tools" ? toolSubcategory ?? "Dev tool" : null);
                }}
              >
                <SelectTrigger aria-label="Select a category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryChoices.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {category === "Tools" && (
            <div>
              <Label htmlFor="tool-subcategory">Tool subcategory</Label>
              <Select
                value={toolSubcategory ?? "Dev tool"}
                onValueChange={(value) => setToolSubcategory(value as NonNullable<Resource["toolSubcategory"]>)}
              >
                <SelectTrigger id="tool-subcategory" aria-label="Select a tool subcategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_SUBCATEGORY_CHOICES.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Why it matters, what to revisit, or what stood out."
              rows={5}
            />
          </div>

          {(fieldError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fieldError || error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingResource ? "Update resource" : "Save resource"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
