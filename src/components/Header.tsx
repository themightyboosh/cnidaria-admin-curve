import React from 'react'
import WebGPUCompatibilityBadge from './WebGPUCompatibilityBadge'
import './Header.css'

interface HeaderProps {
  title?: string
  currentPage?: string
}

const Header: React.FC<HeaderProps> = ({ 
  title = "Cnidaria",
  currentPage = "Dashboard"
}) => {
  return (
    <header className="cnidaria-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-text">
              <h1 className="logo-title">{title}</h1>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <WebGPUCompatibilityBadge className="compact" showControls={false} />
          <div className="current-page-indicator">
            <span className="page-badge">{currentPage}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
