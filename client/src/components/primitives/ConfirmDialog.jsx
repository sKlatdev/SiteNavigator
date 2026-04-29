import { Dialog } from './Dialog'
import { forwardRef } from 'react'

export const ConfirmDialog = forwardRef(function ConfirmDialog(
  {
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    ...props
  },
  ref
) {
  const confirmButtonClass =
    variant === 'destructive'
      ? 'bg-critical text-white hover:bg-critical/90'
      : 'bg-accent text-white hover:bg-accent/90'

  return (
    <Dialog
      ref={ref}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      {...props}
    >
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => {
            onCancel?.()
            onOpenChange(false)
          }}
          className="px-4 py-2 rounded border border-border text-text-primary hover:bg-bg-panel/50"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm?.()
            onOpenChange(false)
          }}
          className={`px-4 py-2 rounded font-medium transition-colors ${confirmButtonClass}`}
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  )
})

ConfirmDialog.displayName = 'ConfirmDialog'
