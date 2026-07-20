import { useState, useEffect, useCallback, useMemo } from "react";
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
      return res.json().then(d => d.data);
    }
  });

  // 2. Fetch Validation State
  const { data: validationResult, refetch: refetchValidation } = useQuery({
    queryKey: ["submission-validation", eventId, teamId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/validation`);
      if (!res.ok) throw new Error("Failed to fetch validation");
      return res.json().then(d => d.data);
    }
  });

  // 3. Batch Auto Save Mutation
  const saveTasks = useCallback(async (tasks: any[]) => {
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
            assetData: task.assetData
          })
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
  }, [eventId, teamId, refetchValidation]);

  // 4. Instantiate AutoSaveManager
  const autoSaver = useMemo(() => new AutoSaveManager(saveTasks, 1000), [saveTasks]);

  // 5. Submit Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/teams/${teamId}/submission/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-hub"] });
    }
  });

  // Actions
  const saveAsset = useCallback((requirementId: string, assetData: any) => {
    setConnectionStatus("SAVING");
    
    // Optimistically update the UI cache
    queryClient.setQueryData(["submission-hub", eventId, teamId], (oldData: any) => {
      if (!oldData) return oldData;
      
      const newAssets = [...oldData.assets];
      const existingIdx = newAssets.findIndex(a => a.requirement_id === requirementId);
      
      const updatedAsset = {
        requirement_id: requirementId,
        asset_type: assetData.assetType,
        text_value: assetData.textValue || null,
        url_value: assetData.urlValue || null,
        storage_path: assetData.storagePath || null,
      };

      if (existingIdx >= 0) {
        newAssets[existingIdx] = updatedAsset;
      } else {
        newAssets.push(updatedAsset);
      }

      return { ...oldData, assets: newAssets };
    });

    autoSaver.enqueue(requirementId, assetData);
  }, [autoSaver, queryClient, eventId, teamId]);

  const uploadAsset = useCallback(async (requirementId: string, file: File, onProgress: (p: number) => void) => {
    setConnectionStatus("SAVING");
    try {
      const result = await UploadManager.upload(teamId, eventId, file, onProgress);
      // Once uploaded, save the asset reference
      saveAsset(requirementId, {
        assetType: "FILE",
        storagePath: result.storagePath,
        metadata: {
           sizeMb: file.size / (1024 * 1024),
           mimeType: file.type,
           filename: file.name
        }
      });
      return result;
    } catch (e) {
      setConnectionStatus("ERROR");
      throw e;
    }
  }, [teamId, eventId, saveAsset]);

  const submit = useCallback(async () => {
    // Flush any pending saves before submitting
    await autoSaver.flush();
    return submitMutation.mutateAsync();
  }, [autoSaver, submitMutation]);

  return {
    hubData,
    isLoadingHub,
    validationResult,
    connectionStatus,
    saveAsset,
    uploadAsset,
    submit,
    isSubmitting: submitMutation.isPending,
  };
}
