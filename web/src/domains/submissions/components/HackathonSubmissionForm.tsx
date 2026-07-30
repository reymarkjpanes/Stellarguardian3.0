"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrayInput } from "@/components/ui/array-input";

// The base schema allows optional fields for draft saves
const baseSchema = z.object({
  title: z.string().optional(),
  short_description: z.string().max(500, "Max 500 characters").optional(),
  detailed_description: z.string().optional(),
  problem_statement: z.string().optional(),
  solution_overview: z.string().optional(),
  key_features: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  github_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  live_demo_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  video_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  presentation_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  documentation_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  api_docs_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  smart_contract_addresses: z.array(z.string()).optional(),
  blockchain_explorer_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  deployed_network: z.string().optional(),
  ai_models_used: z.string().optional(),
  challenges_faced: z.string().optional(),
  future_improvements: z.string().optional(),
  additional_notes: z.string().optional(),
  categories_entered: z.array(z.string()).optional(),
});

export type SubmissionFormData = z.infer<typeof baseSchema>;

// The final schema enforces required fields
const finalSchema = baseSchema.extend({
  title: z.string().min(1, "Title is required"),
  github_url: z.string().min(1, "GitHub URL is required").url("Must be a valid URL"),
});

interface Props {
  initialData?: SubmissionFormData;
  onSaveDraft: (data: SubmissionFormData) => Promise<void>;
  onSubmitFinal: (data: SubmissionFormData) => Promise<void>;
  isSaving?: boolean;
}

export function HackathonSubmissionForm({
  initialData,
  onSaveDraft,
  onSubmitFinal,
  isSaving,
}: Props) {
  const [activeTab, setActiveTab] = useState<"basic" | "details" | "links" | "extra">("basic");
  
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<SubmissionFormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: initialData || {
      tech_stack: [],
      smart_contract_addresses: [],
      categories_entered: [],
    },
  });

  const handleDraft = async (data: SubmissionFormData) => {
    await onSaveDraft(data);
  };

  const handleFinal = async (data: SubmissionFormData) => {
    const result = finalSchema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((err: z.ZodIssue) => {
        if (err.path[0]) {
          setError(err.path[0] as keyof SubmissionFormData, { type: "manual", message: err.message });
        }
      });
      // Optionally alert the user
      alert("Please fix the validation errors before submitting.");
      return;
    }
    await onSubmitFinal(data);
  };

  return (
    <div className="card p-6 w-full max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[var(--border)] mb-6 overflow-x-auto">
        {["basic", "details", "links", "extra"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab as "basic" | "details" | "links" | "extra")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <form className="space-y-6">
        {activeTab === "basic" && (
          <div className="space-y-4">
            <div>
              <Label>Project Title <span className="text-red-500">*</span></Label>
              <Input {...register("title")} placeholder="My Awesome Project" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label>Short Description</Label>
              <Input {...register("short_description")} placeholder="One liner about the project" />
              {errors.short_description && <p className="text-red-500 text-xs mt-1">{errors.short_description.message}</p>}
            </div>
            <div>
              <Label>Categories Entered</Label>
              <Controller
                control={control}
                name="categories_entered"
                render={({ field }) => (
                  <ArrayInput value={field.value || []} onChange={field.onChange} placeholder="e.g. DeFi, NFTs" />
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <div className="space-y-4">
            <div>
              <Label>Detailed Description (Markdown)</Label>
              <Textarea {...register("detailed_description")} rows={6} />
            </div>
            <div>
              <Label>Problem Statement</Label>
              <Textarea {...register("problem_statement")} rows={4} />
            </div>
            <div>
              <Label>Solution Overview</Label>
              <Textarea {...register("solution_overview")} rows={4} />
            </div>
            <div>
              <Label>Key Features</Label>
              <Textarea {...register("key_features")} rows={4} />
            </div>
            <div>
              <Label>Tech Stack</Label>
              <Controller
                control={control}
                name="tech_stack"
                render={({ field }) => (
                  <ArrayInput value={field.value || []} onChange={field.onChange} placeholder="e.g. React, Solidity, Rust" />
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "links" && (
          <div className="space-y-4">
            <div>
              <Label>GitHub URL <span className="text-red-500">*</span></Label>
              <Input {...register("github_url")} placeholder="https://github.com/..." />
              {errors.github_url && <p className="text-red-500 text-xs mt-1">{errors.github_url.message}</p>}
            </div>
            <div>
              <Label>Live Demo URL</Label>
              <Input {...register("live_demo_url")} placeholder="https://..." />
              {errors.live_demo_url && <p className="text-red-500 text-xs mt-1">{errors.live_demo_url.message}</p>}
            </div>
            <div>
              <Label>Video Demo URL</Label>
              <Input {...register("video_url")} placeholder="https://youtube.com/..." />
              {errors.video_url && <p className="text-red-500 text-xs mt-1">{errors.video_url.message}</p>}
            </div>
            <div>
              <Label>Presentation URL</Label>
              <Input {...register("presentation_url")} placeholder="https://..." />
            </div>
            <div>
              <Label>Documentation URL</Label>
              <Input {...register("documentation_url")} placeholder="https://..." />
            </div>
            <div>
              <Label>API Docs URL</Label>
              <Input {...register("api_docs_url")} placeholder="https://..." />
            </div>
          </div>
        )}

        {activeTab === "extra" && (
          <div className="space-y-4">
            <div>
              <Label>Deployed Network</Label>
              <Input {...register("deployed_network")} placeholder="e.g. Ethereum Mainnet, Polygon Mumbai" />
            </div>
            <div>
              <Label>Smart Contract Addresses</Label>
              <Controller
                control={control}
                name="smart_contract_addresses"
                render={({ field }) => (
                  <ArrayInput value={field.value || []} onChange={field.onChange} placeholder="0x..." />
                )}
              />
            </div>
            <div>
              <Label>Blockchain Explorer URL</Label>
              <Input {...register("blockchain_explorer_url")} placeholder="https://..." />
            </div>
            <div>
              <Label>AI Models Used</Label>
              <Input {...register("ai_models_used")} placeholder="e.g. GPT-4, Llama 2" />
            </div>
            <div>
              <Label>Challenges Faced</Label>
              <Textarea {...register("challenges_faced")} rows={3} />
            </div>
            <div>
              <Label>Future Improvements</Label>
              <Textarea {...register("future_improvements")} rows={3} />
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea {...register("additional_notes")} rows={3} />
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-8 pt-4 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit(handleDraft)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(handleFinal)}
            disabled={isSaving}
          >
            Submit Final
          </Button>
        </div>
      </form>
    </div>
  );
}
