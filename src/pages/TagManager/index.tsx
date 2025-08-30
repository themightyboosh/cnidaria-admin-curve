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
  'tag-usage': Record<string, string[]> // Map of object-type to array of document IDs
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
  // Note: tag-usage tracks which objects use each tag
  // Future: Can be extended for counting across other collections beyond curves
  const loadTags = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/tags`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Sort tags by creation date (newest first)
          const sortedTags = (data.data?.tags || []).sort((a: Tag, b: Tag) => {
            const dateA = new Date(a['created-at']).getTime()
            const dateB = new Date(b['created-at']).getTime()
            return dateB - dateA // Descending order (newest first)
          })
          setTags(sortedTags)
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

  // Convert to kebab-case format
  const toKebabCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }

  // Update editing state
  const updateEditingTag = (tagId: string, field: keyof EditingTag, value: string) => {
    const newEditing = new Map(editingTags)
    const current = newEditing.get(tagId)
    if (current) {
      // Convert name field to kebab-case
      const processedValue = field === 'name' ? toKebabCase(value) : value
      newEditing.set(tagId, { ...current, [field]: processedValue })
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
      const response = await fetch(`${apiUrl}/tags/${tagId}`, {
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

  // Generate unique tag name based on count
  const generateUniqueTagName = (): string => {
    const baseName = 'tag'
    let counter = tags.length + 1
    let tagName = `${baseName}-${counter}`
    
    // Check if name already exists and increment counter
    while (tags.some(tag => tag['tag-name'] === tagName)) {
      counter++
      tagName = `${baseName}-${counter}`
    }
    
    return tagName
  }

  // Create new tag
  const createNewTag = async () => {
    const newTagId = `temp-${Date.now()}` // Temporary ID for new tag
    const uniqueTagName = generateUniqueTagName()
    const newTag: EditingTag = {
      id: newTagId,
      name: uniqueTagName,
      description: 'Tag Description',
      color: '#007acc'
    }

    try {
      const response = await fetch(`${apiUrl}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'tag-name': newTag.name,
          'tag-description': newTag.description,
          'tag-color': newTag.color
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Create tag response:', data)
        if (data.success && data.data && data.data.id) {
          // Refresh tags list
          await loadTags()
          // Expand the newly created tag
          const newExpanded = new Set(expandedTags)
          newExpanded.add(data.data.id)
          setExpandedTags(newExpanded)
          // Set editing state for the new tag
          const newEditing = new Map(editingTags)
          newEditing.set(data.data.id, {
            id: data.data.id,
            name: newTag.name,
            description: newTag.description,
            color: newTag.color
          })
          setEditingTags(newEditing)
        } else {
          setError(`Failed to create tag: ${data.message || 'Invalid response format'}`)
        }
      } else {
        const errorText = await response.text()
        setError(`Failed to create tag: ${response.status} ${response.statusText} - ${errorText}`)
      }
    } catch (err) {
      setError('Error creating tag')
      console.error('Error creating tag:', err)
    }
  }

  // Delete tag
  const deleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? This will remove it from all curves.')) {
      return
    }

    try {
      const response = await fetch(`${apiUrl}/tags/${tagId}`, {
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
                    <span className="tag-col-name">
                      <span className="tag-name-text">{tag['tag-name']}</span>
                      <div 
                        className="color-circle" 
                        style={{ backgroundColor: tag['tag-color'] }}
                      ></div>
                    </span>
                    <span className="tag-col-usage">
                      {Object.values(tag['tag-usage'] || {}).reduce((total, docIds) => total + docIds.length, 0)}
                    </span>
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

                        {/* Tag Usage Information */}
                        <div className="edit-field">
                          <label>Usage:</label>
                          <div className="tag-usage-info">
                            {tag['tag-usage'] && Object.keys(tag['tag-usage']).length > 0 ? (
                              <div className="usage-breakdown">
                                {Object.entries(tag['tag-usage']).map(([objectType, docIds]) => (
                                  <div key={objectType} className="usage-item">
                                    <span className="usage-type">{objectType}:</span>
                                    <span className="usage-count">{docIds.length} items</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="no-usage">Not used by any objects</span>
                            )}
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

            {/* Create New Tag Button */}
            <div className="create-tag-section">
              <button 
                className="create-tag-btn"
                onClick={createNewTag}
                style={{
                  backgroundColor: '#4a90e2',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  width: '100%',
                  marginTop: '20px'
                }}
              >
                + Create New Tag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TagManager
