import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Menu from '../pages/Menu'
import CurveBuilder from '../pages/CurveBuilder'
import WaveEditor from '../pages/WaveEditor'
import TagManager from '../pages/TagManager'
import WorldView from '../pages/WorldView/index'
import Merzbow from '../pages/Merzbow'
import Testing from '../pages/Testing'
import ErrorBoundary from '../components/ErrorBoundary'
import ProtectedRoute from '../components/ProtectedRoute'
import Login from '../pages/Login'
import ConfigControl from '../pages/ConfigControl'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Login />
      },
      { path: 'menu', element: <ProtectedRoute><Menu /></ProtectedRoute> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'config', element: <ConfigControl /> },
          { path: 'curves', element: <CurveBuilder /> },
          { path: 'curves/:curveId', element: <CurveBuilder /> },
          { path: 'tags', element: <TagManager /> },
          { path: 'wave-editor', element: <WaveEditor /> },
          { path: 'wave-editor/:curveId', element: <WaveEditor /> },
          { path: 'world-view', element: <WorldView /> },
          { path: 'merzbow', element: <Merzbow /> },
          { path: 'testing', element: <Testing /> }
        ]
      }
    ]
  }
])

export default router
