import re

with open('src/components/ui.tsx', 'r') as f:
    content = f.read()

# 1. Update ButtonProps
content = content.replace(
    "variant?: 'primary' | 'secondary' | 'outline' | 'danger';",
    "variant?: 'primary' | 'secondary' | 'outline' | 'danger'; size?: 'default' | 'sm' | 'lg';"
)

# 2. Update Button component
button_target = """export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {"""
button_replacement = """export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {
            "px-5 py-2 text-sm": size === 'default',
            "px-3 py-1.5 text-xs": size === 'sm',
            "px-6 py-3 text-base": size === 'lg',"""

content = content.replace(button_target, button_replacement)

# 3. Update ConfirmDialog
dialog_target = """export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDangerous = false, isLoading = false }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string, confirmText?: string, isDangerous?: boolean, isLoading?: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant={isDangerous ? "danger" : "primary"} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Processing..." : confirmText}
        </Button>
      </div>
    </Modal>
  );
}"""

dialog_replacement = """export function ConfirmDialog({ children, onConfirm, title, description, message, confirmText = "Confirm", isDangerous = false, isLoading = false }: { children: React.ReactNode, onConfirm: () => void | Promise<void>, title: string, description?: string, message?: string, confirmText?: string, isDangerous?: boolean, isLoading?: boolean }) {
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
}"""

content = content.replace(dialog_target, dialog_replacement)

with open('src/components/ui.tsx', 'w') as f:
    f.write(content)

