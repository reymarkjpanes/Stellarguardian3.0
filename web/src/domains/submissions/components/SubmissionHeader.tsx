import React from "react";
import { ConnectionStatus } from "../hooks/useSubmissionController";

interface SubmissionHeaderProps {
  teamName: string;
  eventName: string;
  status: ConnectionStatus;
  version: number;
  deadline: Date;
}

export function SubmissionHeader({ teamName, eventName, status, version, deadline }: SubmissionHeaderProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "SAVING": return <span className="text-amber-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Saving...</span>;
      case "SAVED": return <span className="text-green-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Saved to cloud</span>;
      case "OFFLINE": return <span className="text-gray-500 flex items-center gap-1">Offline - Changes queued</span>;
      case "ERROR": return <span className="text-red-500 flex items-center gap-1">Sync Error</span>;
      default: return <span className="text-gray-500">Ready</span>;
    }
  };

  const getTimeLeft = () => {
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return "Deadline passed";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-gray-900">{teamName}</h1>
        <p className="text-sm text-gray-500">Submitting to {eventName}</p>
      </div>
      
      <div className="flex items-center gap-6 text-sm font-medium">
        <div className="hidden md:flex items-center gap-2">
          {getStatusBadge()}
        </div>
        <div className="text-gray-400">
          v{version}
        </div>
        <div className="bg-gray-100 px-3 py-1 rounded-md text-gray-700 font-mono">
          {getTimeLeft()}
        </div>
      </div>
    </div>
  );
}
