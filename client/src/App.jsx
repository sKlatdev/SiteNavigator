import { RouterProvider } from 'react-router-dom'
import { router } from './shell/router'

export default function App() {
  return <RouterProvider router={router} />
}
