import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { getSupabase } from '@/lib/supabaseClient';

// GET /api/files/chat/messages?fileId=xxx
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = req.nextUrl.searchParams.get('fileId');
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('chat_histories')
      .select('messages')
      .eq('summary_id', fileId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching chat history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data?.messages || [] });
  } catch (error: unknown) {
    console.error('Error in chat messages GET:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/files/chat/messages
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, messages } = await req.json();

    if (!fileId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'fileId and messages array are required' }, { status: 400 });
    }

    const supabase = await getSupabase();

    const { error } = await supabase
      .from('chat_histories')
      .upsert(
        {
          summary_id: fileId,
          user_id: user.id,
          messages,
        },
        { onConflict: 'summary_id, user_id' }
      );

    if (error) {
      console.error('Error saving chat history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in chat messages POST:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
