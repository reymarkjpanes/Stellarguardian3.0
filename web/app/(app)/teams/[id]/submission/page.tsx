"use client";

import React from "react";
import { SubmissionHubLayout } from "@/src/domains/submissions/components/SubmissionHubLayout";

export default function SubmissionPage({ params }: { params: { id: string } }) {
  // In a real app, we'd fetch the team/event info from a server component and pass it down,
  // or fetch it via a hook here. For this demo, we mock the top-level context.
  
  return (
    <SubmissionHubLayout 
      eventId="00000000-0000-0000-0000-000000000000" // Mock event ID for demo
      teamId={params.id}
      teamName="Team Alpha"
      eventName="Stellar Guardian 3.0"
      deadline={new Date(Date.now() + 4 * 60 * 60 * 1000 + 12 * 60 * 1000)} // 4h 12m from now
    />
  );
}
