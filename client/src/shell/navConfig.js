import { Home, BookOpen, GitCompare, AlertCircle, Settings } from 'lucide-react'

export const navConfig = {
  // Workspace section: main features
  workspace: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: Home,
      description: 'Overview and recent activity',
    },
    {
      id: 'catalog',
      label: 'Catalog',
      path: '/catalog',
      icon: BookOpen,
      description: 'Browse all documentation',
    },
    {
      id: 'compare',
      label: 'Compare',
      path: '/compare',
      icon: GitCompare,
      description: 'Side-by-side documentation comparison',
    },
  ],

  // Vendors: scope selection for content queries
  vendors: [
    { id: 'duo', label: 'Duo', path: '/catalog?vendor=duo' },
    { id: 'okta', label: 'Okta', path: '/catalog?vendor=okta' },
    { id: 'entra', label: 'Entra ID', path: '/catalog?vendor=entra' },
    { id: 'pingidentity', label: 'Ping Identity', path: '/catalog?vendor=pingidentity' },
  ],

  // Settings section: configuration and utilities
  settings: [
    {
      id: 'watchlist',
      label: 'Watchlist',
      path: '/watchlist',
      icon: AlertCircle,
      description: 'Tracked topics and notifications',
    },
    {
      id: 'sync',
      label: 'Sync',
      path: '/sync',
      icon: AlertCircle,
      description: 'Documentation synchronization status',
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      description: 'Application preferences',
    },
  ],
}
