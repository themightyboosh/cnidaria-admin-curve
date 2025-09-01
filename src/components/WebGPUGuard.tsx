import React, { useState, useEffect } from 'react';
import { 
  initializeWebGPU, 
  checkWebGPURequirements, 
  getWebGPUStatusMessage, 
  getBrowserInfo,
  type WebGPUCapabilities 
} from '../utils/webgpuDetection';
import './WebGPUGuard.css';

interface WebGPUGuardProps {
  children: React.ReactNode;
}

const WebGPUGuard: React.FC<WebGPUGuardProps> = ({ children }) => {
  const [capabilities, setCapabilities] = useState<WebGPUCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        console.log('🔍 Checking WebGPU support...');
        const caps = await initializeWebGPU();
        setCapabilities(caps);
        
        if (!caps.supported) {
          const browserInfo = getBrowserInfo();
          setError(`WebGPU is required but not available in ${browserInfo.browser}`);
        } else {
          const requirements = checkWebGPURequirements(caps);
          if (!requirements.compatible) {
            setError(`WebGPU requirements not met: ${requirements.issues.join(', ')}`);
          }
        }
      } catch (err) {
        console.error('❌ WebGPU initialization failed:', err);
        setError(`WebGPU initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    checkWebGPU();
  }, []);

  if (loading) {
    return (
      <div className="webgpu-guard loading">
        <div className="webgpu-loading-container">
          <div className="webgpu-loading-spinner"></div>
          <h2>🔧 Initializing WebGPU...</h2>
          <p>Checking browser compatibility and GPU capabilities</p>
        </div>
      </div>
    );
  }

  if (error || !capabilities?.supported) {
    const browserInfo = getBrowserInfo();
    const statusMessage = capabilities ? getWebGPUStatusMessage(capabilities) : 'WebGPU not detected';
    const requirements = capabilities ? checkWebGPURequirements(capabilities) : null;

    return (
      <div className="webgpu-guard error">
        <div className="webgpu-error-container">
          <div className="webgpu-error-icon">⚠️</div>
          <h1>WebGPU Required</h1>
          <p className="webgpu-error-message">{statusMessage}</p>
          
          <div className="webgpu-details">
            <h3>🖥️ System Information</h3>
            <ul>
              <li><strong>Browser:</strong> {browserInfo.browser}</li>
              <li><strong>User Agent:</strong> {browserInfo.userAgent}</li>
              <li><strong>WebGPU Object:</strong> {browserInfo.webgpuObject}</li>
            </ul>

            {requirements && (
              <>
                <h3>❌ Issues Found</h3>
                <ul>
                  {requirements.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>

                <h3>💡 Recommendations</h3>
                <ul>
                  {requirements.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </>
            )}

            <h3>🔧 How to Enable WebGPU</h3>
            <div className="webgpu-instructions">
              <div className="browser-instruction">
                <h4>Chrome 113+</h4>
                <ol>
                  <li>Open chrome://flags/</li>
                  <li>Search for "WebGPU"</li>
                  <li>Enable "Unsafe WebGPU"</li>
                  <li>Restart browser</li>
                </ol>
              </div>
              
              <div className="browser-instruction">
                <h4>Firefox 110+</h4>
                <ol>
                  <li>Open about:config</li>
                  <li>Set dom.webgpu.enabled = true</li>
                  <li>Set gfx.webgpu.force-enabled = true</li>
                  <li>Restart browser</li>
                </ol>
              </div>
              
              <div className="browser-instruction">
                <h4>Safari 16.4+</h4>
                <ol>
                  <li>Safari → Preferences</li>
                  <li>Advanced → Show Develop menu</li>
                  <li>Develop → Experimental Features</li>
                  <li>Enable WebGPU</li>
                </ol>
              </div>
            </div>

            <div className="webgpu-links">
              <h3>📚 More Information</h3>
              <ul>
                <li><a href="https://caniuse.com/webgpu" target="_blank" rel="noopener noreferrer">WebGPU Browser Support</a></li>
                <li><a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" target="_blank" rel="noopener noreferrer">WebGPU API Documentation</a></li>
                <li><a href="https://gpuweb.github.io/gpuweb/" target="_blank" rel="noopener noreferrer">WebGPU Specification</a></li>
              </ul>
            </div>
          </div>
          
          <button 
            className="webgpu-retry-button"
            onClick={() => window.location.reload()}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // WebGPU is available and working - render the app
  console.log('✅ WebGPU ready:', getWebGPUStatusMessage(capabilities));
  return <>{children}</>;
};

export default WebGPUGuard;
