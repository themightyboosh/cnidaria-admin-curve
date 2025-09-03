import React from 'react'
import { useLocation } from 'react-router-dom'
// Static SVG logo (no interactivity)
// @ts-ignore - vite svg import as URL
import logoUrl from '../assets/logo.svg'
import './Header.css'
import { useAuth } from '../contexts/AuthContext'
// Asset URLs (bundled by Vite)
// @ts-ignore
import iconYggdrasil from '../assets/icons/yggdrasil.svg'
// @ts-ignore
import iconCurve from '../assets/icons/curve-builder.svg'
// @ts-ignore
import iconBands from '../assets/icons/bands.svg'
// @ts-ignore
import iconJackets from '../assets/icons/jackets.svg'
// @ts-ignore
import iconRepo from '../assets/icons/repo-man.svg'
// @ts-ignore
import iconTags from '../assets/icons/tag-manager.svg'
// @ts-ignore
import iconLoom from '../assets/icons/semantic-loom.svg'
// @ts-ignore
import iconMerzbow from '../assets/icons/merzbow.svg'
// @ts-ignore
import iconRainbow from '../assets/icons/rainbow.svg'
// @ts-ignore
import iconConfig from '../assets/icons/config-control.svg'
// @ts-ignore
import iconObjects from '../assets/icons/objects.svg'

interface HeaderProps {
  title?: string
  currentPage?: string
}

const Header: React.FC<HeaderProps> = ({ 
  title = "Cnidaria",
  currentPage = "Dashboard"
}) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isLoginPage = location.pathname === '/'
  const headerButtons = [
    { href: '#', icon: iconYggdrasil as unknown as string, title: 'YGGDRASIL', subtitle: 'tend the world tree' },
    { href: '/curves', icon: iconCurve as unknown as string, title: 'CURVE BUILDER', subtitle: 'the heart of smooth randomness' },
    { href: '#', icon: iconBands as unknown as string, title: 'BANDS', subtitle: 'numbers take actions' },
    { href: '#', icon: iconJackets as unknown as string, title: 'WRAP JACKETS', subtitle: 'wrap curves in functionality' },
    { href: 'https://github.com/themightyboosh/', icon: iconRepo as unknown as string, title: 'REPO MAN', subtitle: 'get some github lub', target: '_blank' as const },
    { href: '#', icon: iconTags as unknown as string, title: 'TAG MANAGER', subtitle: 'describe a thing' },
    { href: '#', icon: iconLoom as unknown as string, title: 'SEMANTIC LOOM', subtitle: 'AI synthetic poetic myth maker' },
    { href: '#', icon: iconMerzbow as unknown as string, title: 'MERZBOW', subtitle: 'manage the noise formulas' },
    { href: '#', icon: iconRainbow as unknown as string, title: 'RAINBOW', subtitle: 'manage the color pallettes' },
    { href: '/config', icon: iconConfig as unknown as string, title: 'CONFIG & CONTROL', subtitle: 'manage settings and server configs' },
    { href: '#', icon: iconObjects as unknown as string, title: 'OBJECTS', subtitle: 'where the things are' },
  ]
  return (
    <header className={`cnidaria-header ${isLoginPage ? 'login-page' : ''}`}>
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">
            <img src={logoUrl as unknown as string} alt="Cnidaria Logo" style={{ height: 48, width: 48, paddingRight: 10 }} />
            <div className="logo-text">
              <h1 className="logo-title">{title}<span className="thin"> WORLD BUILDER</span></h1>
            </div>
          </div>
        </div>
        {!isLoginPage && (
          <nav className="header-button-group" aria-label="Mega menu">
            {headerButtons.map((btn) => (
              <a href={btn.href} key={btn.title} className="header-button" target={(btn as any).target || undefined} rel={(btn as any).target === '_blank' ? 'noopener noreferrer' : undefined}>
                <span className="header-button-icon">
                  <img src={btn.icon} alt="" />
                </span>
                <span className="header-button-text">
                  <span className="header-button-title">{btn.title}</span>
                  <span className="header-button-subtitle">{btn.subtitle}</span>
                </span>
              </a>
            ))}
          </nav>
        )}
        <div className="header-actions">
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />}
              <span style={{ fontSize: 12, color: '#a3a9b7' }}>{user.email}</span>
            </div>
          )}
          {user && <button className="logout-placeholder" onClick={logout}>Sign out</button>}
        </div>
      </div>
    </header>
  )
}

export default Header
