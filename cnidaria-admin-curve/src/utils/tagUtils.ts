/**
 * Tag utility functions for the frontend
 * Handles tag ID resolution and management
 */

export interface Tag {
  id: string;
  'tag-name': string;
  'tag-description': string;
  'tag-color': string;
  'created-at': string;
  'updated-at': string;
  'usage-count-curves': number;
}

export interface Curve {
  id: string;
  'curve-name': string;
  'curve-description': string;
  'curve-tags': string[];  // Tag IDs for linked relationships
  'curve-width': number;
  'curve-height': number;
  'curve-type': string;
  'curve-index-scaling': number;
  'curve-data': number[];
  'generator-noise-type'?: string;
  'generator-noise-setting'?: Record<string, any>;
  'generator-top-shelf'?: number;
  'generator-bottom-shelf'?: number;
  'generator-value-fill'?: number;
  'generator-value-offset'?: number;
  'coordinate-noise-strength'?: number;
  'coordinate-noise-scale'?: number;
  'coordinate-noise-seed'?: number;
  'created_at': string;
  'updated_at': string;
}

export interface TagResolutionResult {
  tags: Tag[];
  'not-found': string[];
  'total-requested': number;
  'total-resolved': number;
  'total-not-found': number;
}

/**
 * Resolve multiple tag IDs to tag objects
 */
export async function resolveTagIds(tagIds: string[], apiUrl: string): Promise<TagResolutionResult> {
  try {
    const response = await fetch(`${apiUrl}/api/tags/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tagIds })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    }
    
    throw new Error('Failed to resolve tag IDs');
  } catch (error) {
    console.error('Error resolving tag IDs:', error);
    return {
      tags: [],
      'not-found': tagIds,
      'total-requested': tagIds.length,
      'total-resolved': 0,
      'total-not-found': tagIds.length
    };
  }
}

/**
 * Get all available tags
 */
export async function getAllTags(apiUrl: string): Promise<Tag[]> {
  try {
    const response = await fetch(`${apiUrl}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data.tags;
      }
    }
    throw new Error('Failed to fetch tags');
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

/**
 * Create a new tag
 */
export async function createTag(tagData: Partial<Tag>, apiUrl: string): Promise<Tag | null> {
  try {
    const response = await fetch(`${apiUrl}/api/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tagData)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    }
    
    throw new Error('Failed to create tag');
  } catch (error) {
    console.error('Error creating tag:', error);
    return null;
  }
}

/**
 * Update an existing tag
 */
export async function updateTag(tagId: string, tagData: Partial<Tag>, apiUrl: string): Promise<Tag | null> {
  try {
    const response = await fetch(`${apiUrl}/api/tags/${tagId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tagData)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    }
    
    throw new Error('Failed to update tag');
  } catch (error) {
    console.error('Error updating tag:', error);
    return null;
  }
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string, apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/tags/${tagId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      const data = await response.json();
      return data.success;
    }
    
    throw new Error('Failed to delete tag');
  } catch (error) {
    console.error('Error deleting tag:', error);
    return false;
  }
}

/**
 * Get tag usage statistics
 */
export async function getTagUsage(tagId: string, apiUrl: string): Promise<any> {
  try {
    const response = await fetch(`${apiUrl}/api/tags/${tagId}/usage`);
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    }
    throw new Error('Failed to get tag usage');
  } catch (error) {
    console.error('Error getting tag usage:', error);
    return null;
  }
}

/**
 * Helper function to get tag display name from tag ID or tag object
 */
export function getTagDisplayName(tag: string | Tag): string {
  if (typeof tag === 'string') {
    // If it's a string, it might be an ID or a name
    // For now, return as-is (this will be resolved by the parent component)
    return tag;
  }
  return tag['tag-name'];
}

/**
 * Helper function to get tag color from tag ID or tag object
 */
export function getTagColor(tag: string | Tag): string {
  if (typeof tag === 'string') {
    // Default color for unresolved tags
    return '#6b7280';
  }
  return tag['tag-color'];
}

/**
 * Helper function to get tag names from a curve
 * Note: This function requires tag IDs to be resolved to names separately
 * Use resolveTagIds() to get the actual tag names
 */
export function getCurveTagNames(curve: Curve): string[] {
  // This function now just returns the tag IDs
  // Tag names should be resolved using resolveTagIds() when needed
  return curve['curve-tags'] || [];
}

/**
 * Helper function to get tag IDs from a curve
 */
export function getCurveTagIds(curve: Curve): string[] {
  return curve['curve-tags'] || [];
}
