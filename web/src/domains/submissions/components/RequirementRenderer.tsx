import React, { useState } from "react";
import { Dropzone } from "./Dropzone";

/** Shape of a requirement row from the DB (snake_case) */
export interface RequirementRow {
  id: string;
  name: string;
  description?: string;
  asset_type: "TEXT" | "MARKDOWN" | "URL" | "REPOSITORY" | "FILE" | "VIDEO" | "IMAGE" | "PDF";
  is_required: boolean;
  placeholder?: string;
  help_text?: string;
  accepted_file_types?: string;
  max_size_mb?: number;
}

/** Shape of an asset row from the DB (snake_case) */
export interface AssetRow {
  id: string;
  requirement_id: string;
  text_value?: string;
  url_value?: string;
  storage_path?: string;
  metadata?: {
    filename?: string;
    sizeMb?: number;
    mimeType?: string;
  };
}

/** Payload passed to onSave */
export interface AssetSaveData {
  assetType: string;
  textValue?: string;
  urlValue?: string;
}

interface RequirementProps {
  requirement: RequirementRow;
  asset: AssetRow | undefined;
  onSave: (reqId: string, assetData: AssetSaveData) => void;
  onUpload?: (reqId: string, file: File, onProgress: (p: number) => void) => Promise<void>;
}

export function TextRequirement({ requirement, asset, onSave }: RequirementProps) {
  // Use defaultValue + key pattern: when asset identity changes the component
  // re-mounts (key changes) which resets the input without needing useEffect setState.
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSave(requirement.id, { assetType: "TEXT", textValue: e.target.value });
  };

  return (
    <div className="w-full">
      <textarea
        key={asset?.id ?? "empty"}
        className="w-full border border-gray-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm sm:text-sm"
        rows={4}
        placeholder={requirement.placeholder ?? "Enter text..."}
        defaultValue={asset?.text_value ?? ""}
        onChange={handleChange}
      />
      {requirement.help_text && (
        <p className="mt-2 text-sm text-gray-500">{requirement.help_text}</p>
      )}
    </div>
  );
}

export function URLRequirement({ requirement, asset, onSave }: RequirementProps) {
  // key prop resets the uncontrolled input when asset identity changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSave(requirement.id, { assetType: "URL", urlValue: e.target.value });
  };

  return (
    <div className="w-full">
      <input
        key={asset?.id ?? "empty"}
        type="url"
        className="w-full border border-gray-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm sm:text-sm"
        placeholder={requirement.placeholder ?? "https://..."}
        defaultValue={asset?.url_value ?? ""}
        onChange={handleChange}
      />
      {requirement.help_text && (
        <p className="mt-2 text-sm text-gray-500">{requirement.help_text}</p>
      )}
    </div>
  );
}

export function FileRequirement({ requirement, asset, onUpload }: RequirementProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (file: File) => {
    if (!onUpload) return;
    setIsUploading(true);
    setProgress(0);
    try {
      await onUpload(requirement.id, file, (p) => setProgress(p));
    } catch (err) {
      console.error(err);
      // Let parent handle error toast
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      {asset?.storage_path ? (
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {asset.metadata?.filename ?? "Uploaded File"}
              </p>
              <p className="text-xs text-gray-500">{(asset.metadata?.sizeMb ?? 0).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            className="text-sm text-red-600 hover:text-red-800"
            onClick={() => alert("Delete not implemented in this demo")}
          >
            Remove
          </button>
        </div>
      ) : (
        <Dropzone
          onFileSelect={handleFileSelect}
          acceptedTypes={requirement.accepted_file_types}
          maxSizeMb={requirement.max_size_mb}
          isUploading={isUploading}
          uploadProgress={progress}
        />
      )}
      {requirement.help_text && (
        <p className="mt-2 text-sm text-gray-500">{requirement.help_text}</p>
      )}
    </div>
  );
}

export function RequirementRenderer(props: RequirementProps) {
  const { requirement } = props;

  switch (requirement.asset_type) {
    case "TEXT":
    case "MARKDOWN":
      return <TextRequirement {...props} />;
    case "URL":
    case "REPOSITORY":
      return <URLRequirement {...props} />;
    case "FILE":
    case "VIDEO":
    case "IMAGE":
    case "PDF":
      return <FileRequirement {...props} />;
    default:
      return (
        <p className="text-sm text-red-500">
          Unsupported requirement type: {requirement.asset_type}
        </p>
      );
  }
}
