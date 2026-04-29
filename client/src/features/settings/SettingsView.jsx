import { useState } from 'react'
import { ConfirmDialog } from '../../components/primitives/ConfirmDialog'

export function SettingsView() {
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearCache = () => {
    setShowClearConfirm(true)
  }

  const handleConfirmClear = () => {
    // Clear cache operation
    console.log('Cache cleared')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="text-text-secondary">Manage application settings.</p>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Cache Management</h2>
        <button
          onClick={handleClearCache}
          className="px-4 py-2 rounded bg-critical/10 text-critical hover:bg-critical/20"
        >
          Clear Cache
        </button>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear Cache"
        description="This will permanently delete all cached data. This action cannot be undone."
        onConfirm={handleConfirmClear}
        confirmText="Clear Cache"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  )
}
