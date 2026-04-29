import { useState } from 'react'
import { Dialog } from '../../components/primitives/Dialog'
import { ConfirmDialog } from '../../components/primitives/ConfirmDialog'

export function SyncView() {
  const [showDialog, setShowDialog] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSync = () => {
    setShowConfirm(true)
  }

  const handleConfirmSync = () => {
    // Perform sync operation
    setShowDialog(true)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Sync</h1>
      <p className="text-text-secondary">Sync documentation across vendors.</p>

      <button
        onClick={handleSync}
        className="px-4 py-2 rounded bg-accent text-white hover:bg-accent/90"
      >
        Start Sync
      </button>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Sync"
        description="This will sync documentation for all vendors. Continue?"
        onConfirm={handleConfirmSync}
        confirmText="Start"
        cancelText="Cancel"
      />

      <Dialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="Sync Complete"
        description="Documentation sync completed successfully."
      >
        <button
          onClick={() => setShowDialog(false)}
          className="px-4 py-2 rounded bg-accent text-white hover:bg-accent/90"
        >
          Done
        </button>
      </Dialog>
    </div>
  )
}
