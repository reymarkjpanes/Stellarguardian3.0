import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Filter } from "lucide-react";

export interface LiveRankingData {
  submission_id: string;
  title: string;
  judge_count: number;
  average_score: number | null;
}

export function RankingPreviewTable({
  rankings,
  onSelect,
  isLoading = false,
}: {
  rankings: LiveRankingData[];
  onSelect: (submissionId: string) => void;
  isLoading?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTies, setFilterTies] = useState(false);

  const processedRankings = useMemo(() => {
    let result = [...rankings];

    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(lowerSearch));
    }

    // Ties filter
    if (filterTies) {
      result = result.filter((r, idx, arr) => {
        const prev = arr[idx - 1];
        const next = arr[idx + 1];
        const isTiedWithPrev =
          prev && prev.average_score === r.average_score && r.average_score !== null;
        const isTiedWithNext =
          next && next.average_score === r.average_score && r.average_score !== null;
        return isTiedWithPrev || isTiedWithNext;
      });
    }

    return result;
  }, [rankings, searchTerm, filterTies]);

  const handleExportCSV = () => {
    if (processedRankings.length === 0) return;
    const headers = ["Rank", "Submission", "Judges", "Avg Score"];
    const csvContent = [
      headers.join(","),
      ...processedRankings.map(
        (r, i) =>
          `"${i + 1}","${r.title.replace(/"/g, '""')}","${r.judge_count}","${r.average_score ?? ""}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "leaderboard_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/20 p-3 rounded-lg border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search submissions..."
            className="pl-8 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant={filterTies ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTies(!filterTies)}
            className="flex-1 sm:flex-none"
          >
            <Filter className="h-4 w-4 mr-2" />
            {filterTies ? "Showing Ties" : "Show Ties"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={processedRankings.length === 0}
            className="flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-background relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Submission</TableHead>
              <TableHead className="text-right">Judges</TableHead>
              <TableHead className="text-right">Avg Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedRankings.map((r, index) => {
              const isTied =
                index > 0 &&
                processedRankings[index - 1]?.average_score === r.average_score &&
                r.average_score !== null;

              return (
                <TableRow
                  key={r.submission_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelect(r.submission_id)}
                >
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell>
                    {r.title}
                    {isTied && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                        Unresolved Tie
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-muted text-xs font-medium">
                      {r.judge_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {r.average_score !== null ? Number(r.average_score).toFixed(2) : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
            {processedRankings.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  {searchTerm || filterTies
                    ? "No submissions match your filters."
                    : "No submitted evaluations yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
