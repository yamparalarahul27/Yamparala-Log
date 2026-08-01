import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Resource } from "@/app/components/types";
import { apiClient } from "@/services/api-client";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 250;
// Shared with the Favourites tab's useQuery in Resources.tsx.
export const FAVOURITES_QUERY_KEY = ["resources", "favourites"] as const;

type ResourcesQueryKey = readonly ["resources", { search: string | null }];
type ResourcesInfiniteData = InfiniteData<Resource[], string | undefined>;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface UseResourcesOptions {
  search?: string;
}

export function useResources(options: UseResourcesOptions = {}) {
  const queryClient = useQueryClient();
  const rawSearch = options.search ?? "";
  const debouncedSearch = useDebouncedValue(rawSearch.trim(), SEARCH_DEBOUNCE_MS);
  const queryKey: ResourcesQueryKey = ["resources", { search: debouncedSearch || null }];

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      apiClient.resources.getPage({
        cursor: pageParam,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].savedAt : undefined,
  });

  const resources = data?.pages.flat() ?? [];
  const loading = isLoading;
  const loadError = error instanceof Error ? error.message : null;

  // Mutate the cached infinite data by treating the flat list as the source of truth,
  // then collapsing the pages array to a single combined page. Page boundary fidelity
  // is sacrificed but `getNextPageParam` still computes the right next cursor from the
  // last item, so pagination keeps working from where the user is.
  const writeCache = (mutator: (current: Resource[]) => Resource[]) => {
    queryClient.setQueryData<ResourcesInfiniteData>(queryKey, (current) => {
      if (!current) return current;
      const flat = current.pages.flat();
      const next = mutator(flat);
      return { pages: [next], pageParams: [undefined] };
    });
  };

  const checkDuplicate = async (url: string): Promise<Resource | null> => {
    return apiClient.resources.findByNormalizedUrl(url);
  };

  const createResource = async (resource: Omit<Resource, "id">) => {
    const created = await apiClient.resources.create(resource);
    writeCache((current) =>
      [created, ...current].sort(
        (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
      ),
    );
    return created;
  };

  const updateResource = async (id: string, updates: Omit<Resource, "id">) => {
    const updated = await apiClient.resources.update(id, updates);
    writeCache((current) =>
      current.map((resource) => (resource.id === updated.id ? updated : resource)),
    );
    return updated;
  };

  const deleteResource = async (id: string) => {
    await apiClient.resources.delete(id);
    writeCache((current) => current.filter((resource) => resource.id !== id));
  };

  // Optimistic: the star fills immediately, then rolls back if the PATCH fails.
  // Both caches are patched — the paged grid and the Favourites tab's own list —
  // so the star responds instantly on whichever tab the click came from. The
  // invalidate afterwards is what actually drops an un-starred row out of the list.
  const toggleFavourite = async (id: string, isFavourite: boolean) => {
    const patch = (value: boolean) => (current: Resource[]) =>
      current.map((resource) =>
        resource.id === id ? { ...resource, isFavourite: value } : resource,
      );

    const applyLocally = (value: boolean) => {
      writeCache(patch(value));
      queryClient.setQueryData<Resource[]>(FAVOURITES_QUERY_KEY, (current) =>
        current ? patch(value)(current) : current,
      );
    };

    applyLocally(isFavourite);
    try {
      await apiClient.resources.setFavourite(id, isFavourite);
      void queryClient.invalidateQueries({ queryKey: FAVOURITES_QUERY_KEY });
    } catch (error) {
      applyLocally(!isFavourite);
      throw error;
    }
  };

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    resources,
    loading,
    loadError,
    reload,
    checkDuplicate,
    createResource,
    updateResource,
    deleteResource,
    toggleFavourite,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    loadMore,
    isSearching:
      rawSearch.trim() !== debouncedSearch ||
      (Boolean(debouncedSearch) && isFetching && !isFetchingNextPage),
  };
}
