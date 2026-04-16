import { useCallback, useEffect, useState } from "react";
import { Resource } from "@/app/components/types";
import { apiClient } from "@/services/api-client";

export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const fetchedResources = await apiClient.resources.getAll();
      setResources(fetchedResources);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not load the resource library right now.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const checkDuplicate = async (url: string): Promise<Resource | null> => {
    return apiClient.resources.findByNormalizedUrl(url);
  };

  const createResource = async (resource: Omit<Resource, "id">) => {
    const createdResource = await apiClient.resources.create(resource);
    setResources((current) =>
      [createdResource, ...current].sort(
        (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
      ),
    );
    return createdResource;
  };

  const updateResource = async (id: string, updates: Omit<Resource, "id">) => {
    const updatedResource = await apiClient.resources.update(id, updates);
    setResources((current) =>
      current.map((resource) => (resource.id === updatedResource.id ? updatedResource : resource)),
    );
    return updatedResource;
  };

  const deleteResource = async (id: string) => {
    await apiClient.resources.delete(id);
    setResources((current) => current.filter((resource) => resource.id !== id));
  };

  return {
    resources,
    loading,
    loadError,
    reload: loadResources,
    checkDuplicate,
    createResource,
    updateResource,
    deleteResource,
  };
}
