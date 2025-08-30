import React, { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderContextType {
  statusMessage: ReactNode | null
  generalInfo: ReactNode | null
  saveActions: ReactNode | null
  setStatusMessage: (message: ReactNode | null) => void
  setGeneralInfo: (info: ReactNode | null) => void
  setSaveActions: (actions: ReactNode | null) => void
  clearHeader: () => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export const useHeader = () => {
  const context = useContext(HeaderContext)
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider')
  }
  return context
}

interface HeaderProviderProps {
  children: ReactNode
}

export const HeaderProvider: React.FC<HeaderProviderProps> = ({ children }) => {
  const [statusMessage, setStatusMessage] = useState<ReactNode | null>(null)
  const [generalInfo, setGeneralInfo] = useState<ReactNode | null>(null)
  const [saveActions, setSaveActions] = useState<ReactNode | null>(null)

  const clearHeader = () => {
    setStatusMessage(null)
    setGeneralInfo(null)
    setSaveActions(null)
  }

  const value: HeaderContextType = {
    statusMessage,
    generalInfo,
    saveActions,
    setStatusMessage,
    setGeneralInfo,
    setSaveActions,
    clearHeader
  }

  return (
    <HeaderContext.Provider value={value}>
      {children}
    </HeaderContext.Provider>
  )
}
