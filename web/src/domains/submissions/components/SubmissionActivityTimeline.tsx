import React from "react";

interface Activity {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

interface TimelineProps {
  activities: Activity[];
}

export function SubmissionActivityTimeline({ activities }: TimelineProps) {
  if (!activities || activities.length === 0) {
    return <p className="text-sm text-gray-500">No activity yet.</p>;
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getIcon = (action: string) => {
    switch(action) {
      case "DRAFT_UPDATED":
      case "ASSET_UPLOADED":
        return (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        );
      case "SUBMITTED":
        return (
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          </div>
        );
    }
  };

  const getTitle = (action: string) => {
    switch(action) {
      case "DRAFT_UPDATED": return "Auto Saved";
      case "ASSET_UPLOADED": return "File Uploaded";
      case "SUBMITTED": return "Submitted";
      case "VALIDATION_PASSED": return "Validation Passed";
      default: return action;
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, idx) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {idx !== activities.length - 1 ? (
                <span className="absolute top-3 left-3 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
              ) : null}
              <div className="relative flex items-start space-x-3">
                {getIcon(activity.action)}
                <div className="min-w-0 flex-1 pt-0.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">{getTitle(activity.action)}</p>
                    {activity.details && <p className="text-xs text-gray-500 mt-0.5">{activity.details}</p>}
                  </div>
                  <div className="text-right text-xs whitespace-nowrap text-gray-500">
                    <time dateTime={activity.created_at}>{formatTime(activity.created_at)}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
