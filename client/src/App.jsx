import { RouterProvider } from 'react-router-dom'
import { AppDataProvider } from './hooks/useAppData'
import { router } from './shell/router'

export default function App() {
  return (
    <AppDataProvider>
      <RouterProvider router={router} />
    </AppDataProvider>
  )
}
