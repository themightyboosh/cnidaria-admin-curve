import React, { useState, useEffect } from 'react'
import { apiUrl } from '../../config/environments'
import './ConfigControl.css'

type AdminTab = 'users' | 'requests' | 'stats' | 'invites' | 'roles' | 'system'
type UserRole = 'superadmin' | 'admin' | 'beta-tester' | 'player'
type UserStatus = 'active' | 'pending' | 'revoked' | 'invited'

interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  lastLoginAt?: string
  invitedBy?: string
}

interface AccessRequest {
  id: string
  email: string
  requestedAt: string
  message?: string
  status: 'pending' | 'approved' | 'denied'
}

interface Invitation {
  id: string
  email: string
  role: UserRole
  invitedBy: string
  invitedAt: string
  expiresAt: string
  status: 'sent' | 'accepted' | 'expired'
}

const ConfigControl: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('users')
  const [expandedSections, setExpandedSections] = useState({
    admin: true,
    system: true
  })

  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('beta-tester')

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Mock data for development (replace with real API calls)
  const loadMockData = () => {
    setUsers([
      {
        id: 'user-1',
        email: 'daniel@cnidaria.dev',
        displayName: 'Daniel Crowder',
        role: 'superadmin',
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z',
        lastLoginAt: '2024-09-04T08:00:00Z'
      },
      {
        id: 'user-2',
        email: 'admin@cnidaria.dev',
        displayName: 'Admin User',
        role: 'admin',
        status: 'active',
        createdAt: '2024-02-01T14:30:00Z',
        lastLoginAt: '2024-09-03T16:45:00Z'
      },
      {
        id: 'user-3',
        email: 'beta@cnidaria.dev',
        displayName: 'Beta Tester',
        role: 'beta-tester',
        status: 'pending',
        createdAt: '2024-08-15T09:15:00Z',
        invitedBy: 'daniel@cnidaria.dev'
      }
    ])

    setAccessRequests([
      {
        id: 'req-1',
        email: 'newuser@example.com',
        requestedAt: '2024-09-04T06:30:00Z',
        message: 'Interested in testing the fractal pattern generator',
        status: 'pending'
      },
      {
        id: 'req-2',
        email: 'developer@gamedev.com',
        requestedAt: '2024-09-03T18:20:00Z',
        message: 'Game developer looking for procedural textures',
        status: 'pending'
      }
    ])

    setInvitations([
      {
        id: 'inv-1',
        email: 'artist@studio.com',
        role: 'beta-tester',
        invitedBy: 'daniel@cnidaria.dev',
        invitedAt: '2024-09-01T12:00:00Z',
        expiresAt: '2024-09-15T12:00:00Z',
        status: 'sent'
      }
    ])
  }

  // User management functions
  const updateUserRole = (userId: string, newRole: UserRole) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ))
    console.log(`🔧 Updated user ${userId} role to ${newRole}`)
  }

  const updateUserStatus = (userId: string, newStatus: UserStatus) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ))
    console.log(`🔧 Updated user ${userId} status to ${newStatus}`)
  }

  const approveAccessRequest = (requestId: string, assignedRole: UserRole) => {
    const request = accessRequests.find(r => r.id === requestId)
    if (request) {
      // Move from request to user
      const newUser: User = {
        id: `user-${Date.now()}`,
        email: request.email,
        displayName: request.email.split('@')[0],
        role: assignedRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        invitedBy: 'daniel@cnidaria.dev'
      }
      
      setUsers(prev => [...prev, newUser])
      setAccessRequests(prev => prev.filter(r => r.id !== requestId))
      console.log(`✅ Approved access request for ${request.email} as ${assignedRole}`)
    }
  }

  const denyAccessRequest = (requestId: string) => {
    setAccessRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: 'denied' } : r
    ))
    console.log(`❌ Denied access request ${requestId}`)
  }

  const generateInviteEmail = (email: string, role: UserRole): string => {
    const roleDescriptions = {
      'superadmin': 'full system administrator',
      'admin': 'administrative user with access to all creation tools',
      'beta-tester': 'beta tester with early access to new features',
      'player': 'player with access to the game world'
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cnidaria Access Invitation</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #1a1a1a; color: #ffffff; margin: 0; padding: 40px; }
        .container { max-width: 600px; margin: 0 auto; background: #2a2a2a; border-radius: 12px; padding: 40px; border: 1px solid #444; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo img { width: 80px; height: 80px; }
        .title { color: #007acc; font-size: 28px; font-weight: 600; text-align: center; margin-bottom: 20px; }
        .subtitle { color: #ccc; text-align: center; margin-bottom: 30px; font-size: 16px; }
        .content { line-height: 1.6; margin-bottom: 30px; }
        .role-badge { background: #007acc; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
        .cta { text-align: center; margin: 30px 0; }
        .cta-button { background: linear-gradient(135deg, #007acc, #0066aa); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; display: inline-block; }
        .footer { color: #888; font-size: 14px; text-align: center; border-top: 1px solid #444; padding-top: 20px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src="data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#007acc"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="20" font-weight="bold">C</text></svg>`)}" alt="Cnidaria Logo" />
        </div>
        
        <h1 class="title">Welcome to Cnidaria</h1>
        <p class="subtitle">You've been invited to join our procedural pattern generation platform</p>
        
        <div class="content">
            <p>Hello!</p>
            <p>You've been invited to join <strong>Cnidaria</strong> as a <span class="role-badge">${role.replace('-', ' ').toUpperCase()}</span>.</p>
            <p>Cnidaria is an advanced platform for creating procedural fractal patterns and textures using our cutting-edge coordinate processing pipeline.</p>
            <p>As a ${roleDescriptions[role]}, you'll have access to:</p>
            <ul>
                ${role === 'admin' ? `
                <li>🎛️ <strong>Merzbow</strong> - Fractal pattern generator</li>
                <li>📊 <strong>Curve Builder</strong> - Mathematical curve editor</li>
                <li>🏷️ <strong>Tag Manager</strong> - Organization tools</li>
                <li>🌍 <strong>World View</strong> - 3D visualization</li>
                ` : role === 'beta-tester' ? `
                <li>🧪 Early access to new pattern generation features</li>
                <li>🎨 Testing tools and feedback systems</li>
                <li>📝 Direct communication with the development team</li>
                ` : `
                <li>🎮 Access to the procedural game world</li>
                <li>🎨 View and use generated textures</li>
                <li>🌍 Explore fractal landscapes</li>
                `}
            </ul>
        </div>
        
        <div class="cta">
            <a href="https://cnidaria-admin-dev.web.app/login" class="cta-button">
                Accept Invitation & Sign In
            </a>
        </div>
        
        <div class="footer">
            <p>This invitation expires in 14 days.</p>
            <p>Cnidaria © 2024 • Procedural Pattern Generation Platform</p>
        </div>
    </div>
</body>
</html>`.trim()
  }

  const sendInvitation = () => {
    if (!newInviteEmail.trim()) return
    
    const newInvitation: Invitation = {
      id: `inv-${Date.now()}`,
      email: newInviteEmail.trim(),
      role: newInviteRole,
      invitedBy: 'daniel@cnidaria.dev',
      invitedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      status: 'sent'
    }
    
    setInvitations(prev => [...prev, newInvitation])
    
    // Generate and log the email (in production, this would be sent via email service)
    const emailHTML = generateInviteEmail(newInvitation.email, newInvitation.role)
    console.log(`📧 Generated invitation email for ${newInvitation.email}:`)
    console.log(emailHTML)
    
    // In production, you would send this via your email service:
    // await emailService.send({
    //   to: newInvitation.email,
    //   subject: `Cnidaria Platform Invitation - ${newInvitation.role.replace('-', ' ').toUpperCase()}`,
    //   html: emailHTML
    // })
    
    setNewInviteEmail('')
    console.log(`📧 Sent invitation to ${newInvitation.email} as ${newInvitation.role}`)
  }

  // Load data on mount
  useEffect(() => {
    loadMockData()
  }, [])

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
                    Active Users
                  </button>
                  <button 
                    className={`manage-tags-btn ${tab === 'requests' ? 'active' : ''}`}
                    onClick={() => setTab('requests')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    Access Requests
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
                <div className="form-group">
                  <button 
                    className={`manage-tags-btn ${tab === 'system' ? 'active' : ''}`}
                    onClick={() => setTab('system')}
                    style={{ width: '100%', marginBottom: '8px' }}
                  >
                    System Status
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-area">
          <div className="grid-canvas">
            {tab === 'users' && (
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Active Users</h2>
                
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Active Users ({users.filter(u => u.status === 'active').length})</h3>
                    <div className="user-table">
                      {users.filter(u => u.status === 'active').map(user => (
                        <div key={user.id} className="user-row">
                          <div className="user-info">
                            <div className="user-email">{user.email}</div>
                            <div className="user-details">{user.displayName} • Last login: {new Date(user.lastLoginAt || user.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="user-role">
                            <select 
                              value={user.role} 
                              onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                              className="role-select"
                            >
                              <option value="superadmin">Superadmin</option>
                              <option value="admin">Admin</option>
                              <option value="beta-tester">Beta Tester</option>
                              <option value="player">Player</option>
                            </select>
                          </div>
                          <div className="user-actions">
                            {user.role !== 'superadmin' && (
                              <button 
                                onClick={() => updateUserStatus(user.id, 'revoked')}
                                className="action-button revoke"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'requests' && (
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Access Requests</h2>
                
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Pending Requests ({accessRequests.filter(r => r.status === 'pending').length})</h3>
                    <div className="request-table">
                      {accessRequests.filter(r => r.status === 'pending').map(request => (
                        <div key={request.id} className="request-row">
                          <div className="request-info">
                            <div className="request-email">{request.email}</div>
                            <div className="request-message">"{request.message}"</div>
                            <div className="request-date">Requested: {new Date(request.requestedAt).toLocaleDateString()}</div>
                          </div>
                          <div className="request-actions">
                            <select 
                              defaultValue="beta-tester"
                              className="role-select"
                              id={`role-${request.id}`}
                            >
                              <option value="admin">Admin</option>
                              <option value="beta-tester">Beta Tester</option>
                              <option value="player">Player</option>
                            </select>
                            <button 
                              onClick={() => {
                                const select = document.getElementById(`role-${request.id}`) as HTMLSelectElement
                                approveAccessRequest(request.id, select.value as UserRole)
                              }}
                              className="action-button approve"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => denyAccessRequest(request.id)}
                              className="action-button deny"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                      {accessRequests.filter(r => r.status === 'pending').length === 0 && (
                        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                          No pending access requests
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'stats' && (
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
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
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Invitation System</h2>
                
                {/* Send New Invitation */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0', marginBottom: '20px' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Send Invitation</h3>
                    <div className="invite-form">
                      <div className="form-group">
                        <label>Email Address:</label>
                        <input 
                          type="email" 
                          value={newInviteEmail}
                          onChange={(e) => setNewInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                          style={{ marginBottom: '10px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Role:</label>
                        <select 
                          value={newInviteRole}
                          onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                          style={{ marginBottom: '15px' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="beta-tester">Beta Tester</option>
                          <option value="player">Player</option>
                        </select>
                      </div>
                      <button 
                        onClick={sendInvitation}
                        disabled={!newInviteEmail.trim()}
                        className="action-button approve"
                        style={{ width: '100%' }}
                      >
                        Send Invitation
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sent Invitations */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Sent Invitations ({invitations.length})</h3>
                    <div className="invitation-table">
                      {invitations.map(invitation => (
                        <div key={invitation.id} className="invitation-row">
                          <div className="invitation-info">
                            <div className="invitation-email">{invitation.email}</div>
                            <div className="invitation-details">
                              Role: {invitation.role} • Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="invitation-status">
                            <span className={`status-badge ${invitation.status}`}>
                              {invitation.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {invitations.length === 0 && (
                        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                          No invitations sent
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'roles' && (
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>Role Management</h2>
                
                {/* Role Definitions */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0', marginBottom: '20px' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Role Definitions & Permissions</h3>
                    <div className="role-definitions">
                      
                      <div className="role-card superadmin">
                        <div className="role-header">
                          <h4>🔥 Superadmin</h4>
                          <span className="role-count">({users.filter(u => u.role === 'superadmin').length})</span>
                        </div>
                        <div className="role-permissions">
                          <div className="permission-item">✅ Full system access</div>
                          <div className="permission-item">✅ User management</div>
                          <div className="permission-item">✅ Role assignment</div>
                          <div className="permission-item">✅ System configuration</div>
                          <div className="permission-item">✅ All admin tools</div>
                        </div>
                      </div>

                      <div className="role-card admin">
                        <div className="role-header">
                          <h4>⚙️ Admin</h4>
                          <span className="role-count">({users.filter(u => u.role === 'admin').length})</span>
                        </div>
                        <div className="role-permissions">
                          <div className="permission-item">✅ Curve Builder access</div>
                          <div className="permission-item">✅ Merzbow access</div>
                          <div className="permission-item">✅ Tag management</div>
                          <div className="permission-item">✅ World View access</div>
                          <div className="permission-item">❌ User management</div>
                        </div>
                      </div>

                      <div className="role-card beta-tester">
                        <div className="role-header">
                          <h4>🧪 Beta Tester</h4>
                          <span className="role-count">({users.filter(u => u.role === 'beta-tester').length})</span>
                        </div>
                        <div className="role-permissions">
                          <div className="permission-item">🔒 Future: Limited curve access</div>
                          <div className="permission-item">🔒 Future: Pattern testing</div>
                          <div className="permission-item">🔒 Future: Feedback submission</div>
                          <div className="permission-item">❌ Admin tools</div>
                          <div className="permission-item">❌ System access</div>
                        </div>
                      </div>

                      <div className="role-card player">
                        <div className="role-header">
                          <h4>🎮 Player</h4>
                          <span className="role-count">({users.filter(u => u.role === 'player').length})</span>
                        </div>
                        <div className="role-permissions">
                          <div className="permission-item">🔒 Future: Game world access</div>
                          <div className="permission-item">🔒 Future: Texture viewing</div>
                          <div className="permission-item">❌ Creation tools</div>
                          <div className="permission-item">❌ Admin tools</div>
                          <div className="permission-item">❌ System access</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px', background: '#444', borderRadius: '6px' }}>
                      <h4 style={{ color: '#ffd700', marginBottom: '10px' }}>🔒 Current Access Policy</h4>
                      <p style={{ color: '#ccc', margin: 0 }}>
                        <strong>Superadmins</strong> and <strong>Admins</strong> have full access to all current features.
                        Beta Testers and Players will gain access as features are released.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'system' && (
              <div style={{ padding: '20px', color: '#ffffff', width: '100%', height: '100%' }}>
                <h2 style={{ color: '#007acc', marginBottom: '20px', fontSize: '24px' }}>System Status</h2>
                
                {/* API Status */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0', marginBottom: '20px' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>API Information</h3>
                    <div className="system-grid">
                      <div className="system-item">
                        <div className="system-label">API Name:</div>
                        <div className="system-value">cnidaria-api-dev</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Environment:</div>
                        <div className="system-value">Development</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">API URL:</div>
                        <div className="system-value">{apiUrl}</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Status:</div>
                        <div className="system-value status-online">🟢 Online</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Repository Information */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0', marginBottom: '20px' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Repository Information</h3>
                    <div className="system-grid">
                      <div className="system-item">
                        <div className="system-label">Repository:</div>
                        <div className="system-value">cnidaria-admin-curve</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Current Branch:</div>
                        <div className="system-value">dev</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Last Commit:</div>
                        <div className="system-value">Pipeline F integration</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Version:</div>
                        <div className="system-value">v2.1.0-dev</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Statistics */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0', marginBottom: '20px' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>User Statistics</h3>
                    <div className="system-grid">
                      <div className="system-item">
                        <div className="system-label">Total Users:</div>
                        <div className="system-value">{users.length}</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Active Users:</div>
                        <div className="system-value">{users.filter(u => u.status === 'active').length}</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Pending Requests:</div>
                        <div className="system-value">{accessRequests.filter(r => r.status === 'pending').length}</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Sent Invitations:</div>
                        <div className="system-value">{invitations.filter(i => i.status === 'sent').length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cloud & Firebase Status */}
                <div className="info-section" style={{ background: '#333', borderRadius: '8px', padding: '0' }}>
                  <div className="section-content">
                    <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Cloud Services</h3>
                    <div className="system-grid">
                      <div className="system-item">
                        <div className="system-label">Firebase Project:</div>
                        <div className="system-value">cnidaria-dev</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Cloud Functions:</div>
                        <div className="system-value status-online">🟢 Active</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">Firestore:</div>
                        <div className="system-value status-online">🟢 Connected</div>
                      </div>
                      <div className="system-item">
                        <div className="system-label">WebGPU Support:</div>
                        <div className="system-value status-online">🟢 Available</div>
                      </div>
                    </div>
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


