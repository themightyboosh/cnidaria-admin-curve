import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const Login: React.FC = () => {
  const { login, error } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as any)?.from?.pathname || '/'

  const onSignIn = async () => {
    try {
      await login()
      navigate(from, { replace: true })
    } catch (_) {
      // Error is handled via context state; keep user on page
    }
  }

  return (
    <div style={{ background: '#0b0b0f', color: '#f2f4f8', padding: 20 }}>
      <section style={{
        background: '#000',
        border: '1px solid #333',
        borderRadius: 12,
        height: 'calc(100dvh - 125px)',
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 10px 28px rgba(0,0,0,0.45)'
      }}>
        <div style={{
          background: '#121218',
          border: '1px solid #272a34',
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
          textAlign: 'center'
        }}>
          <h1 style={{ marginTop: 0, marginBottom: 8, fontWeight: 800, letterSpacing: 0.8 }}>Cnidaria Control Center</h1>
          <p style={{ marginTop: 0, color: '#a3a9b7' }}>Sign in with Google to continue.</p>
          <button
            onClick={onSignIn}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              background: '#000',
              border: '1px solid rgba(0,90,180,0.2)',
              color: '#f2f4f8',
              fontWeight: 800,
              letterSpacing: 0.5,
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(0,90,180,0.22)'
            }}
            onMouseEnter={(e) => { (e.currentTarget.style.borderColor = 'rgba(0,140,230,0.45)') }}
            onMouseLeave={(e) => { (e.currentTarget.style.borderColor = 'rgba(0,90,180,0.2)') }}
          >
            Sign in with Google
          </button>
          {error && <div style={{ marginTop: 12, color: '#ff6b6b' }}>{error}</div>}
        </div>
      </section>
    </div>
  )
}

export default Login


