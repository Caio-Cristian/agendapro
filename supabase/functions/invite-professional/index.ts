import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !projectUrl || !anonKey || !serviceRoleKey) {
    return response({ error: 'server_configuration_error' }, 500)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return response({ error: 'invalid_json' }, 400)
  }
  if (!isInvitePayload(payload)) return response({ error: 'invalid_invitation_details' }, 400)

  const userClient = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) return response({ error: 'authentication_required' }, 401)

  const { data: actor, error: profileError } = await userClient
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || actor?.role !== 'admin' || !actor.business_id) {
    return response({ error: 'business_admin_required' }, 403)
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    payload.email,
    { data: { full_name: payload.full_name } },
  )
  if (inviteError || !invitation.user) {
    return response({ error: inviteError?.message ?? 'invitation_failed' }, 400)
  }

  const { data: professionalId, error: assignmentError } = await userClient.rpc(
    'assign_invited_professional',
    {
      p_business_id: actor.business_id,
      p_profile_id: invitation.user.id,
    },
  )
  if (assignmentError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invitation.user.id)
    if (cleanupError) console.error('Invite cleanup failed:', cleanupError.message)
    return response({ error: 'invite_assignment_failed', detail: assignmentError.message }, 409)
  }
  return response({ professional_id: professionalId }, 201)
})

function isInvitePayload(value: unknown): value is { email: string; full_name: string } {
  if (typeof value !== 'object' || value === null || !('email' in value) || !('full_name' in value))
    return false
  const email = value.email
  const fullName = value.full_name
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    typeof fullName === 'string' &&
    fullName.trim().length >= 2 &&
    fullName.trim().length <= 120
  )
}

function response(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
