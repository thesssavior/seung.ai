import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';
import { getUser } from '@/lib/supabase/auth';

export async function GET(req: NextRequest) {
  // First try to get user from auth
  const user = await getUser();

  // If no authenticated user, try email query param (for backwards compatibility)
  const email = req.nextUrl.searchParams.get('email');

  const supabase = await getSupabase();

  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, free_generations_used')
      .eq('id', user.id)
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({
      plan: data?.plan || 'free',
      free_generations_used: data?.free_generations_used ?? 0,
    }), { status: 200 });
  }

  if (email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('email', email)
      .single();

    if (error) {
      return new Response(JSON.stringify({ plan: 'free' }), { status: 200 });
    }
    return new Response(JSON.stringify({ plan: data?.plan || 'free' }), { status: 200 });
  }

  return new Response(JSON.stringify({ plan: 'free' }), { status: 200 });
}
