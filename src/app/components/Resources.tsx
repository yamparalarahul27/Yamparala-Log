import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";
import { AddResourceDialog } from "@/app/components/AddResourceDialog";
import { InboxView } from "@/app/components/InboxView";
import { ResourceCard } from "@/app/components/ResourceCard";
import { SearchModal } from "@/app/components/SearchModal";
import {
  ResourcesToolbar,
  type TabValue,
  type ViewMode,
} from "@/app/components/ResourcesToolbar";
import { type SortValue } from "@/app/components/FilterPopover";
import { Resource } from "@/app/components/types";
import { getHostname } from "@/app/components/resource-format";
import { resourceToGalleryItem } from "@/app/components/gallery-utils";
import { FAVOURITES_QUERY_KEY, useResources } from "@/app/hooks/useResources";
import { useResponsiveColumns } from "@/app/hooks/useResponsiveColumns";

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
import { Skeleton } from "@/app/components/ui/skeleton";
import { ArrowUpRight, FolderOpen, Plus, Star } from "lucide-react";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

interface CardGridProps {
  resources: Resource[];
  columns: number;
  isAdmin: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
  onToggleFavourite: (resource: Resource) => void;
}

// Cards are assigned to a column by position (i % columns), not by height, so a
// card growing never moves another card to a different column — only pushes down
// its own. Unlike CSS `columns-*`, which rebalances every column whenever any
// card's height changes.
function CardGrid({ resources, columns, ...handlers }: CardGridProps) {
  const columnBuckets: Resource[][] = Array.from({ length: columns }, () => []);
  resources.forEach((resource, index) => {
    columnBuckets[index % columns].push(resource);
  });

  return (
    <div className="flex gap-4">
      {columnBuckets.map((bucket, columnIndex) => (
        <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
          {bucket.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} {...handlers} />
          ))}
        </div>
      ))}
    </div>
  );
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
    toggleFavourite,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    isSearching,
  } = useResources({ search: query });
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [activeTab, setActiveTab] = useState<TabValue>("resources");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
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
  // Inbox scans the whole library for rows missing tags/notes — loaded only
  // when the tab is visited, same philosophy as the list view above.
  const {
    data: inboxRows = [],
    isLoading: inboxLoading,
    error: inboxError,
  } = useQuery({
    queryKey: ["resources", "inbox"],
    queryFn: () => apiClient.resources.getInbox(),
    enabled: activeTab === "inbox",
    staleTime: 60_000,
  });
  // Favourites gets its own fetch rather than filtering `resources`, which only
  // holds the pages infinite scroll has reached — an older star would be missing.
  const {
    data: favourites = [],
    isLoading: favouritesLoading,
    error: favouritesError,
  } = useQuery({
    queryKey: FAVOURITES_QUERY_KEY,
    queryFn: () => apiClient.resources.getFavourites(),
    enabled: activeTab === "favourites",
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

  // Tasks / Inbox / Favourites are admin-only. If admin is locked while one of
  // them is active, fall back to Resources so its hidden-tab view can't linger.
  useEffect(() => {
    if (!isAdmin && (activeTab === "tasks" || activeTab === "inbox" || activeTab === "favourites")) {
      setActiveTab("resources");
    }
  }, [isAdmin, activeTab]);

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

  const columns = useResponsiveColumns();

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

  const handleToggleFavourite = async (resource: Resource) => {
    try {
      await toggleFavourite(resource.id, !resource.isFavourite);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update that favourite.";
      toast.error(message);
    }
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
          <ResourcesToolbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            inboxCount={inboxRows.length}
            activeSearch={activeSearch}
            onOpenSearch={() => setSearchOpen(true)}
            categories={categories}
            sources={sources}
            categoryFilter={categoryFilter}
            sourceFilter={sourceFilter}
            sortBy={sortBy}
            onCategoryChange={setCategoryFilter}
            onSourceChange={setSourceFilter}
            onSortChange={setSortBy}
            onClearFilters={() => {
              setCategoryFilter("all");
              setSourceFilter("all");
              setSortBy("newest");
            }}
            isAdmin={isAdmin}
            onUnlockAdmin={() => setIsAdmin(true)}
            onLockAdmin={() => setIsAdmin(false)}
            onOpenCreate={handleOpenCreate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {activeTab === "favourites" ? (
            favouritesError ? (
              <Card className="rounded-3xl border-red-200 bg-red-50 p-6 shadow-sm">
                <p className="text-sm text-red-700">
                  {favouritesError instanceof Error
                    ? favouritesError.message
                    : "Could not load your favourites."}
                </p>
              </Card>
            ) : favouritesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card
                    key={index}
                    className="rounded-3xl border-stone-200 dark:border-stone-700 p-5 shadow-sm"
                  >
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-4/5" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : favourites.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-stone-300 dark:border-stone-600 p-10 text-center shadow-sm">
                <div className="mx-auto max-w-lg space-y-3">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                    <Star className="size-5 fill-amber-400 text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50 text-balance">
                    Nothing starred yet.
                  </h2>
                  <p className="text-stone-600 dark:text-stone-300 text-pretty">
                    {isAdmin
                      ? "Tap the star on any card to keep it here."
                      : "Unlock admin to start starring the resources worth coming back to."}
                  </p>
                </div>
              </Card>
            ) : (
              <CardGrid
                resources={favourites}
                columns={columns}
                isAdmin={isAdmin}
                onEdit={handleOpenEdit}
                onDelete={handleRequestDelete}
                onToggleFavourite={handleToggleFavourite}
              />
            )
          ) : activeTab === "inbox" ? (
            <InboxView
              rows={inboxRows}
              loading={inboxLoading}
              error={inboxError instanceof Error ? inboxError : null}
              isAdmin={isAdmin}
            />
          ) : activeTab === "tasks" ? (
            <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-4 shadow-sm sm:p-6">
              {(() => {
                const pendingTasks = resources.filter((r) => r.task.trim() !== "" && !r.taskDone);
                if (pendingTasks.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                      No pending tasks. Send a follow-up message on Telegram after saving a link to create one.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                    {pendingTasks.map((resource) => (
                      <div key={resource.id} className="flex items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          disabled={!isAdmin}
                          className="mt-1 size-5 rounded border-stone-300 dark:border-stone-600 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:disabled)]:cursor-pointer"
                          onChange={() => void handleCompleteTask(resource)}
                          aria-label={`Complete task: ${resource.task}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-900 dark:text-stone-100 text-pretty">{resource.task}</p>
                          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{getHostname(resource.url)}</p>
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
          <div className="h-[70vh] w-full overflow-hidden rounded-3xl border border-stone-200 dark:border-stone-700 shadow-sm">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-stone-400 dark:text-stone-500">Loading gallery...</div>}>
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
                <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
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
                <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-10 text-center shadow-sm">
                  <p className="text-stone-600 dark:text-stone-300 text-pretty">
                    {activeTab === "this-week"
                      ? "Nothing new this week — yet."
                      : "No resources match these filters."}
                  </p>
                </Card>
              );
            }
            return (
              <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-2 shadow-sm sm:p-3">
                <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                  {listFiltered.map((r) => (
                    <li key={r.id}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors hover:bg-stone-50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-stone-900 dark:text-stone-100">
                          {r.title}
                        </span>
                        <span className="shrink-0 truncate text-xs text-stone-500 dark:text-stone-400">
                          {getHostname(r.url)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="px-3 py-2 text-center text-xs text-stone-400 dark:text-stone-500">
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
                <Button variant="outline" className="border-red-200 bg-white dark:bg-stone-900" onClick={reload}>
                  Try again
                </Button>
              </div>
            </Card>
          ) : loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="rounded-3xl border-stone-200 dark:border-stone-700 p-5 shadow-sm">
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
            <Card className="rounded-3xl border-dashed border-stone-300 dark:border-stone-600 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-blue-700">
                  <FolderOpen className="size-5" />
                </div>
                <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50 text-balance">Start your library with the next link you save.</h2>
                <p className="text-stone-600 dark:text-stone-300 text-pretty">
                  Add a resource once, tag where it came from, and leave a quick note for the future version of you.
                </p>
                <Button className="gap-2" onClick={handleOpenCreate}>
                  <Plus className="size-4" />
                  Save the first resource
                </Button>
              </div>
            </Card>
          ) : filteredResources.length === 0 ? (
            <Card className="rounded-3xl border-stone-200 dark:border-stone-700 p-10 text-center shadow-sm">
              <div className="mx-auto max-w-lg space-y-3">
                <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50 text-balance">
                  {activeTab === "this-week"
                    ? "Nothing new this week — yet."
                    : "No resources match these filters."}
                </h2>
                <p className="text-stone-600 dark:text-stone-300 text-pretty">
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
              <CardGrid
                resources={filteredResources}
                columns={columns}
                isAdmin={isAdmin}
                onEdit={handleOpenEdit}
                onDelete={handleRequestDelete}
                onToggleFavourite={handleToggleFavourite}
              />
              <div ref={sentinelRef} className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">
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
