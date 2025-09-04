import React from 'react'

interface SaveButtonProps {
  onClick: () => void | Promise<void>
  isSaving: boolean
  disabled?: boolean
  hasUnsavedChanges: boolean
  className?: string
  children?: React.ReactNode
  savingText?: string
  title?: string
}

/**
 * Standardized save button component with consistent loading states
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
  onClick,
  isSaving,
  disabled = false,
  hasUnsavedChanges,
  className = 'save-button full-width',
  children,
  savingText = 'Saving...',
  title = 'Save changes'
}) => {
  // Only show button if there are unsaved changes
  if (!hasUnsavedChanges) return null

  const isDisabled = isSaving || disabled

  return (
    <button
      onClick={onClick}
      className={className}
      disabled={isDisabled}
      title={title}
    >
      {isSaving ? savingText : (children || 'Save Changes')}
    </button>
  )
}
