import { supabase } from './supabase'

const CACHED_USER_KEY = 'pos_cached_app_user'

export async function getCurrentAppUser() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return null

  if (navigator.onLine) {
    const { data, error } = await supabase
      .from('app_users')
      .select('id, business_id, branch_id, full_name, role')
      .eq('auth_id', session.user.id)
      .single()

    if (!error && data) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data))
      return data
    }
  }

  const cached = localStorage.getItem(CACHED_USER_KEY)
  if (cached) {
    return JSON.parse(cached)
  }

  return null
}

export async function logout() {
  await supabase.auth.signOut()
  localStorage.removeItem(CACHED_USER_KEY)
  window.location.href = '/login'
}