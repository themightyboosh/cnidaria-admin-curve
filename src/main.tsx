import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { HeaderProvider } from './contexts/HeaderContext'
import { router } from './router'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HeaderProvider>
        <RouterProvider router={router} />
      </HeaderProvider>
    </ErrorBoundary>
  </StrictMode>,
)
