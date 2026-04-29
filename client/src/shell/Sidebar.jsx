import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { navConfig } from './navConfig'

export function Sidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path) => {
    return currentPath === path || currentPath.startsWith(path + '/')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] flex flex-col bg-bg-base border-r border-border-subtle">
      {/* Brand Block */}
      <div className="px-6 py-6 border-b border-border-subtle">
        <h1 className="text-lg font-semibold text-text-primary">SiteNav</h1>
        <p className="text-xs text-text-tertiary mt-1">Intelligence Platform</p>
      </div>

      {/* Workspace Section */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="space-y-1">
          {navConfig.workspace.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.path}
                title={item.description}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-control transition-colors duration-motion-fast',
                  isActive(item.path)
                    ? 'nav-item-active bg-accent text-black'
                    : 'nav-item text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                )}
              >
                <Icon size={18} />
                <span className="text-sm font-medium truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Vendors Section */}
        <div className="mt-6 pt-4 border-t border-border-subtle">
          <p className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
            Vendors
          </p>
          <div className="space-y-1">
            {navConfig.vendors.map((vendor) => (
              <Link
                key={vendor.id}
                to={vendor.path}
                className={clsx(
                  'block px-3 py-2 rounded-control text-sm transition-colors duration-motion-fast',
                  isActive(vendor.path)
                    ? 'nav-item-active bg-accent text-black'
                    : 'nav-item text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                )}
              >
                {vendor.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div className="mt-6 pt-4 border-t border-border-subtle">
          <p className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
            Tools
          </p>
          <div className="space-y-1">
            {navConfig.settings.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  title={item.description}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-control transition-colors duration-motion-fast',
                    isActive(item.path)
                      ? 'nav-item-active bg-accent text-black'
                      : 'nav-item text-text-secondary hover:text-text-primary hover:bg-bg-panel'
                  )}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </aside>
  )
}
