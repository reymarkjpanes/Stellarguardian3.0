import React, { useState } from "react";
import {
  RequirementRenderer,
  RequirementRow,
  AssetRow,
  AssetSaveData,
} from "./RequirementRenderer";

interface ProgressiveChecklistProps {
  requirements: RequirementRow[];
  assets: AssetRow[];
  onSave: (reqId: string, assetData: AssetSaveData) => void;
  onUpload: (
    reqId: string,
    assetType: string,
    file: File,
    onProgress: (p: number) => void,
  ) => Promise<void | { storagePath: string; publicUrl?: string }>;
  onRemove: (reqId: string) => Promise<void>;
  isLocked?: boolean;
}

export function ProgressiveChecklist({
  requirements,
  assets,
  onSave,
  onUpload,
  onRemove,
  isLocked,
}: ProgressiveChecklistProps) {
  const [expandedId, setExpandedId] = useState<string | null>(requirements[0]?.id ?? null);

  const getAsset = (reqId: string): AssetRow | undefined =>
    assets.find((a) => a.requirement_id === reqId);

  const isComplete = (req: RequirementRow, asset: AssetRow | undefined): boolean => {
    if (!asset) return false;
    if (req.asset_type === "FILE" || req.asset_type === "VIDEO" || req.asset_type === "IMAGE") {
      return !!asset.storage_path;
    }
    return !!(asset.text_value || asset.url_value);
  };

  return (
    <div className="space-y-4">
      {requirements.map((req, idx) => {
        const asset = getAsset(req.id);
        const complete = isComplete(req, asset);
        const isExpanded = expandedId === req.id;

        return (
          <div
            key={req.id}
            className={`border rounded-lg overflow-hidden transition-all duration-200 ${
              isExpanded
                ? "border-indigo-300 ring-1 ring-indigo-300 shadow-md"
                : "border-gray-200 shadow-sm"
            } bg-white`}
          >
            {/* Header (Accordion Toggle) */}
            <button
              type="button"
              className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-gray-50 focus:outline-none"
              onClick={() => setExpandedId(isExpanded ? null : req.id)}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                    complete
                      ? "bg-green-100 border-green-500 text-green-600"
                      : "bg-gray-50 border-gray-300 text-gray-500"
                  }`}
                >
                  {complete ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{idx + 1}</span>
                  )}
                </div>
                <div className="text-left">
                  <h3
                    className={`text-lg font-semibold ${complete ? "text-gray-900" : "text-gray-700"}`}
                  >
                    {req.name}
                    {req.is_required && (
                      <span className="ml-2 text-xs text-red-500 uppercase tracking-wide">
                        Required
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{req.description}</p>
                </div>
              </div>
              <div>
                <svg
                  className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Content Body */}
            {isExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50">
                <RequirementRenderer
                  requirement={req}
                  asset={asset}
                  onSave={isLocked ? () => {} : onSave}
                  onUpload={isLocked ? undefined : onUpload}
                  onRemove={isLocked ? undefined : onRemove}
                  isLocked={isLocked}
                />

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      const nextIdx = idx + 1;
                      const nextReq = requirements[nextIdx];
                      if (nextReq) {
                        setExpandedId(nextReq.id);
                      } else {
                        setExpandedId(null);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save &amp; Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
