"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({ value: "", onValueChange: () => {} })

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
  }
>(({ className, defaultValue, value, onValueChange, ...props }, ref) => {
  const [tab, setTab] = React.useState(defaultValue || "")
  const currentValue = value !== undefined ? value : tab
  const handleValueChange = React.useCallback(
    (v: string) => {
      if (value === undefined) setTab(v)
      onValueChange?.(v)
    },
    [value, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div ref={ref} className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-[var(--bg-muted)] p-1 text-[var(--text-muted)]",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext)
  const isSelected = context.value === value
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-[var(--bg)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected && "bg-[var(--bg)] text-[var(--text)] shadow-sm",
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext)
  if (context.value !== value) return null
  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn(
        "mt-2 ring-offset-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
