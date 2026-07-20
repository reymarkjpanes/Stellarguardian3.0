import { ReactNode } from 'react';

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  // A clean, full-bleed layout maximizing screen space for judging
  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      {/* We can place a minimalist workspace header here if desired */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
