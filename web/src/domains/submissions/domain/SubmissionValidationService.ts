export interface SubmissionRequirement {
  id: string;
  name: string;
  assetType: string;
  isRequired: boolean;
  minimumFiles: number;
  maximumFiles: number;
  acceptedFileTypes?: string;
  maxSizeMb?: number;
  validationRegex?: string;
}

export interface SubmissionAsset {
  id: string;
  requirementId: string;
  assetType: string;
  textValue?: string;
  urlValue?: string;
  storagePath?: string;
  metadata?: any;
}

export interface ValidationResult {
  isReady: boolean;
  progress: number;
  missing: string[];
  passed: string[];
  warnings: string[];
  errors: string[];
}

export class SubmissionValidationService {
  public validate(
    requirements: SubmissionRequirement[],
    assets: SubmissionAsset[]
  ): ValidationResult {
    const missing: string[] = [];
    const passed: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    
    let requiredCount = 0;
    let completedRequiredCount = 0;

    for (const req of requirements) {
      if (req.isRequired) {
        requiredCount++;
      }

      // Find all assets linked to this requirement
      const reqAssets = assets.filter(a => a.requirementId === req.id);

      // Check required presence
      if (req.isRequired && reqAssets.length < req.minimumFiles) {
        missing.push(req.name);
        continue;
      }

      if (reqAssets.length === 0) {
        continue; // Optional and omitted, which is fine
      }

      if (req.isRequired && reqAssets.length >= req.minimumFiles) {
        completedRequiredCount++;
      }

      // Validate each asset against the requirement constraints
      for (const asset of reqAssets) {
        // Enforce max files
        if (reqAssets.length > req.maximumFiles) {
          errors.push(`${req.name}: Too many files uploaded (Max ${req.maximumFiles})`);
        }

        // Enforce max size for files
        if (req.assetType === 'FILE' || req.assetType === 'VIDEO' || req.assetType === 'IMAGE') {
           const sizeMb = asset.metadata?.sizeMb || 0;
           if (req.maxSizeMb && sizeMb > req.maxSizeMb) {
             errors.push(`${req.name}: File exceeds size limit of ${req.maxSizeMb}MB`);
           }
           
           const mime = asset.metadata?.mimeType || '';
           if (req.acceptedFileTypes && !req.acceptedFileTypes.includes(mime) && mime !== '') {
             errors.push(`${req.name}: Invalid file type (${mime})`);
           }
        }

        // Regex validation for text/urls
        if (req.validationRegex && (asset.textValue || asset.urlValue)) {
           const val = asset.textValue || asset.urlValue || "";
           const regex = new RegExp(req.validationRegex);
           if (!regex.test(val)) {
             errors.push(`${req.name}: Format is invalid`);
           }
        }
      }

      if (reqAssets.length > 0 && errors.filter(e => e.startsWith(req.name)).length === 0) {
        passed.push(req.name);
      }
    }

    const progress = requiredCount === 0 ? 100 : Math.round((completedRequiredCount / requiredCount) * 100);
    const isReady = missing.length === 0 && errors.length === 0;

    return {
      isReady,
      progress,
      missing,
      passed,
      warnings,
      errors
    };
  }
}
