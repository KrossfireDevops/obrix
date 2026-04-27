// supabase/functions/crear-usuario/index.ts
// Crea un usuario en Supabase Auth sin requerir confirmación de email.
// Usa el service_role key que solo está disponible en el servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar que quien llama es admin_empresa o super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con el JWT del usuario que hace la llamada (para verificar su rol)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar rol del usuario actual
    const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabaseUser
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || !['admin_empresa', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Sin permisos para crear usuarios' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Leer datos del nuevo usuario
    const body = await req.json()
    const { email, password, fullName, role, puesto, phone } = body

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Cliente admin con service_role (solo disponible en el servidor)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. Crear usuario en Auth — sin email de confirmación
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // ← Confirmar automáticamente sin enviar email
      user_metadata: {
        full_name:  fullName,
        role,
        company_id: callerProfile.company_id,
      },
    })

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Crear/actualizar perfil en users_profiles
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id:         newUser.user.id,
        company_id: callerProfile.company_id,
        full_name:  fullName,
        role,
        puesto:     puesto  || null,
        phone:      phone   || null,
        is_active:  true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data: profile, error: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})