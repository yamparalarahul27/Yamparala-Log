import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";
import { type InboxRow } from "@/services/clients/resources-client";
import { getHostname } from "@/app/components/resource-format";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { ClipboardCopy, ClipboardPaste } from "lucide-react";

const BATCH_SIZE = 50;
const ALLOWED_CATEGORIES = ["Article", "Dev", "Design", "Portfolio", "Tools", "Others"];
const ALLOWED_TAGS = [
  "ai",
  "crypto",
  "open-source",
  "ui-components",
  "animation",
  "ui-interaction",
  "design-inspiration",
];

function buildPrompt(rows: InboxRow[]): string {
  const payload = rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    description: r.description,
    category: r.category,
  }));
  return [
    "You are enriching entries of a personal link library. For each entry below, decide:",
    `- "category": exactly one of ${ALLOWED_CATEGORIES.join(", ")}`,
    `- "tags": 0 to 3 values, ONLY from this list: ${ALLOWED_TAGS.join(", ")}`,
    '- "note": one short line of context — what this is and why it is worth revisiting. No apostrophes needed, plain text.',
    "",
    "Reply with ONLY a JSON array, no prose, in the shape:",
    '[{"id": "<id from input>", "category": "...", "tags": ["..."], "note": "..."}]',
    "",
    "Entries:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

interface ParsedResult {
  id: string;
  category: string;
  tags: string[];
  note: string;
}

function parseResults(text: string, knownIds: Set<string>): { valid: ParsedResult[]; errors: string[] } {
  const errors: string[] = [];
  let data: unknown;
  try {
    // Tolerate the AI wrapping the JSON in a markdown code fence.
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    data = JSON.parse(stripped);
  } catch {
    return { valid: [], errors: ["Not valid JSON — paste exactly what the AI returned."] };
  }
  if (!Array.isArray(data)) {
    return { valid: [], errors: ["Expected a JSON array."] };
  }
  const valid: ParsedResult[] = [];
  data.forEach((item, index) => {
    const row = item as Partial<ParsedResult>;
    if (!row || typeof row.id !== "string" || !knownIds.has(row.id)) {
      errors.push(`Item ${index + 1}: unknown or missing id`);
      return;
    }
    if (typeof row.category !== "string" || !ALLOWED_CATEGORIES.includes(row.category)) {
      errors.push(`Item ${index + 1}: category must be one of ${ALLOWED_CATEGORIES.join(", ")}`);
      return;
    }
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const badTag = tags.find((t) => !ALLOWED_TAGS.includes(t));
    if (badTag) {
      errors.push(`Item ${index + 1}: tag "${badTag}" is not in the vocabulary`);
      return;
    }
    valid.push({
      id: row.id,
      category: row.category,
      tags,
      note: typeof row.note === "string" ? row.note.trim() : "",
    });
  });
  return { valid, errors };
}

interface InboxViewProps {
  rows: InboxRow[];
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
}

export function InboxView({ rows, loading, error, isAdmin }: InboxViewProps) {
  const queryClient = useQueryClient();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [applying, setApplying] = useState(false);

  const knownIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const parsed = useMemo(
    () => (pasteText.trim() ? parseResults(pasteText, knownIds) : null),
    [pasteText, knownIds],
  );

  const handleCopyBatch = async () => {
    const batch = rows.slice(0, BATCH_SIZE);
    try {
      await navigator.clipboard.writeText(buildPrompt(batch));
      toast.success(`Copied ${batch.length} links as an AI prompt`);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  };

  const handleApply = async () => {
    if (!parsed || parsed.valid.length === 0) return;
    setApplying(true);
    let applied = 0;
    let failed = 0;
    for (const result of parsed.valid) {
      const row = rows.find((r) => r.id === result.id);
      try {
        await apiClient.resources.applyEnrichment(result.id, {
          category: result.category,
          tags: result.tags,
          // Never clobber a note you wrote yourself.
          ...(row && row.notes.trim() === "" && result.note ? { notes: result.note } : {}),
        });
        applied += 1;
      } catch {
        failed += 1;
      }
    }
    setApplying(false);
    if (applied > 0) {
      toast.success(`Enriched ${applied} ${applied === 1 ? "link" : "links"}`);
      setPasteOpen(false);
      setPasteText("");
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
    }
    if (failed > 0) {
      toast.error(`${failed} ${failed === 1 ? "update" : "updates"} failed — try again.`);
    }
  };

  if (error) {
    return (
      <Card className="rounded-3xl border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm text-red-700">{error.message}</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 py-2.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-10 text-center shadow-sm">
        <p className="text-stone-600 dark:text-stone-300 text-pretty">
          Inbox zero — every link has tags and a context note.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Saved, but missing tags or a context note.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void handleCopyBatch()}>
              <ClipboardCopy className="size-4" />
              Copy batch for AI ({Math.min(rows.length, BATCH_SIZE)})
            </Button>
            {isAdmin && (
              <Button className="gap-2" onClick={() => setPasteOpen(true)}>
                <ClipboardPaste className="size-4" />
                Paste AI results
              </Button>
            )}
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
          {rows.map((row) => {
            const missing = [
              row.tags.length === 0 ? "tags" : null,
              row.notes.trim() === "" ? "note" : null,
            ].filter(Boolean);
            return (
              <li key={row.id} className="flex items-baseline gap-3 px-1 py-2">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-stone-900 dark:text-stone-100 hover:underline"
                >
                  {row.title}
                </a>
                <span className="hidden shrink-0 truncate text-xs text-stone-500 dark:text-stone-400 sm:inline">
                  {getHostname(row.url)}
                </span>
                <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                  missing {missing.join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="px-1 pt-3 text-center text-xs text-stone-400 dark:text-stone-500">
          {rows.length} {rows.length === 1 ? "link" : "links"} to enrich
        </p>
      </Card>

      <Dialog open={pasteOpen} onOpenChange={(next) => !applying && setPasteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply enrichment results</DialogTitle>
            <DialogDescription>
              Paste the JSON array the AI returned. Rows with unknown ids, categories, or
              off-vocabulary tags are rejected individually.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder='[{"id": "…", "category": "Design", "tags": ["animation"], "note": "…"}]'
            className="max-h-60 min-h-40 font-mono text-xs"
          />

          {parsed && (
            <div className="text-sm">
              <p className="text-stone-600 dark:text-stone-300">
                ✓ {parsed.valid.length} valid
                {parsed.errors.length > 0 && ` · ⚠ ${parsed.errors.length} rejected`}
              </p>
              {parsed.errors.length > 0 && (
                <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-5 text-xs text-red-600">
                  {parsed.errors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={applying} onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={applying || !parsed || parsed.valid.length === 0}
              onClick={() => void handleApply()}
            >
              {applying ? "Applying…" : `Apply ${parsed?.valid.length ?? 0}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
