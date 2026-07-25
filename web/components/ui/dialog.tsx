import * as React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;
type ParaProps = React.HTMLAttributes<HTMLParagraphElement>;

const Dialog = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;
const DialogTrigger = ({ children, ...props }: ButtonProps) => (
  <button {...props}>{children}</button>
);
const DialogContent = ({ children, className, ...props }: DivProps) => (
  <div className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm", className)} {...props}>
    {children}
  </div>
);
const DialogHeader = ({ children, className, ...props }: DivProps) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props}>
    {children}
  </div>
);
const DialogFooter = ({ children, className, ...props }: DivProps) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  >
    {children}
  </div>
);
const DialogTitle = ({ children, className, ...props }: HeadingProps) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>
    {children}
  </h2>
);
const DialogDescription = ({ children, className, ...props }: ParaProps) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </p>
);

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
