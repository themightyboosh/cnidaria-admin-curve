import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SaveButton } from '../../components/shared'
import { apiUrl } from '../../config/environments'

interface Curve {
  id: string
  "curve-name": string
  "curve-description": string
  "curve-tags"?: string[]
  "coordinate-noise": string
  "curve-width": number
  "curve-data": number[]
  "curve-index-scaling"?: number
  "coordinate-noise-seed"?: number
}

function WaveEditor() {
  const { curveId } = useParams<{ curveId?: string }>()
  const navigate = useNavigate()
  const [curve, setCurve] = useState<Curve | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waveData, setWaveData] = useState<number[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setIsUnsavedChanges] = useState(false)

  // Load curve data if curveId is provided
  useEffect(() => {
    if (curveId) {
      loadCurve(curveId)
    }
  }, [curveId])

  const loadCurve = async (id: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${apiUrl}/curves/${id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const curveData = data.data || data
          setCurve(curveData)
          setWaveData(curveData["curve-data"] || [])
        } else {
          setError('Failed to load curve: API returned error')
        }
      } else {
        setError(`Failed to load curve: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to load curve:', error)
      setError('Failed to load curve: Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleWaveDataChange = (index: number, value: number) => {
    const newWaveData = [...waveData]
    newWaveData[index] = value
    setWaveData(newWaveData)
    setIsUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!curve || !isEditing) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const updatedCurve = {
        ...curve,
        "curve-data": waveData
      }
      
      const response = await fetch(
        `${apiUrl}/api/curves/${curve.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedCurve)
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCurve(updatedCurve)
          setIsUnsavedChanges(false)
          setIsEditing(false)
          console.log('Wave data updated successfully')
        } else {
          setError('Failed to update wave data: API returned error')
        }
      } else {
        const errorText = await response.text()
        setError(`Failed to update wave data: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to update wave data:', error)
      setError('Failed to update wave data: Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (curve) {
      setWaveData(curve["curve-data"] || [])
    }
    setIsEditing(false)
    setIsUnsavedChanges(false)
  }

  const goToCurveAdmin = () => {
    if (curveId) {
      navigate(`/curves/${curveId}`)
    } else {
      navigate('/curves')
    }
  }

  if (isLoading) {
    return (
      <div className="wave-editor">
        <div className="loading-container">
          <div className="loading">Loading curve data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="wave-editor">
        <div className="error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      </div>
    )
  }

  if (!curve) {
    return (
      <div className="wave-editor">
        <div className="no-curve-container">
          <h3>No Curve Selected</h3>
          <p>Please select a curve to edit its wave data.</p>
          <button onClick={() => navigate('/curves')}>Go to Curve Admin</button>
        </div>
      </div>
    )
  }

  return (
    <div className="wave-editor">
      <div className="wave-editor-header">
        <h2>Wave Editor</h2>
        <div className="curve-info">
          <span className="curve-name">{curve["curve-name"]}</span>
          <span className="curve-type">({curve["coordinate-noise"]})</span>
        </div>
      </div>

      <div className="wave-editor-content">
        <div className="wave-data-section">
          <div className="section-header">
            <h3>Wave Data</h3>
            <div className="section-actions">
              {!isEditing ? (
                <button 
                  className="edit-btn"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Wave Data
                </button>
              ) : (
                <div className="edit-actions">
                  <SaveButton
                    onClick={handleSave}
                    isSaving={isLoading}
                    hasUnsavedChanges={hasUnsavedChanges}
                    className="save-btn"
                    title="Save wave data changes"
                  />
                  <button 
                    className="cancel-btn"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="wave-data-container">
            <div className="wave-data-info">
              <p><strong>Width:</strong> {curve["curve-width"]}</p>
              <p><strong>Data Points:</strong> {waveData.length}</p>
            </div>

            {isEditing ? (
              <div className="wave-data-editor">
                <div className="wave-data-grid">
                  {waveData.map((value, index) => (
                    <div key={index} className="wave-data-cell">
                      <label>Index {index}:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (!isNaN(val)) {
                            handleWaveDataChange(index, val)
                          }
                        }}
                        title={`Edit value at index ${index}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="wave-data-viewer">
                <div className="wave-data-grid">
                  {waveData.map((value, index) => (
                    <div key={index} className="wave-data-cell view-only">
                      <span className="cell-index">Index {index}:</span>
                      <span className="cell-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="navigation-section">
          <button 
            className="nav-btn"
            onClick={goToCurveAdmin}
          >
            ← Back to Curve Admin
          </button>
        </div>
      </div>
    </div>
  )
}

export default WaveEditor
