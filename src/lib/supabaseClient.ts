import { createClient as createServerClient } from './supabase/server'

// Re-export server client for backwards compatibility with existing API routes
// This uses the anon key with RLS instead of service role key
export async function getSupabase() {
  return await createServerClient()
}

// For API routes that need admin access (webhooks, etc.)
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

// Legacy export - will be deprecated, use getSupabase() instead
export const supabase = supabaseAdmin
