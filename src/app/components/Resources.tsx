import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddResourceDialog } from "@/app/components/AddResourceDialog";
import { AdminGate } from "@/app/components/AdminGate";
import { ResourceCard } from "@/app/components/ResourceCard";
import { Resource } from "@/app/components/types";
import { getHostname } from "@/app/components/resource-format";
import { resourceToGalleryItem } from "@/app/components/gallery-utils";
import { useResources } from "@/app/hooks/useResources";

const CanvasGallery = lazy(() => import("@/app/components/CanvasGallery"));
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
import {
  ArrowUpRight,
  FolderOpen,
  GalleryHorizontalEnd,
  LayoutGrid,
  Plus,
  Search,
} from "lucide-react";

type SortValue = "newest" | "oldest" | "title";
const SHOW_GALLERY_VIEW_TRIGGER = false;

export function Resources() {
  const [query, setQuery] = useState("");
  const {
    resources,
    loading,
    loadError,
    reload,
    checkDuplicate,
    createResource,
    updateResource,
    deleteResource,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
  } = useResources({ search: query });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [activeTab, setActiveTab] = useState<"resources" | "tasks">("resources");
  const [viewMode, setViewMode] = useState<"grid" | "gallery">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Wire the bottom sentinel to fetchNextPage. The 400px rootMargin starts the
  // next request before the user actually hits the end of the list.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, loadMore]);

  const categories = Array.from(new Set(resources.map((resource) => resource.category))).sort();
  const sources = Array.from(new Set(resources.map((resource) => resource.source))).sort();

  // The query string is sent to the server (see useResources). Category / source
  // here filter only the rows already loaded — fine for narrowing within an active
  // session; if you need a category to exhaustively cover the full library, type
  // the category name into the search box instead.
  let filteredResources = resources.filter((resource) => {
    const matchesCategory = categoryFilter === "all" || resource.category === categoryFilter;
    const matchesSource = sourceFilter === "all" || resource.source === sourceFilter;
    return matchesCategory && matchesSource;
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

  const handleRequestDelete = (resource: Resource) => {
    setDeleteError(null);
    setResourceToDelete(resource);
  };

  const handleCompleteTask = async (resource: Resource) => {
    try {
      await updateResource(resource.id, { ...resource, taskDone: true });
      toast.success("Task completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete the task.";
      toast.error(message);
    }
  };

  const handleSaveResource = async (resource: Omit<Resource, "id">) => {
    setDialogError(null);
    setDialogSaving(true);

    try {
      if (editingResource) {
        await updateResource(editingResource.id, resource);
        toast.success("Resource updated");
      } else {
        const existing = await checkDuplicate(resource.url);
        if (existing) {
          setDialogError(`Already saved as "${existing.title}"`);
          setDialogSaving(false);
          return false;
        }
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
        <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
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

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isAdmin && (
                  <Button className="gap-2" onClick={handleOpenCreate}>
                    <Plus className="size-4" />
                    Save resource
                  </Button>
                )}
                <AdminGate
                  isAdmin={isAdmin}
                  onUnlock={() => setIsAdmin(true)}
                  onLock={() => setIsAdmin(false)}
                />
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "resources" ? "default" : "outline"}
                onClick={() => setActiveTab("resources")}
              >
                Resources
              </Button>
              <Button
                variant={activeTab === "tasks" ? "default" : "outline"}
                onClick={() => setActiveTab("tasks")}
              >
                Tasks
              </Button>
            </div>
            {activeTab === "resources" && (
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  aria-label="Grid view"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                {SHOW_GALLERY_VIEW_TRIGGER && (
                  <Button
                    variant={viewMode === "gallery" ? "default" : "ghost"}
                    size="icon"
                    aria-label="Gallery view"
                    onClick={() => setViewMode("gallery")}
                  >
                    <GalleryHorizontalEnd className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {activeTab === "tasks" ? (
            <Card className="rounded-3xl border-slate-200 p-4 shadow-sm sm:p-6">
              {(() => {
                const pendingTasks = resources.filter((r) => r.notes.trim() !== "" && !r.taskDone);
                if (pendingTasks.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No pending tasks. Add a comment to a resource to create one.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col divide-y divide-slate-100">
                    {pendingTasks.map((resource) => (
                      <div key={resource.id} className="flex items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          disabled={!isAdmin}
                          className="mt-1 size-5 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:disabled)]:cursor-pointer"
                          onChange={() => void handleCompleteTask(resource)}
                          aria-label={`Complete task: ${resource.notes}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 text-pretty">{resource.notes}</p>
                          <p className="truncate text-xs text-slate-500">{getHostname(resource.url)}</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="gap-1 shrink-0">
                          <a href={resource.url} target="_blank" rel="noreferrer">
                            Open
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          ) : viewMode === "gallery" ? (
          <div className="h-[70vh] w-full overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading gallery...</div>}>
              <CanvasGallery
                items={filteredResources.map(resourceToGalleryItem).filter((g): g is NonNullable<typeof g> => g !== null)}
              />
            </Suspense>
          </div>
          ) : (
          <>
          <Card className="rounded-3xl border-slate-200 p-4 shadow-sm sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search resources"
                  className="pl-9"
                  placeholder="Search title, notes, description, source, or author"
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
          ) : resources.length === 0 && !query.trim() ? (
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
            <>
              <div className="columns-1 gap-4 space-y-4 md:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
                {filteredResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    isAdmin={isAdmin}
                    onEdit={handleOpenEdit}
                    onDelete={handleRequestDelete}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="py-6 text-center text-sm text-slate-500">
                {isFetchingNextPage
                  ? "Loading more…"
                  : hasNextPage
                    ? ""
                    : "You've reached the end."}
              </div>
            </>
          )}
          </>
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
