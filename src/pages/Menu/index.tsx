import React from 'react'
import { useNavigate } from 'react-router-dom'
import './Menu.css'

const Menu: React.FC = () => {
  const navigate = useNavigate()

  const adminModules = [
    {
      title: 'Curve Builder',
      description: 'Create and manage mathematical curves with advanced tagging and processing',
      icon: '🔧',
      path: '/curves',
      features: ['Build custom curves', 'Apply tags and metadata', 'Process coordinates', 'Real-time visualization']
    },
    {
      title: 'Wave Editor',
      description: 'Create and edit wave patterns for curve data generation',
      icon: '🌊',
      path: '/wave-editor',
      features: ['Wave generation', 'Pattern editing', 'Data visualization', 'Export functions']
    }
  ]

  const quickActions = [
    {
      label: 'Build New Curve',
      action: () => navigate('/curves'),
      icon: '🔧'
    },
    {
      label: 'Open Wave Editor',
      action: () => navigate('/wave-editor'),
      icon: '🌊'
    }
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Cnidaria Control Center</h1>
        <p>Build, manage, and visualize your mathematical terrain systems</p>
      </div>

      <div className="dashboard-content">
        <section className="admin-modules">
          <h2>Admin Modules</h2>
          <div className="modules-grid">
            {adminModules.map((module, index) => (
              <div key={index} className="module-card" onClick={() => navigate(module.path)}>
                <div className="module-icon">{module.icon}</div>
                <div className="module-content">
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                  <ul className="module-features">
                    {module.features.map((feature, featureIndex) => (
                      <li key={featureIndex}>{feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="action-button"
                onClick={action.action}
              >
                <span className="action-icon">{action.icon}</span>
                <span className="action-label">{action.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="system-status">
          <h2>System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">API Status</span>
              <span className="status-value status-healthy">Healthy</span>
            </div>
            <div className="status-item">
              <span className="status-label">Database</span>
              <span className="status-value status-healthy">Connected</span>
            </div>
            <div className="status-item">
              <span className="status-label">Environment</span>
              <span className="status-value status-info">Development</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Menu
