import React from "react";
import { SubmissionHeader } from "./SubmissionHeader";
import { ProgressiveChecklist } from "./ProgressiveChecklist";
import { ValidationPanel } from "./ValidationPanel";
import { SubmissionActivityTimeline } from "./SubmissionActivityTimeline";
import { useSubmissionController } from "../hooks/useSubmissionController";

export function SubmissionHubLayout({ eventId, teamId, teamName, eventName, deadline }: any) {
  const {
    hubData,
    isLoadingHub,
    validationResult,
    connectionStatus,
    saveAsset,
    uploadAsset,
    submit,
    isSubmitting
  } = useSubmissionController(eventId, teamId);

  if (isLoadingHub) {
    return <div className="p-12 text-center text-gray-500">Loading Submission Hub...</div>;
  }

  // Fallbacks if data is missing
  const requirements = hubData?.requirements || [];
  const assets = hubData?.assets || [];
  const version = hubData?.submission?.version || 1;
  const status = hubData?.submission?.status || "NOT_STARTED";
  
  // Mock timeline activities for now, in a real app would be fetched via CQRS query
  const activities = [
    { id: "1", action: "DRAFT_UPDATED", details: "Pitch Deck updated", created_at: new Date().toISOString() },
    { id: "2", action: "ASSET_UPLOADED", details: "Demo Video uploaded", created_at: new Date(Date.now() - 60000).toISOString() }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <SubmissionHeader 
        teamName={teamName}
        eventName={eventName}
        status={connectionStatus}
        version={version}
        deadline={deadline}
      />
      
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {status === "SUBMITTED" || status === "LOCKED" ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center mb-8">
             <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
               <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
               </svg>
             </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Submitted!</h2>
             <p className="text-gray-600">Your project has been successfully submitted and is locked for review. Good luck!</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Checklist Column */}
          <div className="lg:col-span-8 space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Project Requirements</h2>
              <ProgressiveChecklist 
                requirements={requirements}
                assets={assets}
                onSave={saveAsset}
                onUpload={uploadAsset}
              />
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Activity</h3>
              <SubmissionActivityTimeline activities={activities} />
            </div>
          </div>

          {/* Sidebar Validation Panel */}
          <div className="lg:col-span-4">
            <ValidationPanel 
              validationResult={validationResult}
              onSubmit={submit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
