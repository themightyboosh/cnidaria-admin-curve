import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Dashboard from '../pages/Dashboard'
import CurveAdmin from '../pages/CurveAdmin'
import WaveEditor from '../pages/WaveEditor'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'curves',
        element: <CurveAdmin />
      },
      {
        path: 'curves/:curveId',
        element: <CurveAdmin />
      },
      {
        path: 'wave-editor',
        element: <WaveEditor />
      },
      {
        path: 'wave-editor/:curveId',
        element: <WaveEditor />
      }
    ]
  }
])

export default router
