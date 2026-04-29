import { createContext, useContext, useState, useEffect } from 'react'

// Four narrow contexts — one per concern
const SyncContext = createContext()
const IndexedContentContext = createContext()
const CustomersTemplatesContext = createContext()
const UIContext = createContext()

export function AppDataProvider({ children }) {
  // SyncContext state
  const [syncState, setSyncState] = useState('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncEngine, setSyncEngine] = useState('auto')

  // IndexedContentContext state
  const [indexedContent, setIndexedContent] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [facets, setFacets] = useState({})

  // CustomersTemplatesContext state
  const [customers, setCustomers] = useState([])
  const [templates, setTemplates] = useState([])
  const [audit, setAudit] = useState([])
  const [checklist, setChecklist] = useState([])

  // UIContext state
  const [toastQueue, setToastQueue] = useState([])
  const [criticalWarning, setCriticalWarning] = useState(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  return (
    <SyncContext.Provider value={{ syncState, setSyncState, syncProgress, setSyncProgress, syncEngine, setSyncEngine }}>
      <IndexedContentContext.Provider value={{ indexedContent, setIndexedContent, searchQuery, setSearchQuery, facets, setFacets }}>
        <CustomersTemplatesContext.Provider value={{ customers, setCustomers, templates, setTemplates, audit, setAudit, checklist, setChecklist }}>
          <UIContext.Provider value={{ toastQueue, setToastQueue, criticalWarning, setCriticalWarning, settingsModalOpen, setSettingsModalOpen }}>
            {children}
          </UIContext.Provider>
        </CustomersTemplatesContext.Provider>
      </IndexedContentContext.Provider>
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within AppDataProvider')
  return ctx
}

export function useIndexedContent() {
  const ctx = useContext(IndexedContentContext)
  if (!ctx) throw new Error('useIndexedContent must be used within AppDataProvider')
  return ctx
}

export function useCustomersTemplates() {
  const ctx = useContext(CustomersTemplatesContext)
  if (!ctx) throw new Error('useCustomersTemplates must be used within AppDataProvider')
  return ctx
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within AppDataProvider')
  return ctx
}
