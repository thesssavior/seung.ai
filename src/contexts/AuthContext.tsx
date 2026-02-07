'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import posthog from 'posthog-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const enrichUserProperties = async () => {
      try {
        const res = await fetch('/api/home/user/plan')
        const data = await res.json()
        const locale = window.location.pathname.split('/')[1] || 'ko'
        posthog.setPersonProperties({
          plan: data.plan || 'free',
          locale,
        })
      } catch {
        // Non-critical
      }
    }

    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      // Identify user in PostHog if session exists on initial load
      if (session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
        })
        previousUserIdRef.current = session.user.id
        enrichUserProperties()
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)

        // PostHog user identification and event tracking
        if (event === 'SIGNED_IN' && session?.user) {
          // Identify user in PostHog
          posthog.identify(session.user.id, {
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          })

          // Capture sign in event
          posthog.capture('user_signed_in', {
            provider: 'google',
            email: session.user.email,
          })

          previousUserIdRef.current = session.user.id
          enrichUserProperties()
        } else if (event === 'SIGNED_OUT') {
          // Capture sign out event before resetting
          posthog.capture('user_signed_out')
          posthog.reset()
          previousUserIdRef.current = null
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`
    console.log('[Auth] Signing in with Google, redirectTo:', redirectTo)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    console.log('[Auth] OAuth response:', data)
    if (error) {
      console.error('[Auth] Error signing in with Google:', error)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
