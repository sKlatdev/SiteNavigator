import * as RadixDialog from '@radix-ui/react-dialog'
import { forwardRef } from 'react'

export const Dialog = forwardRef(function Dialog(
  { open, onOpenChange, title, description, children, ...props },
  ref
) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/40" />
        <RadixDialog.Content
          ref={ref}
          className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-container bg-bg-panel p-6 shadow-lg"
          {...props}
        >
          {title && (
            <RadixDialog.Title className="text-xl font-semibold text-text-primary">
              {title}
            </RadixDialog.Title>
          )}
          {description && (
            <RadixDialog.Description className="mt-2 text-text-secondary">
              {description}
            </RadixDialog.Description>
          )}
          <div className="mt-6">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
})

Dialog.displayName = 'Dialog'
