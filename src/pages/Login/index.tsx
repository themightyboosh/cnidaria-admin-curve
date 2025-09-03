import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { env } from '../../config/environments'
import { isWebGPUSupported } from '../../utils/webgpuDetection'
import RunicText from '../../components/RunicText'

// @ts-ignore - Import package.json for version info
import packageJson from '../../../package.json'
// @ts-ignore - vite svg import as URL
import logoUrl from '../../assets/logo.svg'


const Login: React.FC = () => {
  const { login, error, user, approved } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as any)?.from?.pathname || '/curves'
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null)

  // Check WebGPU support on component mount
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = isWebGPUSupported()
      setWebGPUSupported(isSupported)
    }
    checkSupport()
  }, [])

  // Redirect authenticated users to curves page
  useEffect(() => {
    if (user && approved) {
      navigate(from, { replace: true })
    }
  }, [user, approved, navigate, from])

  const onSignIn = async () => {
    try {
      await login()
      // Navigation will happen via useEffect after authentication
    } catch (_) {
      // Error is handled via context state; keep user on page
    }
  }

  // Don't render anything if user is authenticated (will redirect)
  if (user && approved) {
    return null
  }

  return (
    <div className="page-content" style={{ fontFamily: 'Exo, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Left Sidebar - Welcome Content */}
      <aside className="sidebar">
        <h1 style={{ 
          fontSize: '32px',
          fontWeight: 800,
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #00ffff, #0080ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: '0 0 24px 0'
        }}>
          Welcome to Cnidaria
        </h1>
        <div style={{
          fontSize: '18px',
          lineHeight: '1.6',
          color: '#a3a9b7'
        }}>
          <RunicText startDelay={0.2} letterDelay={20} style={{ marginBottom: '16px', display: 'block' }}>
            The world builder's control center for mathematical terrain generation and curve administration.
          </RunicText>
          <RunicText startDelay={2.5} letterDelay={20} style={{ marginBottom: '16px', display: 'block' }}>
            Craft infinite landscapes through the power of parametric curves, noise functions, and procedural generation.
          </RunicText>
          <RunicText startDelay={4.8} letterDelay={20} style={{ marginBottom: '16px', display: 'block' }}>
            Baking in the power of AI from the floor-up to embed mythic storytelling into every generated world.
          </RunicText>
          <RunicText startDelay={6.8} letterDelay={20} style={{ margin: 0, display: 'block' }}>
            Shape reality with mathematics. Build worlds that breathe.
          </RunicText>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main" style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Login Form - Dead Center */}
        <div style={{
          background: '#121218',
          border: '1px solid #272a34',
          borderRadius: '12px',
          padding: '48px 40px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          textAlign: 'center',
          fontFamily: 'Exo, -apple-system, BlinkMacSystemFont, sans-serif',
          width: '400px'
        }}>
          <img 
            src={logoUrl as unknown as string} 
            alt="Cnidaria Logo" 
            style={{ 
              width: '96px', 
              height: '96px', 
              marginBottom: '16px' 
            }} 
          />
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontWeight: 700, 
            fontSize: '24px',
            letterSpacing: '0.5px',
            fontFamily: 'Exo, -apple-system, BlinkMacSystemFont, sans-serif',
            color: '#f2f4f8',
            textTransform: 'uppercase'
          }}>
            World Builder
          </h2>
          {webGPUSupported === false ? (
            <>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontWeight: 700, 
                fontSize: '24px',
                letterSpacing: '0.5px',
                fontFamily: 'Exo, -apple-system, BlinkMacSystemFont, sans-serif',
                color: '#ff6b6b',
                textTransform: 'uppercase'
              }}>
                WebGPU Required
              </h3>
              <p style={{ 
                margin: '0 0 16px 0', 
                color: '#a3a9b7',
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                This application requires WebGPU support to function properly.
              </p>
              <p style={{ 
                margin: '0 0 16px 0', 
                color: '#a3a9b7',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                Please use one of these compatible browsers:
              </p>
              <div style={{ 
                textAlign: 'left',
                margin: '0 0 20px 0',
                color: '#00ffff',
                fontSize: '14px'
              }}>
                • Chrome 113+ (recommended)<br/>
                • Edge 113+<br/>
                • Safari 18+ (macOS Sequoia)<br/>
                • Firefox Nightly (experimental)
              </div>
              <a 
                href="https://caniuse.com/webgpu" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#0b8cff',
                  textDecoration: 'underline',
                  fontSize: '14px'
                }}
              >
                Learn more about WebGPU browser support
              </a>
            </>
          ) : (
            <>
              <p style={{ 
                margin: '0 0 32px 0', 
                color: '#a3a9b7',
                fontSize: '16px'
              }}>
                Sign in with Google to continue
              </p>
              {webGPUSupported !== null && (
                <button
                  onClick={onSignIn}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    fontFamily: 'Exo, -apple-system, BlinkMacSystemFont, sans-serif',
                    textAlign: 'center !important',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Sign-in
                </button>
              )}
            </>
          )}
          {error && (
            <div style={{ 
              marginTop: '20px', 
              color: '#ff6b6b',
              fontSize: '14px',
              padding: '12px',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '8px'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* API Info Bar - positioned at bottom */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#00ffff',
          fontFamily: 'monospace',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '6px',
          whiteSpace: 'nowrap'
        }}>
          Cnidaria Admin v{packageJson.version} • API: {env.environment} • {env.apiUrl}
        </div>
      </main>
    </div>
  )
}

export default Login


