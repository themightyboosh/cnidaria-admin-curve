import React, { useState } from 'react'
import './ConfigControl.css'

type AdminTab = 'users' | 'stats' | 'invites' | 'roles'

const ConfigControl: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('users')
  const [expandedSections, setExpandedSections] = useState({
    admin: true,
    system: true
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="app">
      <div className="main-content">
        {/* Left Pane */}
        <div className="left-pane">
          {/* Admin Section */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('admin')}>
              <span className="toggle-icon">{expandedSections.admin ? '▼' : '▶'}</span>
              Admin Controls
            </h3>
            {expandedSections.admin && (
              <div className="section-content">
                <div className="form-group">
                  <button 
                    className={`manage-tags-btn ${tab === 'users' ? 'active' : ''}`}
                    onClick={() => setTab('users')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    Users
                  </button>
                  <button 
                    className={`manage-tags-btn ${tab === 'stats' ? 'active' : ''}`}
                    onClick={() => setTab('stats')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    User Stats
                  </button>
                  <button 
                    className={`manage-tags-btn ${tab === 'invites' ? 'active' : ''}`}
                    onClick={() => setTab('invites')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    Invites
                  </button>
                  <button 
                    className={`manage-tags-btn ${tab === 'roles' ? 'active' : ''}`}
                    onClick={() => setTab('roles')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    Roles
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* System Section */}
          <div className="info-section">
            <h3 className="collapsible-header" onClick={() => toggleSection('system')}>
              <span className="toggle-icon">{expandedSections.system ? '▼' : '▶'}</span>
              System Settings
            </h3>
            {expandedSections.system && (
              <div className="section-content">
                <div className="info-item">
                  <strong>Environment:</strong> Development
                </div>
                <div className="info-item">
                  <strong>API Status:</strong> Connected
                </div>
                <div className="info-item">
                  <strong>WebGPU:</strong> Available
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-area">
          <div className="grid-canvas">
            {tab === 'users' && (
              <div style={{ padding: '40px', color: '#ffffff' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>User Management</h2>
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <p style={{ color: '#ccc', fontSize: '16px', lineHeight: '1.6' }}>
                      Approve or revoke access for Google accounts. This interface will allow you to:
                    </p>
                    <ul style={{ color: '#a3a9b7', marginTop: '16px' }}>
                      <li>View all registered users</li>
                      <li>Approve pending access requests</li>
                      <li>Revoke user permissions</li>
                      <li>Assign user roles</li>
                    </ul>
                    <p style={{ color: '#888', fontStyle: 'italic', marginTop: '20px' }}>
                      (UI implementation in progress)
                    </p>
                  </div>
                </div>
              </div>
            )}
            {tab === 'stats' && (
              <div style={{ padding: '40px', color: '#ffffff' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>User Statistics</h2>
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <p style={{ color: '#ccc', fontSize: '16px', lineHeight: '1.6' }}>
                      Usage analytics and access logs. This dashboard will show:
                    </p>
                    <ul style={{ color: '#a3a9b7', marginTop: '16px' }}>
                      <li>Login frequency and patterns</li>
                      <li>Feature usage statistics</li>
                      <li>System performance metrics</li>
                      <li>Error logs and debugging info</li>
                    </ul>
                    <p style={{ color: '#888', fontStyle: 'italic', marginTop: '20px' }}>
                      (Analytics dashboard in development)
                    </p>
                  </div>
                </div>
              </div>
            )}
            {tab === 'invites' && (
              <div style={{ padding: '40px', color: '#ffffff' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Invitation System</h2>
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <p style={{ color: '#ccc', fontSize: '16px', lineHeight: '1.6' }}>
                      Invite users by email to request access. Features will include:
                    </p>
                    <ul style={{ color: '#a3a9b7', marginTop: '16px' }}>
                      <li>Send email invitations</li>
                      <li>Track invitation status</li>
                      <li>Set expiration dates</li>
                      <li>Bulk invitation management</li>
                    </ul>
                    <p style={{ color: '#888', fontStyle: 'italic', marginTop: '20px' }}>
                      (Invitation system coming soon)
                    </p>
                  </div>
                </div>
              </div>
            )}
            {tab === 'roles' && (
              <div style={{ padding: '40px', color: '#ffffff' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Role Management</h2>
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <p style={{ color: '#ccc', fontSize: '16px', lineHeight: '1.6' }}>
                      Define roles and group-based permissions. This system will enable:
                    </p>
                    <ul style={{ color: '#a3a9b7', marginTop: '16px' }}>
                      <li>Create custom user roles</li>
                      <li>Set granular permissions</li>
                      <li>Group-based access control</li>
                      <li>Role hierarchy management</li>
                    </ul>
                    <p style={{ color: '#888', fontStyle: 'italic', marginTop: '20px' }}>
                      (Role system architecture in planning)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfigControl


