import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddResourceDialog } from "@/app/components/AddResourceDialog";
import { Resource } from "@/app/components/types";
import { useResources } from "@/app/hooks/useResources";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import {
  ArrowUpRight,
  CalendarDays,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

type SortValue = "newest" | "oldest" | "title";

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "x.com" && u.hostname !== "twitter.com") return null;
    const match = u.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function TweetEmbed({ tweetId }: { tweetId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as typeof window & { twttr?: { widgets: { createTweet: (id: string, el: HTMLElement, opts: Record<string, unknown>) => void } } };
    const render = () => {
      if (containerRef.current && w.twttr?.widgets) {
        containerRef.current.innerHTML = "";
        w.twttr.widgets.createTweet(tweetId, containerRef.current, {
          theme: "light",
          conversation: "none",
          dnt: true,
        });
      }
    };

    if (w.twttr?.widgets) {
      render();
    } else {
      const existing = document.getElementById("twitter-wjs");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "twitter-wjs";
        script.src = "https://platform.twitter.com/widgets.js";
        script.onload = render;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", render);
      }
    }
  }, [tweetId]);

  return <div ref={containerRef} className="max-w-full overflow-hidden [&_iframe]:!max-w-full" />;
}

export function Resources() {
  const { resources, loading, loadError, reload, createResource, updateResource, deleteResource } = useResources();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = Array.from(new Set(resources.map((resource) => resource.category))).sort();
  const sources = Array.from(new Set(resources.map((resource) => resource.source))).sort();

  let filteredResources = resources.filter((resource) => {
    const matchesQuery =
      query.trim() === "" ||
      [resource.title, resource.notes, resource.url, resource.source, resource.category, resource.toolSubcategory ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());

    const matchesCategory = categoryFilter === "all" || resource.category === categoryFilter;
    const matchesSource = sourceFilter === "all" || resource.source === sourceFilter;

    return matchesQuery && matchesCategory && matchesSource;
  });

  filteredResources = [...filteredResources].sort((left, right) => {
    if (sortBy === "title") {
      return left.title.localeCompare(right.title);
    }

    const leftTime = new Date(left.savedAt).getTime();
    const rightTime = new Date(right.savedAt).getTime();
    return sortBy === "newest" ? rightTime - leftTime : leftTime - rightTime;
  });

  const handleOpenCreate = () => {
    setEditingResource(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (resource: Resource) => {
    setEditingResource(resource);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleSaveResource = async (resource: Omit<Resource, "id">) => {
    setDialogError(null);
    setDialogSaving(true);

    try {
      if (editingResource) {
        await updateResource(editingResource.id, resource);
        toast.success("Resource updated");
      } else {
        await createResource(resource);
        toast.success("Resource saved");
      }

      setEditingResource(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not save that resource right now.";
      setDialogError(message);
      return false;
    } finally {
      setDialogSaving(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete) {
      return;
    }

    setDeleteError(null);
    setDeleting(true);

    try {
      await deleteResource(resourceToDelete.id);
      toast.success("Resource deleted");
      setResourceToDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not delete that resource right now.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <main className="min-h-dvh">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <Card className="rounded-3xl border-slate-200 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge variant="secondary" className="w-fit bg-blue-50 text-blue-700">
                  Rahul's Log
                </Badge>
                <h1 className="text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
                  Save every useful link in one place.
                </h1>
              </div>

              <Button className="gap-2 self-start sm:self-auto" onClick={handleOpenCreate}>
                <Plus className="size-4" />
                Save resource
              </Button>
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-200 p-4 shadow-sm sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search resources"
                  className="pl-9"
                  placeholder="Search by title, notes, URL, source, or category"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger aria-label="Filter by category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger aria-label="Filter by source">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortValue)}>
                <SelectTrigger aria-label="Sort resources">
                  <SelectValue placeholder="Newest first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {loadError ? (
            <Card className="rounded-3xl border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-red-800 text-balance">The library could not be loaded.</h2>
                  <p className="text-sm text-red-700 text-pretty">{loadError}</p>
                </div>
                <Button variant="outline" className="border-red-200 bg-white" onClick={reload}>
                  Try again
                </Button>
              </div>
            </Card>
          ) : loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="rounded-3xl border-slate-200 p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-4/5" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-9 w-24 rounded-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : resources.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-300 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-blue-700">
                  <FolderOpen className="size-5" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-950 text-balance">Start your library with the next link you save.</h2>
                <p className="text-slate-600 text-pretty">
                  Add a resource once, tag where it came from, and leave a quick note for the future version of you.
                </p>
                <Button className="gap-2" onClick={handleOpenCreate}>
                  <Plus className="size-4" />
                  Save the first resource
                </Button>
              </div>
            </Card>
          ) : filteredResources.length === 0 ? (
            <Card className="rounded-3xl border-slate-200 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <h2 className="text-2xl font-semibold text-slate-950 text-balance">No resources match these filters.</h2>
                <p className="text-slate-600 text-pretty">
                  Try a broader search or clear the category and source filters to bring everything back.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategoryFilter("all");
                    setSourceFilter("all");
                    setSortBy("newest");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => {
                const tweetId = getTweetId(resource.url);
                return (
                <Card
                  key={resource.id}
                  className={cn("flex h-full flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 shadow-sm")}
                >
                  {tweetId ? (
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <TweetEmbed tweetId={tweetId} />
                    </div>
                  ) : resource.imageUrl ? (
                    <div className="border-b border-slate-100">
                      <img
                        src={resource.imageUrl}
                        alt=""
                        className="aspect-[1.91/1] w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {resource.category}
                        </Badge>
                        {resource.toolSubcategory && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                            {resource.toolSubcategory}
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-slate-200 text-slate-600">
                          {resource.source}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-slate-950 text-balance">{resource.title}</h2>
                        <p className="truncate text-sm text-slate-500">{getHostname(resource.url)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        aria-label={`Edit ${resource.title}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(resource)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${resource.title}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteError(null);
                          setResourceToDelete(resource);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="flex-1 text-sm leading-6 text-slate-600 text-pretty">
                    {resource.notes || "No note yet. Open the link to revisit the original resource."}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-slate-500 tabular-nums">
                      <CalendarDays className="size-4" />
                      <span>Saved {formatSavedAt(resource.savedAt)}</span>
                    </div>

                    <Button asChild variant="outline" className="gap-2">
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        Open
                        <ArrowUpRight className="size-4" />
                      </a>
                    </Button>
                  </div>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {dialogOpen && (
        <AddResourceDialog
          key={editingResource?.id ?? "create-resource"}
          open={dialogOpen}
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) {
              setEditingResource(null);
              setDialogError(null);
            }
          }}
          onSave={handleSaveResource}
          saving={dialogSaving}
          error={dialogError}
          categoryOptions={categories}
          editingResource={editingResource}
        />
      )}

      <AlertDialog
        open={Boolean(resourceToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setResourceToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              {resourceToDelete
                ? `This will remove "${resourceToDelete.title}" from the library.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteResource();
              }}
            >
              {deleting ? "Deleting..." : "Delete resource"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
