import React, { useState, useEffect } from 'react'
import { apiUrl } from '../../config/environments'
import './TagManager.css'

interface Tag {
  id: string
  'tag-name': string
  'tag-description': string
  'tag-color': string
  'created-at': string
  'updated-at': string
  'usage-count-curves': number
}

interface EditingTag {
  id: string
  name: string
  description: string
  color: string
}

const TagManager: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([])
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [editingTags, setEditingTags] = useState<Map<string, EditingTag>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load all tags from API
  // Note: usage-count-curves is automatically calculated and updated by the API
  // Future: Can be extended for counting across other collections beyond curves
  const loadTags = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/tags`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTags(data.data?.tags || [])
        } else {
          setError('Failed to load tags')
        }
      } else {
        setError(`API Error: ${response.status}`)
      }
    } catch (err) {
      setError('Network error loading tags')
      console.error('Error loading tags:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load tags on component mount
  useEffect(() => {
    loadTags()
  }, [])

  // Toggle tag expansion
  const toggleTag = (tagId: string) => {
    const newExpanded = new Set(expandedTags)
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId)
      // Clear editing state when collapsing
      const newEditing = new Map(editingTags)
      newEditing.delete(tagId)
      setEditingTags(newEditing)
    } else {
      newExpanded.add(tagId)
      // Initialize editing state
      const tag = tags.find(t => t.id === tagId)
      if (tag) {
        const newEditing = new Map(editingTags)
        newEditing.set(tagId, {
          id: tagId,
          name: tag['tag-name'],
          description: tag['tag-description'] || '',
          color: tag['tag-color']
        })
        setEditingTags(newEditing)
      }
    }
    setExpandedTags(newExpanded)
  }

  // Update editing state
  const updateEditingTag = (tagId: string, field: keyof EditingTag, value: string) => {
    const newEditing = new Map(editingTags)
    const current = newEditing.get(tagId)
    if (current) {
      newEditing.set(tagId, { ...current, [field]: value })
      setEditingTags(newEditing)
    }
  }

  // Check if tag has changes
  const hasChanges = (tagId: string): boolean => {
    const tag = tags.find(t => t.id === tagId)
    const editing = editingTags.get(tagId)
    if (!tag || !editing) return false
    
    return (
      editing.name !== tag['tag-name'] ||
      editing.description !== (tag['tag-description'] || '') ||
      editing.color !== tag['tag-color']
    )
  }

  // Update tag
  const updateTag = async (tagId: string) => {
    const editing = editingTags.get(tagId)
    if (!editing) return

    try {
      const response = await fetch(`${apiUrl}/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'tag-name': editing.name,
          'tag-description': editing.description,
          'tag-color': editing.color
        })
      })

      if (response.ok) {
        // Refresh tags list
        await loadTags()
        // Clear editing state
        const newEditing = new Map(editingTags)
        newEditing.delete(tagId)
        setEditingTags(newEditing)
      } else {
        setError('Failed to update tag')
      }
    } catch (err) {
      setError('Error updating tag')
      console.error('Error updating tag:', err)
    }
  }

  // Delete tag
  const deleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? This will remove it from all curves.')) {
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/tags/${tagId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh tags list
        await loadTags()
        // Clear editing state
        const newEditing = new Map(editingTags)
        newEditing.delete(tagId)
        setEditingTags(newEditing)
        // Clear expanded state
        const newExpanded = new Set(expandedTags)
        newExpanded.delete(tagId)
        setExpandedTags(newExpanded)
      } else {
        setError('Failed to delete tag')
      }
    } catch (err) {
      setError('Error deleting tag')
      console.error('Error deleting tag:', err)
    }
  }

  return (
    <div className="tag-manager-container">
      <div className="tag-list-container">
        {isLoading && (
          <div className="loading-state">Loading tags...</div>
        )}

        {error && (
          <div className="error-state">
            <p>Error: {error}</p>
            <button onClick={loadTags} className="retry-btn">Retry</button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="tag-table">
            <div className="tag-table-header">
              <div className="tag-header-row">
                <span className="tag-col-expand"></span>
                <span className="tag-col-color">Color</span>
                <span className="tag-col-name">Name</span>
                <span className="tag-col-usage">Curve Count</span>
              </div>
            </div>

            <div className="tag-table-body">
              {tags.map((tag) => (
                <div key={tag.id} className="tag-row-container">
                  {/* Main Row */}
                  <div className="tag-row" onClick={() => toggleTag(tag.id)}>
                    <span className="tag-col-expand">
                      <span className="expand-icon">
                        {expandedTags.has(tag.id) ? '▼' : '▶'}
                      </span>
                    </span>
                    <span className="tag-col-color">
                      <div 
                        className="color-circle" 
                        style={{ backgroundColor: tag['tag-color'] }}
                      ></div>
                    </span>
                    <span className="tag-col-name">{tag['tag-name']}</span>
                    <span className="tag-col-usage">{tag['usage-count-curves'] || 0}</span>
                  </div>

                  {/* Expanded Edit Form */}
                  {expandedTags.has(tag.id) && (
                    <div className="tag-edit-form">
                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>Tag Name:</label>
                          <input
                            type="text"
                            value={editingTags.get(tag.id)?.name || ''}
                            onChange={(e) => updateEditingTag(tag.id, 'name', e.target.value)}
                            className="edit-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>Description:</label>
                          <textarea
                            value={editingTags.get(tag.id)?.description || ''}
                            onChange={(e) => updateEditingTag(tag.id, 'description', e.target.value)}
                            className="edit-textarea"
                            rows={3}
                          />
                        </div>

                        <div className="edit-field">
                          <label>Color:</label>
                          <div className="color-picker-container">
                            <input
                              type="color"
                              value={editingTags.get(tag.id)?.color || '#007acc'}
                              onChange={(e) => updateEditingTag(tag.id, 'color', e.target.value)}
                              className="color-picker"
                            />
                            <span className="color-value">
                              {editingTags.get(tag.id)?.color || '#007acc'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="edit-actions">
                        <button 
                          className={`update-btn ${!hasChanges(tag.id) ? 'disabled' : ''}`}
                          onClick={() => updateTag(tag.id)}
                          disabled={!hasChanges(tag.id)}
                        >
                          Update
                        </button>
                        <button 
                          className="delete-btn-edit"
                          onClick={() => deleteTag(tag.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tags.length === 0 && !isLoading && (
                <div className="empty-state">
                  <p>No tags found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TagManager
