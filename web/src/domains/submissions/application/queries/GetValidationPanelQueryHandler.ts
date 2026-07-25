import { createServerClient } from "@/lib/supabase/server";
import {
  SubmissionValidationService,
  SubmissionRequirement,
  SubmissionAsset,
} from "../../domain/SubmissionValidationService";

export class GetValidationPanelQueryHandler {
  constructor(
    private validationService: SubmissionValidationService = new SubmissionValidationService(),
  ) {}

  async execute(eventId: string, teamId: string) {
    const supabase = await createServerClient();

    // Fetch requirements
    const { data: requirements } = await supabase
      .from("submission_requirements")
      .select("*")
      .eq("event_id", eventId);

    // Fetch submission & assets
    const { data: submission } = await supabase
      .from("submissions")
      .select("id")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .maybeSingle();

    type DbRequirement = {
      id: string;
      name: string;
      asset_type: string;
      is_required: boolean;
      minimum_files: number;
      maximum_files: number;
      accepted_file_types?: string;
      max_size_mb?: number;
      validation_regex?: string;
    };
    type DbAsset = {
      id: string;
      requirement_id: string;
      asset_type: string;
      text_value?: string;
      url_value?: string;
      storage_path?: string;
      metadata?: Record<string, unknown>;
    };

    let assets: DbAsset[] = [];
    if (submission) {
      const { data: assetData } = await supabase
        .from("submission_assets")
        .select("*")
        .eq("submission_id", submission.id);
      assets = (assetData ?? []) as DbAsset[];
    }

    const reqs: SubmissionRequirement[] = ((requirements ?? []) as DbRequirement[]).map((r) => ({
      id: r.id,
      name: r.name,
      assetType: r.asset_type,
      isRequired: r.is_required,
      minimumFiles: r.minimum_files,
      maximumFiles: r.maximum_files,
      acceptedFileTypes: r.accepted_file_types,
      maxSizeMb: r.max_size_mb,
      validationRegex: r.validation_regex,
    }));

    const assts: SubmissionAsset[] = (assets as DbAsset[]).map((a) => ({
      id: a.id,
      requirementId: a.requirement_id,
      assetType: a.asset_type,
      textValue: a.text_value,
      urlValue: a.url_value,
      storagePath: a.storage_path,
      metadata: a.metadata,
    }));

    return this.validationService.validate(reqs, assts);
  }
}
