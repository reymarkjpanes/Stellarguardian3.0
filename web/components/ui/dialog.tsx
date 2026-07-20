import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = ({ children, ...props }: any) => <div {...props}>{children}</div>
const DialogTrigger = ({ children, ...props }: any) => <button {...props}>{children}</button>
const DialogContent = ({ children, ...props }: any) => <div className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm", props.className)} {...props}>{children}</div>
const DialogHeader = ({ children, ...props }: any) => <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", props.className)} {...props}>{children}</div>
const DialogFooter = ({ children, ...props }: any) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", props.className)} {...props}>{children}</div>
const DialogTitle = ({ children, ...props }: any) => <h2 className={cn("text-lg font-semibold leading-none tracking-tight", props.className)} {...props}>{children}</h2>
const DialogDescription = ({ children, ...props }: any) => <p className={cn("text-sm text-muted-foreground", props.className)} {...props}>{children}</p>

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
