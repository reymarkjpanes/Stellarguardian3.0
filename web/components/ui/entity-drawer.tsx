"use client";

import { ReactNode } from "react";
// In a real implementation using shadcn/ui:
// import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export interface EntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function EntityDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
  children,
  tabs,
  activeTab,
  onTabChange
}: EntityDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-100"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg lg:max-w-xl border-l bg-background shadow-lg transition ease-in-out duration-300 transform"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-4 p-6 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              <button 
                onClick={onClose} 
                className="rounded-full p-2 hover:bg-muted transition-colors"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>

          {/* Optional Tabs */}
          {tabs && tabs.length > 0 && (
            <div className="flex px-6 border-b overflow-x-auto hide-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
