"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrizeCategoryManager } from "./PrizeCategoryManager";
import { PrizeAllocationBoard } from "./PrizeAllocationBoard";
import { BatchLockPanel, PrizeCategory, PrizeAllocation } from "./BatchLockPanel";

export interface RankingSnapshot {
  id: string;
  submission_id: string;
  ranking: number;
  average_score: number;
  submissions: { title: string };
}

interface Props {
  eventId: string;
  batchId: string;
  batchStatus: string;
  initialCategories: PrizeCategory[];
  snapshots: RankingSnapshot[];
  initialAllocations: PrizeAllocation[];
}

export function OrganizerPrizeDashboardClient({
  eventId,
  batchId,
  batchStatus,
  initialCategories,
  snapshots,
  initialAllocations,
}: Props) {
  const [categories, setCategories] = useState<PrizeCategory[]>(initialCategories);
  const [allocations, setAllocations] = useState<PrizeAllocation[]>(initialAllocations);
  const [status, setStatus] = useState(batchStatus);

  const isLocked = status === "Locked" || status === "Escrowed";

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-muted/20">
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prize Allocation</h2>
          <p className="text-muted-foreground mt-1">
            Define award categories and assign them to the finalized rankings.
          </p>
        </div>

        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList className="bg-background border">
            <TabsTrigger value="categories">1. Categories</TabsTrigger>
            <TabsTrigger value="allocations">2. Allocations</TabsTrigger>
            <TabsTrigger value="lock">3. Review &amp; Lock</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <PrizeCategoryManager
              eventId={eventId}
              categories={categories}
              setCategories={setCategories}
              isLocked={isLocked}
            />
          </TabsContent>

          <TabsContent value="allocations" className="space-y-4">
            <PrizeAllocationBoard
              batchId={batchId}
              categories={categories}
              snapshots={snapshots}
              allocations={allocations}
              setAllocations={setAllocations}
              isLocked={isLocked}
            />
          </TabsContent>

          <TabsContent value="lock" className="space-y-4">
            <BatchLockPanel
              batchId={batchId}
              status={status}
              setStatus={setStatus}
              categories={categories}
              allocations={allocations}
              eventId={eventId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
