import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Resource } from "@/app/components/types";
import { apiClient } from "@/services/api-client";

const RESOURCES_KEY = ["resources"] as const;

export function useResources() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: RESOURCES_KEY,
    queryFn: () => apiClient.resources.getAll(),
  });

  const resources = data ?? [];
  const loading = isLoading;
  const loadError = error instanceof Error ? error.message : null;

  const writeCache = (mutator: (current: Resource[]) => Resource[]) => {
    queryClient.setQueryData<Resource[]>(RESOURCES_KEY, (current) =>
      mutator(current ?? []),
    );
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

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    resources,
    loading,
    loadError,
    reload,
    checkDuplicate,
    createResource,
    updateResource,
    deleteResource,
  };
}
