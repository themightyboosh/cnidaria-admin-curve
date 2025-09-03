import React from 'react'
// Static SVG logo (no interactivity)
// @ts-ignore - vite svg import as URL
import logoUrl from '../assets/logo.svg'
import './Header.css'

interface HeaderProps {
  title?: string
  currentPage?: string
}

const Header: React.FC<HeaderProps> = ({ 
  title = "Cnidaria",
  currentPage = "Dashboard"
}) => {
  const headerButtons = [
    { href: '#', icon: '/src/assets/icons/yggdrasil.svg', title: 'YGGDRASIL', subtitle: 'tend the world tree' },
    { href: '#', icon: '/src/assets/icons/curve-builder.svg', title: 'CURVE BUILDER', subtitle: 'the heart of smooth randomness' },
    { href: '#', icon: '/src/assets/icons/bands.svg', title: 'BANDS', subtitle: 'numbers take actions' },
    { href: '#', icon: '/src/assets/icons/jackets.svg', title: 'JACKETS', subtitle: 'wrap curves in functionality' },
    { href: 'https://github.com/themightyboosh/', icon: '/src/assets/icons/repo-man.svg', title: 'REPO MAN', subtitle: 'get some github lub', target: '_blank' as const },
    { href: '#', icon: '/src/assets/icons/tag-manager.svg', title: 'TAG MANAGER', subtitle: 'describe a thing' },
    { href: '#', icon: '/src/assets/icons/semantic-loom.svg', title: 'SEMANTIC LOOM', subtitle: 'AI synthetic poetic myth maker' },
    { href: '#', icon: '/src/assets/icons/merzbow.svg', title: 'MERZBOW', subtitle: 'manage the noise formulas' },
    { href: '#', icon: '/src/assets/icons/rainbow.svg', title: 'RAINBOW', subtitle: 'manage the color pallettes' },
    { href: '#', icon: '/src/assets/icons/config-control.svg', title: 'CONFIG & CONTROL', subtitle: 'manage settings and server configs' },
    { href: '#', icon: '/src/assets/icons/objects.svg', title: 'OBJECTS', subtitle: 'where the things are' },
  ]
  return (
    <header className="cnidaria-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">
            <img src={logoUrl as unknown as string} alt="Cnidaria Logo" style={{ height: 48, width: 48, paddingRight: 10 }} />
            <div className="logo-text">
              <h1 className="logo-title">{title}<span className="thin"> WORLD BUILDER</span></h1>
            </div>
          </div>
        </div>
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
        <div className="header-actions">
          <div className="logout-placeholder">logout</div>
        </div>
      </div>
    </header>
  )
}

export default Header
