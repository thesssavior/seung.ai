import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getPostHogClient } from '@/lib/posthog-server';

export async function DELETE() {
  try {
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized. User not authenticated.' }, { status: 401 });
    }

    const userId = user.id;
    console.log('Deleting user:', userId);

    // Track account deletion event in PostHog before deleting user data
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: 'account_deleted',
      properties: {
        email: user.email,
      },
    });

    // Delete related data using admin client (to bypass RLS for cleanup)
    // Step 1: Delete summaries by user_id
    const { error: deleteUserSummariesError } = await supabaseAdmin
      .from('summaries')
      .delete()
      .eq('user_id', userId);

    if (deleteUserSummariesError) {
      return NextResponse.json({ error: 'Failed to delete user summaries', details: deleteUserSummariesError.message }, { status: 500 });
    }

    // Step 2: Delete folders by user_id
    const { error: deleteFoldersError } = await supabaseAdmin
      .from('folders')
      .delete()
      .eq('user_id', userId);

    if (deleteFoldersError) {
      return NextResponse.json({ error: 'Failed to delete folders', details: deleteFoldersError.message }, { status: 500 });
    }

    // Step 3: Delete profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('Failed to delete profile:', deleteProfileError);
      return NextResponse.json({ error: 'Failed to delete profile', details: deleteProfileError.message }, { status: 500 });
    }

    // Step 4: Delete the auth user (requires admin API)
    const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
      console.error('Failed to delete auth user:', deleteAuthUserError);
      return NextResponse.json({ error: 'Failed to delete auth user', details: deleteAuthUserError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User account deleted successfully.' }, { status: 200 });

  } catch (error: unknown) {
    console.error('API Route /api/home/user/delete error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'An unexpected error occurred during account deletion.', details: message }, { status: 500 });
  }
}
