import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_param = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/'

  console.log('[Auth Callback] Origin:', origin)
  console.log('[Auth Callback] Code present:', !!code)
  console.log('[Auth Callback] Error param:', error_param)
  console.log('[Auth Callback] Error description:', error_description)

  if (error_param) {
    console.error('[Auth Callback] OAuth error:', error_param, error_description)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error_param}&description=${encodeURIComponent(error_description || '')}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Exchange result - User:', data?.user?.email)
    console.log('[Auth Callback] Exchange error:', error?.message)

    if (!error) {
      console.log('[Auth Callback] Success! Redirecting to:', `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[Auth Callback] Session exchange failed:', error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed&description=${encodeURIComponent(error.message)}`)
  }

  console.error('[Auth Callback] No code provided')
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
}
