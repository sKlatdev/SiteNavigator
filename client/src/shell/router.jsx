import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '/',
        lazy: async () => {
          const { DashboardView } = await import('../features/dashboard/DashboardView')
          return { Component: DashboardView }
        },
      },
      {
        path: '/audit',
        lazy: async () => {
          const { AuditView } = await import('../features/audit/AuditView')
          return { Component: AuditView }
        },
      },
      {
        path: '/checklist',
        lazy: async () => {
          const { ChecklistView } = await import('../features/checklist/ChecklistView')
          return { Component: ChecklistView }
        },
      },
      {
        path: '/watchlist',
        lazy: async () => {
          const { WatchlistView } = await import('../features/watchlist/WatchlistView')
          return { Component: WatchlistView }
        },
      },
      {
        path: '/gap',
        lazy: async () => {
          const { GapView } = await import('../features/gap/GapView')
          return { Component: GapView }
        },
      },
      {
        path: '/evidence',
        lazy: async () => {
          const { EvidenceView } = await import('../features/evidence/EvidenceView')
          return { Component: EvidenceView }
        },
      },
      {
        path: '/customers',
        lazy: async () => {
          const { CustomersView } = await import('../features/customers/CustomersView')
          return { Component: CustomersView }
        },
      },
      {
        path: '/templates',
        lazy: async () => {
          const { TemplatesView } = await import('../features/templates/TemplatesView')
          return { Component: TemplatesView }
        },
      },
      {
        path: '/catalog',
        lazy: async () => {
          const { CatalogView } = await import('../features/catalog/CatalogView')
          return { Component: CatalogView }
        },
      },
      {
        path: '/compare',
        lazy: async () => {
          const { CompareView } = await import('../features/compare/CompareView')
          return { Component: CompareView }
        },
      },
      {
        path: '/clone-duo',
        lazy: async () => {
          const { CloneDuoView } = await import('../features/cloneDuo/CloneDuoView')
          return { Component: CloneDuoView }
        },
      },
      {
        path: '/sync',
        lazy: async () => {
          const { SyncView } = await import('../features/sync/SyncView')
          return { Component: SyncView }
        },
      },
      {
        path: '/settings',
        lazy: async () => {
          const { SettingsView } = await import('../features/settings/SettingsView')
          return { Component: SettingsView }
        },
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

function ErrorBoundary() {
  return (
    <div className="rounded-container bg-critical/10 border border-critical p-6">
      <h1 className="text-lg font-semibold text-critical">Something went wrong</h1>
      <p className="mt-2 text-text-secondary">Please try refreshing the page.</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="rounded-container bg-bg-panel p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-text-secondary">The page you are looking for does not exist.</p>
    </div>
  )
}
