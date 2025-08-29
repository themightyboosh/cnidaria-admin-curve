import React from 'react'
import './Header.css'

interface HeaderProps {
  title?: string
  subtitle?: string
  currentPage?: string
}

const Header: React.FC<HeaderProps> = ({ 
  title = "CNidaria",
  subtitle = "Mathematical Terrain Management",
  currentPage = "Dashboard"
}) => {
  return (
    <header className="cnidaria-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Abstract Cnidaria-inspired logo */}
                <circle cx="20" cy="20" r="18" stroke="var(--accent-primary)" strokeWidth="2" fill="none"/>
                <circle cx="20" cy="20" r="12" stroke="var(--accent-secondary)" strokeWidth="1.5" fill="none"/>
                <circle cx="20" cy="20" r="6" fill="var(--accent-primary)"/>
                {/* Tentacle-like curves */}
                <path d="M8 20 Q12 16 16 20 Q20 24 24 20 Q28 16 32 20" 
                      stroke="var(--accent-primary)" strokeWidth="1.5" fill="none"/>
                <path d="M20 8 Q16 12 20 16 Q24 20 20 24 Q16 28 20 32" 
                      stroke="var(--accent-secondary)" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            <div className="logo-text">
              <h1 className="logo-title">{title}</h1>
              {subtitle && <p className="logo-subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <div className="current-page-indicator">
            <span className="page-badge">{currentPage}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
