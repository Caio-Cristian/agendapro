import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  const refreshProfile = async () => {
    if (!supabase) {
      setProfile(null)
      return
    }
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
    setSession(currentSession)
    if (!currentSession) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .maybeSingle()
    if (error) throw error
    setProfile(data)
  }

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    void client.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        const { data: profileData, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle()
        if (error) console.error('Não foi possível carregar o perfil:', error.message)
        if (active) setProfile(profileData)
      }
      if (active) setLoading(false)
    })
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      } else {
        window.setTimeout(() => {
          void client
            .from('profiles')
            .select('*')
            .eq('id', nextSession.user.id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) console.error('Não foi possível carregar o perfil:', error.message)
              setProfile(data)
              setLoading(false)
            })
        }, 0)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile }),
    [session, profile, loading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
