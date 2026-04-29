import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

// Placeholder components for Phase 2 view extraction
const PlaceholderPage = ({ name }) => (
  <div className="rounded-container bg-bg-panel p-6">
    <h1 className="text-2xl font-semibold text-text-primary">{name}</h1>
    <p className="mt-2 text-text-secondary">This page will be implemented in Phase 2.</p>
  </div>
)

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '/',
        lazy: async () => {
          const { Dashboard } = await import('../features/Dashboard')
          return { Component: Dashboard }
        },
      },
      {
        path: '/audit',
        element: <PlaceholderPage name="Audit" />,
      },
      {
        path: '/checklist',
        element: <PlaceholderPage name="Checklist" />,
      },
      {
        path: '/watchlist',
        element: <PlaceholderPage name="Watchlist" />,
      },
      {
        path: '/gap',
        element: <PlaceholderPage name="Gap Analysis" />,
      },
      {
        path: '/evidence',
        element: <PlaceholderPage name="Evidence" />,
      },
      {
        path: '/customers',
        element: <PlaceholderPage name="Customers" />,
      },
      {
        path: '/templates',
        element: <PlaceholderPage name="Templates" />,
      },
      {
        path: '/catalog',
        element: <PlaceholderPage name="Catalog" />,
      },
      {
        path: '/compare',
        element: <PlaceholderPage name="Compare" />,
      },
      {
        path: '/sync',
        element: <PlaceholderPage name="Sync" />,
      },
      {
        path: '/clone-duo',
        element: <PlaceholderPage name="Clone Duo" />,
      },
      {
        path: '/settings',
        element: <PlaceholderPage name="Settings" />,
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
