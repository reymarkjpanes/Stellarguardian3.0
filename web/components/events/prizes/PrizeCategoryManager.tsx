import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPrizeCategory } from "@/app/actions/prize-allocation.actions";
import type { PrizeCategory } from "./BatchLockPanel";

const TEMPLATES = {
  hackathon: [
    { name: "Grand Prize", prizeType: "Cash", totalAmount: 5000, maxWinners: 1 },
    { name: "Runner-up", prizeType: "Cash", totalAmount: 2000, maxWinners: 1 },
    { name: "Best Innovation", prizeType: "Cash", totalAmount: 1000, maxWinners: 1 },
    { name: "Community Choice", prizeType: "Token", totalAmount: 500, maxWinners: 1 },
  ],
  research: [
    { name: "Best Paper", prizeType: "Cash", totalAmount: 10000, maxWinners: 1 },
    { name: "Outstanding Research", prizeType: "Cash", totalAmount: 3000, maxWinners: 2 },
  ],
} as const;

interface PrizeCategoryManagerProps {
  eventId: string;
  categories: PrizeCategory[];
  setCategories: (cats: PrizeCategory[]) => void;
  isLocked: boolean;
}

export function PrizeCategoryManager({
  eventId,
  categories,
  setCategories,
  isLocked,
}: PrizeCategoryManagerProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    prizeType: "Cash",
    totalAmount: "",
    maxWinners: "1",
  });

  const handleApplyTemplate = async (templateKey: keyof typeof TEMPLATES) => {
    if (isLocked) return;
    setLoading(true);
    try {
      const template = TEMPLATES[templateKey];
      const newCats: PrizeCategory[] = [];
      for (const t of template) {
        const cat = await createPrizeCategory({
          eventId,
          name: t.name,
          description: "",
          prizeType: t.prizeType,
          totalAmount: t.totalAmount,
          maxWinners: t.maxWinners,
          currency: "USD",
        });
        newCats.push(cat as PrizeCategory);
      }
      setCategories([...categories, ...newCats]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error applying template: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (isLocked) return;
    setLoading(true);
    try {
      const cat = await createPrizeCategory({
        eventId,
        name: form.name,
        description: "",
        prizeType: form.prizeType,
        totalAmount: Number(form.totalAmount),
        maxWinners: Number(form.maxWinners),
        currency: "USD",
      });
      setCategories([...categories, cat as PrizeCategory]);
      setForm({ name: "", prizeType: "Cash", totalAmount: "", maxWinners: "1" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error creating category: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => void handleApplyTemplate("hackathon")}
          disabled={loading || isLocked}
        >
          Apply Hackathon Template
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleApplyTemplate("research")}
          disabled={loading || isLocked}
        >
          Apply Research Template
        </Button>
      </div>

      <div className="card p-6 bg-background space-y-4">
        <h3 className="font-semibold">Create Custom Category</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Category Name</label>
            <Input
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, name: e.target.value })
              }
              disabled={isLocked}
            />
          </div>
          <div className="w-32 space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.prizeType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setForm({ ...form, prizeType: e.target.value })
              }
              disabled={isLocked}
            >
              <option value="Cash">Cash</option>
              <option value="Token">Token</option>
              <option value="NFT">NFT</option>
              <option value="Physical">Physical</option>
            </select>
          </div>
          <div className="w-32 space-y-2">
            <label className="text-sm font-medium">Total Amount</label>
            <Input
              type="number"
              value={form.totalAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, totalAmount: e.target.value })
              }
              disabled={isLocked}
            />
          </div>
          <div className="w-32 space-y-2">
            <label className="text-sm font-medium">Max Winners</label>
            <Input
              type="number"
              value={form.maxWinners}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, maxWinners: e.target.value })
              }
              disabled={isLocked}
            />
          </div>
          <Button
            onClick={() => void handleCreate()}
            disabled={loading || isLocked || !form.name || !form.totalAmount}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Current Categories</h3>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No categories defined yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="card p-4 bg-background">
                <h4 className="font-semibold text-lg">{c.name}</h4>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>Type: {c.prize_type}</p>
                  <p>
                    Total Budget: {c.currency} {c.total_amount}
                  </p>
                  <p>Max Winners: {c.max_winners}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
