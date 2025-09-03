import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirebase } from '../auth/firebase'
import { environment, apiUrl } from '../config/environments'

export type Role = 'admin' | 'user'

interface AuthState {
  user: User | null
  role: Role | null
  approved: boolean
  loading: boolean
  error?: string | null
}

interface AuthContextType extends AuthState {
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function fetchApproval(idToken: string): Promise<{ approved: boolean; role: Role | null }> {
  // Dev bypass: auto-approve in development environment
  if (environment === 'development') {
    return { approved: true, role: 'admin' }
  }
  
  try {
    const res = await fetch(`${apiUrl}/auth/approval`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` }
    })
    if (!res.ok) return { approved: false, role: null }
    const data = await res.json().catch(() => ({}))
    return { approved: !!data.approved, role: (data.role as Role) || null }
  } catch {
    return { approved: false, role: null }
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ user: null, role: null, approved: false, loading: true, error: null })

  useEffect(() => {
    let unsub: (() => void) | undefined
    (async () => {
      const { auth, provider, isConfigured } = await getFirebase()
      if (!isConfigured || !auth || !provider) {
        setState(s => ({ ...s, loading: false, error: 'Firebase not configured' }))
        return
      }
      unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setState({ user: null, role: null, approved: false, loading: false, error: null })
          return
        }
        const token = await u.getIdToken()
        const { approved, role } = await fetchApproval(token)
        setState({ user: u, role, approved, loading: false, error: null })
      })
    })()
    return () => { if (unsub) unsub() }
  }, [])

  const login = async () => {
    const { auth, provider, isConfigured } = await getFirebase()
    if (!isConfigured || !auth || !provider) {
      const msg = 'Firebase not configured'
      setState(s => ({ ...s, error: msg }))
      throw new Error(msg)
    }
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    const { auth } = await getFirebase()
    if (!auth) return
    await signOut(auth)
  }

  const value = useMemo<AuthContextType>(() => ({ ...state, login, logout }), [state.user, state.role, state.approved, state.loading, state.error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


