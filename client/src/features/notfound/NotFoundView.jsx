import { Link } from 'react-router-dom'

export function NotFoundView() {
  return (
    <div className="rounded-container bg-bg-panel p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-text-secondary">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-accent hover:underline">Return to Dashboard</Link>
    </div>
  )
}
