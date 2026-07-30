"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HackathonSubmissionForm } from "@/src/domains/submissions/components/HackathonSubmissionForm";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  eventId: string;
  teamId: string;
  initialData?: any;
}

export function HackathonSubmissionClient({ eventId, teamId, initialData }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSaveDraft = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          status: "DRAFT",
          ...data,
        }),
      });

      if (!res.ok) throw new Error("Failed to save draft");

      toast({
        title: "Draft Saved",
        description: "Your submission draft has been saved.",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFinal = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          status: "SUBMITTED",
          ...data,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit project");

      toast({
        title: "Project Submitted!",
        description: "Your final submission was successful.",
      });
      router.push(`/events/${eventId}/submissions`);
      router.refresh();
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to submit project. Please try again.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HackathonSubmissionForm
      initialData={initialData}
      onSaveDraft={handleSaveDraft}
      onSubmitFinal={handleSubmitFinal}
      isSaving={isSaving}
    />
  );
}
