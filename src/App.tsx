import { RouterProvider } from 'react-router-dom'
import { appRouter } from './core/router'

export default function App() {
  return <RouterProvider router={appRouter} />
}
