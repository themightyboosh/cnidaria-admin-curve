import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Menu from '../pages/Menu'
import CurveBuilder from '../pages/CurveBuilder'
import WaveEditor from '../pages/WaveEditor'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Menu />
      },
      {
        path: 'curves',
        element: <CurveBuilder />
      },
      {
        path: 'curves/:curveId',
        element: <CurveBuilder />
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
