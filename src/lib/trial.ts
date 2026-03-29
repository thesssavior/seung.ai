import { supabase } from '@/lib/supabaseClient';
import { FREE_TRIAL_LIMIT } from '@/lib/utils';

/**
 * Check if a free user has remaining trial generations.
 * Returns { allowed: true } or { allowed: false, used, limit }.
 */
export async function checkTrialLimit(userId: string, plan: string | null | undefined) {
  if (plan === 'premium') {
    return { allowed: true, used: 0, limit: FREE_TRIAL_LIMIT };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('free_generations_used')
    .eq('id', userId)
    .single();

  const used = profile?.free_generations_used ?? 0;

  if (used >= FREE_TRIAL_LIMIT) {
    return { allowed: false, used, limit: FREE_TRIAL_LIMIT };
  }

  return { allowed: true, used, limit: FREE_TRIAL_LIMIT };
}

/**
 * Increment the free_generations_used counter for a user.
 * Call this after a successful file generation for free users.
 */
export async function incrementTrialUsage(userId: string, plan: string | null | undefined) {
  if (plan === 'premium') return;

  await supabase.rpc('increment_free_generations', { user_id_input: userId });
}
