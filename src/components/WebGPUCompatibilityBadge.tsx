import React, { useState, useEffect } from 'react';
import { getGPUConfig, getProfileMessage, isCompatibilityMode, runGPUSelfTest, toggleForceCompatMode } from '../utils/webgpuConfig';
import './WebGPUCompatibilityBadge.css';

interface WebGPUCompatibilityBadgeProps {
  className?: string;
  showControls?: boolean;
}

const WebGPUCompatibilityBadge: React.FC<WebGPUCompatibilityBadgeProps> = ({ 
  className = '', 
  showControls = true 
}) => {
  const [isCompat, setIsCompat] = useState(false);
  const [message, setMessage] = useState('');
  const [isForceMode, setIsForceMode] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<{ success: boolean; timingMs: number; message: string } | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  useEffect(() => {
    try {
      const config = getGPUConfig();
      setIsCompat(isCompatibilityMode());
      setMessage(getProfileMessage());
      setIsForceMode(config.forceCompatMode);
    } catch (error) {
      console.warn('GPU config not available yet:', error);
    }
  }, []);

  const handleToggleForceMode = async () => {
    try {
      await toggleForceCompatMode();
      const config = getGPUConfig();
      setIsCompat(isCompatibilityMode());
      setMessage(getProfileMessage());
      setIsForceMode(config.forceCompatMode);
      setSelfTestResult(null); // Clear previous test results
    } catch (error) {
      console.error('Failed to toggle force compatibility mode:', error);
    }
  };

  const handleRunSelfTest = async () => {
    setIsRunningTest(true);
    try {
      const result = await runGPUSelfTest();
      setSelfTestResult(result);
    } catch (error) {
      setSelfTestResult({
        success: false,
        timingMs: 0,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const badgeClass = `webgpu-compat-badge ${isCompat ? 'compat' : 'full'} ${className}`;

  return (
    <div className={badgeClass}>
      <div className="badge-main">
        <div className="badge-indicator">
          {isCompat ? '≤256' : '≥1024'}
        </div>
        <div className="badge-content">
          <div className="badge-title">
            {isCompat ? 'Compatibility Mode' : 'Full Fidelity'}
            {isForceMode && <span className="force-indicator">(Forced)</span>}
          </div>
          <div className="badge-message">{message}</div>
        </div>
      </div>

      {showControls && (
        <div className="badge-controls">
          <button
            className="badge-button toggle-button"
            onClick={handleToggleForceMode}
            title="Toggle Force Compatibility Mode for testing"
          >
            {isForceMode ? 'Disable Force Mode' : 'Force Compat Mode'}
          </button>
          
          <button
            className="badge-button test-button"
            onClick={handleRunSelfTest}
            disabled={isRunningTest}
            title="Run GPU self-test validation"
          >
            {isRunningTest ? 'Testing...' : 'Self-Test'}
          </button>
        </div>
      )}

      {selfTestResult && (
        <div className={`test-result ${selfTestResult.success ? 'success' : 'failure'}`}>
          <div className="test-message">{selfTestResult.message}</div>
          <div className="test-timing">{selfTestResult.timingMs.toFixed(2)}ms</div>
        </div>
      )}
    </div>
  );
};

export default WebGPUCompatibilityBadge;
