import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'

interface LayoutProps {
  className?: string
}

const Layout: React.FC<LayoutProps> = ({ className = '' }) => {
  const location = useLocation()

  // Determine current page for header
  const getCurrentPage = () => {
    if (location.pathname === '/') return 'Dashboard'
    if (location.pathname.startsWith('/curves')) return 'Curve Admin'
    if (location.pathname.startsWith('/wave-editor')) return 'Wave Editor'
    return 'Admin'
  }

  // Get page-specific title and subtitle
  const getPageInfo = () => {
    const currentPage = getCurrentPage()
    
    switch (currentPage) {
      case 'Dashboard':
        return {
          title: 'Cnidaria'
        }
      case 'Curve Admin':
        return {
          title: 'Cnidaria'
        }
      case 'Wave Editor':
        return {
          title: 'Cnidaria'
        }
      default:
        return {
          title: 'Cnidaria'
        }
    }
  }

  const pageInfo = getPageInfo()

  // For CurveBuilder, TagManager, and WorldView, render without layout wrapper to allow full control
  if (location.pathname.startsWith('/curves') || location.pathname.startsWith('/tags') || location.pathname.startsWith('/world-view')) {
    return <Outlet />
  }

  return (
    <div className={`admin-layout ${className}`}>
      <Header 
        title={pageInfo.title}
        currentPage={getCurrentPage()}
      />
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
