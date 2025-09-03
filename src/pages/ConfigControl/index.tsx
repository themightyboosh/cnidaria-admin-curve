import React, { useState } from 'react'

type AdminTab = 'users' | 'stats' | 'invites' | 'roles'

const ConfigControl: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('users')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 'calc(100dvh - 85px)' }}>
      <aside style={{ borderRight: '1px solid #333', background: '#121218', padding: 16 }}>
        <div className="card">
          <h2 className="section-title">Admin Users</h2>
          <nav style={{ display: 'grid', gap: 8 }}>
            <button className="btn" onClick={() => setTab('users')}>Users</button>
            <button className="btn" onClick={() => setTab('stats')}>User Stats</button>
            <button className="btn" onClick={() => setTab('invites')}>Invites</button>
            <button className="btn" onClick={() => setTab('roles')}>Roles</button>
          </nav>
        </div>
      </aside>
      <main style={{ padding: 20, overflow: 'auto' }}>
        {tab === 'users' && (
          <section className="card">
            <h2 className="section-title">Users</h2>
            <p className="muted">Approve or revoke access for Google accounts. (UI placeholder)</p>
          </section>
        )}
        {tab === 'stats' && (
          <section className="card">
            <h2 className="section-title">User Stats</h2>
            <p className="muted">Usage and access logs. (UI placeholder)</p>
          </section>
        )}
        {tab === 'invites' && (
          <section className="card">
            <h2 className="section-title">Invites</h2>
            <p className="muted">Invite users by email to request access. (UI placeholder)</p>
          </section>
        )}
        {tab === 'roles' && (
          <section className="card">
            <h2 className="section-title">Roles</h2>
            <p className="muted">Define roles and group-based permissions. (UI placeholder)</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default ConfigControl


