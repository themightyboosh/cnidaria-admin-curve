import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Menu from '../pages/Menu'
import CurveBuilder from '../pages/CurveBuilder'
import WaveEditor from '../pages/WaveEditor'
import TagManager from '../pages/TagManager'
import WorldView from '../pages/WorldView/index'
import ErrorBoundary from '../components/ErrorBoundary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
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
        path: 'tags',
        element: <TagManager />
      },
      {
        path: 'wave-editor',
        element: <WaveEditor />
      },
      {
        path: 'wave-editor/:curveId',
        element: <WaveEditor />
      },
      {
        path: 'world-view',
        element: <WorldView />
      }
    ]
  }
])

export default router
