"use client";

import * as React from "react";

type ToastType = "default" | "success" | "error" | "warning";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((props: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, ...props }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all mb-4
              ${t.type === "error" ? "bg-red-600 text-white border-red-700" : ""}
              ${t.type === "success" ? "bg-green-600 text-white border-green-700" : ""}
              ${t.type === "warning" ? "bg-amber-500 text-white border-amber-600" : ""}
              ${!t.type || t.type === "default" ? "bg-white text-gray-900 border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" : ""}
            `}
          >
            <div className="grid gap-1">
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              {t.description && <div className="text-sm opacity-90">{t.description}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 rounded-md p-1 opacity-50 hover:opacity-100 focus:opacity-100 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
