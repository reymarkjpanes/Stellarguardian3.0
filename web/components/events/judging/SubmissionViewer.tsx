import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, GitBranch, MonitorPlay, FileText } from 'lucide-react';

interface SubmissionViewerProps {
  submission: {
    id: string;
    title: string;
    tagline?: string;
    description?: string;
    repoUrl?: string;
    demoUrl?: string;
    videoUrl?: string;
  };
}

export function SubmissionViewer({ submission }: SubmissionViewerProps) {
  // Try to determine if demoUrl is embeddable. Usually we won't know until it fails, 
  // but we can assume we try to embed it if present, with a fallback link.
  const hasDemo = !!submission.demoUrl;

  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-y-auto relative">
      {/* Header */}
      <div className="p-6 border-b bg-background sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">{submission.title}</h1>
        {submission.tagline && (
          <p className="text-muted-foreground mt-1 text-lg">{submission.tagline}</p>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {submission.repoUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={submission.repoUrl} target="_blank" rel="noreferrer">
                <GitBranch className="w-4 h-4 mr-2" />
                Repository
              </a>
            </Button>
          )}
          {submission.demoUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={submission.demoUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Demo in New Tab
              </a>
            </Button>
          )}
          {submission.videoUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={submission.videoUrl} target="_blank" rel="noreferrer">
                <MonitorPlay className="w-4 h-4 mr-2" />
                Watch Video
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-8">
        {/* Live Preview (if available) */}
        {hasDemo && (
          <Card className="flex flex-col overflow-hidden border bg-background shadow-sm">
            <div className="px-4 py-2 border-b bg-muted/40 font-medium text-sm flex items-center justify-between">
              <span>Live Application Preview</span>
              <a href={submission.demoUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline inline-flex items-center">
                Open <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
            {/* 
              We use an iframe, but if it's blocked by X-Frame-Options, 
              the browser will just show its own error inside the iframe. 
              The user can still click the link above.
            */}
            <iframe 
              src={submission.demoUrl}
              className="w-full h-[600px] border-0 bg-white"
              title="Live Demo"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </Card>
        )}

        {/* Markdown Description */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Overview</h2>
          </div>
          {submission.description ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {/* In a real app we'd parse Markdown here using react-markdown. 
                  For now, we'll just render text or simple whitespace formatting. */}
              <div className="whitespace-pre-wrap">{submission.description}</div>
            </div>
          ) : (
            <p className="text-muted-foreground italic">No description provided.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
