import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import clsx from 'clsx'

export function TopBar() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

  // Generate breadcrumb from current path
  const getBreadcrumb = () => {
    const paths = {
      '/': 'Dashboard',
      '/catalog': 'Catalog',
      '/compare': 'Compare',
      '/watchlist': 'Watchlist',
      '/sync': 'Sync',
      '/settings': 'Settings',
      '/audit': 'Audit',
      '/checklist': 'Checklist',
      '/gap': 'Gap Analysis',
      '/evidence': 'Evidence',
      '/customers': 'Customers',
      '/templates': 'Templates',
      '/clone-duo': 'Clone Duo',
    }

    const path = location.pathname
    const label = paths[path] || 'Page'
    return label
  }

  const handleSearch = (e) => {
    e.preventDefault()
    // Search will be implemented in Phase 2 with actual backend integration
    console.log('Search:', searchQuery)
  }

  return (
    <header className="fixed top-0 left-[200px] right-0 h-14 bg-bg-panel border-b border-border-subtle flex items-center justify-between px-6 backdrop-blur-panel">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-2 text-sm">
          <span className="text-text-secondary">SiteNav</span>
          <span className="text-text-tertiary">/</span>
          <span className="text-text-primary font-medium">{getBreadcrumb()}</span>
        </nav>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xs mx-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={clsx(
              'w-full px-3 py-2 rounded-control',
              'bg-bg-base border border-border-subtle',
              'text-text-primary text-sm',
              'placeholder:text-text-tertiary',
              'transition-colors duration-motion-fast',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50'
            )}
          />
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
        </div>
      </form>

      {/* Spacer for future header controls (notifications, profile, etc.) */}
      <div className="w-12" />
    </header>
  )
}
