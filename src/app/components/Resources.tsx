import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";
import { AddResourceDialog } from "@/app/components/AddResourceDialog";
import { AdminGate } from "@/app/components/AdminGate";
import { ResourceCard } from "@/app/components/ResourceCard";
import { SearchModal } from "@/app/components/SearchModal";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { FilterPopover, type SortValue } from "@/app/components/FilterPopover";
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
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
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
  List,
  Plus,
  Search,
} from "lucide-react";

const SHOW_GALLERY_VIEW_TRIGGER = false;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
type TabValue = "resources" | "this-week" | "tasks";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function Resources() {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
    isSearching,
  } = useResources({ search: query });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [activeTab, setActiveTab] = useState<TabValue>("resources");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gallery">("grid");
  const activeSearch = query.trim();

  // List view loads every resource (lean payload) in one shot. Enabled only when
  // the user actually flips to list view to keep the page-load cost off the
  // grid-view default.
  const {
    data: listAll = [],
    isLoading: listLoading,
    error: listError,
  } = useQuery({
    queryKey: ["resources", "list-all"],
    queryFn: () => apiClient.resources.getAllLight(),
    enabled: viewMode === "list",
    staleTime: 60_000,
  });
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

  // "/" opens the search palette. Guarded against firing while another
  // dialog (add/edit, delete confirm) is already open.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (dialogOpen || resourceToDelete) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dialogOpen, resourceToDelete]);

  const categories = Array.from(new Set(resources.map((resource) => resource.category))).sort();
  const sources = Array.from(new Set(resources.map((resource) => resource.source))).sort();

  // The query string is sent to the server (see useResources). Category / source
  // here filter only the rows already loaded — fine for narrowing within an active
  // session; if you need a category to exhaustively cover the full library, type
  // the category name into the search box instead.
  const weekCutoff = Date.now() - ONE_WEEK_MS;
  let filteredResources = resources.filter((resource) => {
    const matchesCategory = categoryFilter === "all" || resource.category === categoryFilter;
    const matchesSource = sourceFilter === "all" || resource.source === sourceFilter;
    const matchesWeek =
      activeTab !== "this-week" || new Date(resource.savedAt).getTime() >= weekCutoff;
    return matchesCategory && matchesSource && matchesWeek;
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
          <div className="flex items-center justify-between gap-2">
            <div className="hidden gap-2 sm:flex">
              <Button
                variant={activeTab === "resources" ? "default" : "outline"}
                onClick={() => setActiveTab("resources")}
              >
                Resources
              </Button>
              <Button
                variant={activeTab === "this-week" ? "default" : "outline"}
                onClick={() => setActiveTab("this-week")}
              >
                This Week
              </Button>
              <Button
                variant={activeTab === "tasks" ? "default" : "outline"}
                onClick={() => setActiveTab("tasks")}
              >
                Tasks
              </Button>
            </div>
            <div className="sm:hidden">
              <Select value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
                <SelectTrigger aria-label="Switch view" className="min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resources">Resources</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="tasks">Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                className="min-w-0 gap-2"
                onClick={() => setSearchOpen(true)}
                aria-label="Search resources"
              >
                <Search className="size-4" />
                <span className="hidden max-w-[12rem] truncate sm:inline">
                  {activeSearch || "Search"}
                </span>
                <kbd className="hidden rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 sm:inline">
                  /
                </kbd>
              </Button>
              {activeTab !== "tasks" && (
                <FilterPopover
                  categories={categories}
                  sources={sources}
                  categoryFilter={categoryFilter}
                  sourceFilter={sourceFilter}
                  sortBy={sortBy}
                  onCategoryChange={setCategoryFilter}
                  onSourceChange={setSourceFilter}
                  onSortChange={setSortBy}
                  onClear={() => {
                    setCategoryFilter("all");
                    setSourceFilter("all");
                    setSortBy("newest");
                  }}
                />
              )}
              {isAdmin && (
                <Button
                  className="gap-2"
                  onClick={handleOpenCreate}
                  aria-label="Save resource"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Save resource</span>
                </Button>
              )}
              <AdminGate
                isAdmin={isAdmin}
                onUnlock={() => setIsAdmin(true)}
                onLock={() => setIsAdmin(false)}
              />
              {activeTab !== "tasks" && (
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="size-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="size-4" />
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
          </div>

          {activeTab === "tasks" ? (
            <Card className="rounded-3xl border-slate-200 dark:border-slate-700 p-4 shadow-sm sm:p-6">
              {(() => {
                const pendingTasks = resources.filter((r) => r.task.trim() !== "" && !r.taskDone);
                if (pendingTasks.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No pending tasks. Send a follow-up message on Telegram after saving a link to create one.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    {pendingTasks.map((resource) => (
                      <div key={resource.id} className="flex items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          disabled={!isAdmin}
                          className="mt-1 size-5 rounded border-slate-300 dark:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:disabled)]:cursor-pointer"
                          onChange={() => void handleCompleteTask(resource)}
                          aria-label={`Complete task: ${resource.task}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 dark:text-slate-100 text-pretty">{resource.task}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{getHostname(resource.url)}</p>
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
          ) : activeTab === "resources" && viewMode === "gallery" ? (
          <div className="h-[70vh] w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">Loading gallery...</div>}>
              <CanvasGallery
                items={filteredResources.map(resourceToGalleryItem).filter((g): g is NonNullable<typeof g> => g !== null)}
              />
            </Suspense>
          </div>
          ) : viewMode === "list" ? (
          (() => {
            const listFiltered = listAll.filter((r) => {
              const matchesCategory = categoryFilter === "all" || r.category === categoryFilter;
              const matchesSource = sourceFilter === "all" || r.source === sourceFilter;
              const matchesWeek =
                activeTab !== "this-week" || new Date(r.savedAt).getTime() >= weekCutoff;
              return matchesCategory && matchesSource && matchesWeek;
            });
            if (listError) {
              return (
                <Card className="rounded-3xl border-red-200 bg-red-50 p-6 shadow-sm">
                  <p className="text-sm text-red-700">
                    {listError instanceof Error ? listError.message : "Could not load the list."}
                  </p>
                </Card>
              );
            }
            if (listLoading) {
              return (
                <Card className="rounded-3xl border-slate-200 dark:border-slate-700 p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1 py-2.5">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                    ))}
                  </div>
                </Card>
              );
            }
            if (listFiltered.length === 0) {
              return (
                <Card className="rounded-3xl border-slate-200 dark:border-slate-700 p-10 text-center shadow-sm">
                  <p className="text-slate-600 dark:text-slate-300 text-pretty">
                    {activeTab === "this-week"
                      ? "Nothing new this week — yet."
                      : "No resources match these filters."}
                  </p>
                </Card>
              );
            }
            return (
              <Card className="rounded-3xl border-slate-200 dark:border-slate-700 p-2 shadow-sm sm:p-3">
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                  {listFiltered.map((r) => (
                    <li key={r.id}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                          {r.title}
                        </span>
                        <span className="shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">
                          {getHostname(r.url)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="px-3 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  {listFiltered.length} {listFiltered.length === 1 ? "resource" : "resources"}
                </p>
              </Card>
            );
          })()
          ) : (
          <>
          {loadError ? (
            <Card className="rounded-3xl border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-red-800 text-balance">The library could not be loaded.</h2>
                  <p className="text-sm text-red-700 text-pretty">{loadError}</p>
                </div>
                <Button variant="outline" className="border-red-200 bg-white dark:bg-slate-900" onClick={reload}>
                  Try again
                </Button>
              </div>
            </Card>
          ) : loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="rounded-3xl border-slate-200 dark:border-slate-700 p-5 shadow-sm">
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
            <Card className="rounded-3xl border-dashed border-slate-300 dark:border-slate-600 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-blue-700">
                  <FolderOpen className="size-5" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-slate-50 text-balance">Start your library with the next link you save.</h2>
                <p className="text-slate-600 dark:text-slate-300 text-pretty">
                  Add a resource once, tag where it came from, and leave a quick note for the future version of you.
                </p>
                <Button className="gap-2" onClick={handleOpenCreate}>
                  <Plus className="size-4" />
                  Save the first resource
                </Button>
              </div>
            </Card>
          ) : filteredResources.length === 0 ? (
            <Card className="rounded-3xl border-slate-200 dark:border-slate-700 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-slate-50 text-balance">
                  {activeTab === "this-week"
                    ? "Nothing new this week — yet."
                    : "No resources match these filters."}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-pretty">
                  {activeTab === "this-week"
                    ? "Resources you save in the next seven days will show up here."
                    : "Try a broader search or clear the category and source filters to bring everything back."}
                </p>
                {activeTab === "this-week" ? (
                  <Button variant="outline" onClick={() => setActiveTab("resources")}>
                    Back to all resources
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryFilter("all");
                      setSourceFilter("all");
                      setSortBy("newest");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
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
              <div ref={sentinelRef} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
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

      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={query}
        onQueryChange={setQuery}
        onSubmitQuery={() => setSearchOpen(false)}
        resources={resources}
        isSearching={isSearching}
      />

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
