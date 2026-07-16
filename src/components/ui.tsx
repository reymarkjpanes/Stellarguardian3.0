import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'; size?: 'default' | 'sm' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {
            "px-5 py-2 text-sm": size === 'default',
            "px-3 py-1.5 text-xs": size === 'sm',
            "px-6 py-3 text-base": size === 'lg',
            "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500": variant === 'primary',
            "bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-500": variant === 'secondary',
            "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-900": variant === 'outline',
            "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500": variant === 'danger',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6 pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center", className)} {...props}>
      {children}
    </div>
  );
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'neutral';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-indigo-100 text-indigo-700": variant === 'default',
          "bg-emerald-100 text-emerald-700": variant === 'success',
          "bg-amber-100 text-amber-700": variant === 'warning',
          "bg-red-100 text-red-700": variant === 'error',
          "bg-slate-100 text-slate-700": variant === 'neutral',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-200/60", className)} {...props} />
  );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" role="dialog" aria-modal="true">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ children, onConfirm, title, description, message, confirmText = "Confirm", isDangerous = false, isLoading = false }: { children: React.ReactNode, onConfirm: () => void | Promise<void>, title: string, description?: string, message?: string, confirmText?: string, isDangerous?: boolean, isLoading?: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleConfirm = async () => {
    await onConfirm();
    setIsOpen(false);
  };
  return (
    <>
      <div className="inline-block" onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title}>
        <p className="text-slate-600 mb-6">{description || message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancel</Button>
          <Button variant={isDangerous ? "danger" : "primary"} onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string, error?: string }>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all min-h-[120px]",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, error?: string }>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  className 
}: { 
  icon?: any, 
  title: string, 
  description?: string, 
  action?: React.ReactNode, 
  className?: string 
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 border-dashed rounded-xl", className)}>
      {Icon && <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4"><Icon className="w-6 h-6" /></div>}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}

export function ConfirmationModal({ children, onConfirm, title, description, confirmText = "Confirm", isDangerous = false, isLoading = false }: { children: React.ReactNode, onConfirm: () => void | Promise<void>, title: string, description?: string, confirmText?: string, isDangerous?: boolean, isLoading?: boolean }) {
  return (
    <ConfirmDialog
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmText={confirmText}
      isDangerous={isDangerous}
      isLoading={isLoading}
    >
      {children}
    </ConfirmDialog>
  );
}
