import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant: _variant = "default",
      size: _size = "default",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const variantClasses = {
      default: "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] shadow-sm",
      destructive: "bg-[var(--error)] text-white hover:bg-[color-mix(in_srgb,var(--error)_80%,black)] shadow-sm",
      outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--bg-muted)] text-[var(--text)]",
      secondary: "bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border-muted)]",
      ghost: "hover:bg-[var(--bg-muted)] text-[var(--text)] hover:text-[var(--text)]",
      link: "text-[var(--accent)] underline-offset-4 hover:underline",
    };

    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };

    const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const finalClasses = cn(
      baseClasses,
      variantClasses[_variant || "default"],
      sizeClasses[_size || "default"],
      className
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return React.cloneElement(child, {
        ...child.props,
        ...props,
        className: cn(finalClasses, child.props.className),
      });
    }
    return (
      <button
        className={finalClasses}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
