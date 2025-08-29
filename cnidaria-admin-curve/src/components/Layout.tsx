import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Navigation from './Navigation'
import './Layout.css'

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
          title: 'Cnidaria Admin',
          subtitle: 'Mathematical Terrain Management'
        }
      case 'Curve Admin':
        return {
          title: 'Curve Administration',
          subtitle: 'Manage mathematical curves and patterns'
        }
      case 'Wave Editor':
        return {
          title: 'Wave Editor',
          subtitle: 'Create and edit wave patterns for curves'
        }
      default:
        return {
          title: 'Cnidaria Admin',
          subtitle: 'Mathematical Terrain Management'
        }
    }
  }

  const pageInfo = getPageInfo()

  return (
    <div className={`admin-layout ${className}`}>
      <Header 
        title={pageInfo.title}
        subtitle={pageInfo.subtitle}
        currentPage={getCurrentPage()}
      />
      
      <div className="layout-content">
        <aside className="sidebar">
          <Navigation />
        </aside>
        
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
