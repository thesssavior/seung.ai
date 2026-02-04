import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { getSupabase } from '@/lib/supabaseClient';

// GET /api/folders - list user folders
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabase();
    const { data: folders, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase folders fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(folders || []);
  } catch (error) {
    console.error('Unexpected error in /api/folders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/folders - create a new folder
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: user.id, name })
    .select('id, name, created_at')
    .single();

  if (error) {
    console.error('Create folder error:', error.message);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export const dynamic = 'force-dynamic';
