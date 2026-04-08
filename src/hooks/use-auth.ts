'use client'

import { useState, useEffect } from 'react'
import { AuthConfig, UserProfile } from '@/lib/types'

const STORAGE_KEY = 'azuhours_auth'
const USER_KEY = 'azuhours_user'

export function useAuth() {
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const storedUser = sessionStorage.getItem(USER_KEY)
      if (stored) setConfig(JSON.parse(stored))
      if (storedUser) setUser(JSON.parse(storedUser))
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  function login(authConfig: AuthConfig, userProfile: UserProfile) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authConfig))
    sessionStorage.setItem(USER_KEY, JSON.stringify(userProfile))
    setConfig(authConfig)
    setUser(userProfile)
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(USER_KEY)
    setConfig(null)
    setUser(null)
  }

  return { config, user, loaded, login, logout }
}
