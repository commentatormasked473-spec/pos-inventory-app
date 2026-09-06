import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { email, password, fullName, role, businessId, branchId } = await request.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Create the actual login account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Link them in app_users
    const { error: appUserError } = await supabaseAdmin.from('app_users').insert({
      auth_id: authData.user.id,
      full_name: fullName,
      role,
      business_id: businessId || null,
      branch_id: branchId || null,
    })

    if (appUserError) {
      return NextResponse.json({ error: appUserError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}