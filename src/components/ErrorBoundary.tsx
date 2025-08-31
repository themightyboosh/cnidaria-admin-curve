import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center',
            backgroundColor: '#2a2a2a',
            padding: '40px',
            borderRadius: '8px',
            border: '1px solid #444'
          }}>
            <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>
              🚨 Something went wrong
            </h1>
            
            <p style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {this.state.error && (
              <details style={{ 
                marginTop: '20px', 
                textAlign: 'left',
                backgroundColor: '#333',
                padding: '15px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details
                </summary>
                <div style={{ color: '#ff6b6b', marginBottom: '10px' }}>
                  <strong>Error:</strong> {this.state.error.message}
                </div>
                {this.state.errorInfo && (
                  <div style={{ color: '#ccc' }}>
                    <strong>Stack:</strong>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      marginTop: '5px',
                      fontSize: '11px',
                      color: '#999'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </details>
            )}

            <div style={{ marginTop: '30px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#4a90e2',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                🔄 Refresh Page
              </button>
              
              <button
                onClick={() => window.history.back()}
                style={{
                  backgroundColor: '#666',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary



