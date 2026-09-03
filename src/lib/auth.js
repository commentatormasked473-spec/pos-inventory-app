import { supabase } from './supabase'

export async function getCurrentAppUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('app_users')
    .select('id, business_id, branch_id, full_name, role')
    .eq('auth_id', user.id)
    .single()

  if (error) return null
  return data
}