import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AutoSaveManager } from "../lib/AutoSaveManager";
import { UploadManager } from "../lib/UploadManager";

export type ConnectionStatus = "SAVING" | "SAVED" | "OFFLINE" | "ERROR" | "IDLE";

export function useSubmissionController(eventId: string, teamId: string) {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("IDLE");

  // 1. Fetch Hub Data (Draft, Requirements, Assets)
  const { data: hubData, isLoading: isLoadingHub } = useQuery({
    queryKey: ["submission-hub", eventId, teamId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission`);
      if (!res.ok) throw new Error("Failed to fetch hub data");
      return res.json().then((d) => d.data);
    },
  });

  // 2. Fetch Validation State
  const { data: validationResult, refetch: refetchValidation } = useQuery({
    queryKey: ["submission-validation", eventId, teamId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/validation`);
      if (!res.ok) throw new Error("Failed to fetch validation");
      return res.json().then((d) => d.data);
    },
  });

  type SaveTaskItem = { requirementId: string; assetData: Record<string, unknown> };
  type AssetData = {
    assetType: string;
    textValue?: string;
    urlValue?: string;
    storagePath?: string;
    metadata?: Record<string, unknown>;
  };
  type HubCache = {
    assets: Array<{
      requirement_id: string;
      asset_type: string;
      text_value: string | null;
      url_value: string | null;
      storage_path: string | null;
    }>;
    [key: string]: unknown;
  };

  // 3. Batch Auto Save Mutation
  const saveTasks = useCallback(
    async (tasks: SaveTaskItem[]) => {
      if (tasks.length === 0) return;
      setConnectionStatus("SAVING");

      try {
        // Process sequentially for now, could be parallelized if backend supports batch
        for (const task of tasks) {
          const res = await fetch(`/api/v1/teams/${teamId}/submission`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              requirementId: task.requirementId,
              assetData: task.assetData,
            }),
          });
          if (!res.ok) throw new Error("Failed to save");
        }
        setConnectionStatus("SAVED");
        // Refetch validation on successful save
        refetchValidation();
      } catch (e) {
        setConnectionStatus("ERROR");
        throw e;
      }
    },
    [eventId, teamId, refetchValidation],
  );

  // 4. Instantiate AutoSaveManager
  const autoSaver = useMemo(() => new AutoSaveManager(saveTasks, 1000), [saveTasks]);

  // Fetch submission activity history (replaces hardcoded mocks)
  const { data: activityData } = useQuery({
    queryKey: ["submission-history", eventId, teamId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/history?eventId=${eventId}`);
      if (!res.ok) return { activities: [] };
      return res.json().then((d) => d.data ?? { activities: [] });
    },
    enabled: !!teamId,
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-hub"] });
    },
  });

  const unsubmitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/unsubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error("Failed to unsubmit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-hub"] });
    },
  });

  // Actions
  const saveAsset = useCallback(
    (requirementId: string, assetData: AssetData) => {
      setConnectionStatus("SAVING");
      queryClient.setQueryData(
        ["submission-hub", eventId, teamId],
        (oldData: HubCache | undefined) => {
          if (!oldData) return oldData;
          const newAssets = [...oldData.assets];
          const existingIdx = newAssets.findIndex((a) => a.requirement_id === requirementId);
          const updatedAsset = {
            requirement_id: requirementId,
            asset_type: assetData.assetType,
            text_value: assetData.textValue ?? null,
            url_value: assetData.urlValue ?? null,
            storage_path: assetData.storagePath ?? null,
          };
          if (existingIdx >= 0) {
            newAssets[existingIdx] = updatedAsset;
          } else {
            newAssets.push(updatedAsset);
          }
          return { ...oldData, assets: newAssets };
        },
      );
      autoSaver.enqueue(requirementId, assetData);
    },
    [autoSaver, queryClient, eventId, teamId],
  );

  const uploadAsset = useCallback(
    async (requirementId: string, assetType: string, file: File, onProgress: (p: number) => void) => {
      setConnectionStatus("SAVING");
      try {
        const result = await UploadManager.upload(teamId, eventId, file, onProgress);
        // Once uploaded, save the asset reference
        saveAsset(requirementId, {
          assetType,
          storagePath: result.storagePath,
          metadata: {
            sizeMb: file.size / (1024 * 1024),
            mimeType: file.type,
            filename: file.name,
          },
        });
        return result;
      } catch (e) {
        setConnectionStatus("ERROR");
        throw e;
      }
    },
    [teamId, eventId, saveAsset],
  );

  const submit = useCallback(async () => {
    // Flush any pending saves before submitting
    await autoSaver.flush();
    return submitMutation.mutateAsync();
  }, [autoSaver, submitMutation]);

  const unsubmit = useCallback(async () => {
    return unsubmitMutation.mutateAsync();
  }, [unsubmitMutation]);

  const removeAsset = useCallback(
    async (requirementId: string) => {
      setConnectionStatus("SAVING");
      try {
        const res = await fetch(`/api/v1/teams/${teamId}/submission`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, requirementId }),
        });
        if (!res.ok) throw new Error("Failed to delete asset");
        
        // Optimistically remove from cache
        queryClient.setQueryData(
          ["submission-hub", eventId, teamId],
          (oldData: HubCache | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              assets: oldData.assets.filter((a) => a.requirement_id !== requirementId),
            };
          }
        );
        setConnectionStatus("SAVED");
        refetchValidation();
      } catch (e) {
        setConnectionStatus("ERROR");
        throw e;
      }
    },
    [teamId, eventId, queryClient, refetchValidation],
  );

  return {
    hubData,
    isLoadingHub,
    validationResult,
    connectionStatus,
    isCaptain: hubData?.isCaptain ?? false,
    activities: activityData?.activities ?? [],
    saveAsset,
    uploadAsset,
    removeAsset,
    submit,
    unsubmit,
    isSubmitting: submitMutation.isPending,
    isUnsubmitting: unsubmitMutation.isPending,
  };
}
