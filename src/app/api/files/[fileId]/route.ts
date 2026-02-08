import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { getSupabase } from '@/lib/supabaseClient';
import { calculateTokenCount } from '@/lib/utils';

// GET /api/files/[fileId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const supabase = await getSupabase();

    // Fetch summary (RLS will filter by user_id automatically)
    const { data: summaryData, error: summaryError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (summaryError) {
      console.error('Supabase error fetching summary:', summaryError);
      return NextResponse.json({ error: summaryError.message || 'Failed to fetch summary' }, { status: 500 });
    }

    if (!summaryData) {
      return NextResponse.json({ error: 'Summary not found or access denied' }, { status: 404 });
    }

    // Fetch folder data
    let folderData = null;
    if (summaryData.folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id, name')
        .eq('id', summaryData.folder_id)
        .single();

      if (!folderError && folder) {
        folderData = folder;
      }
    }

    return NextResponse.json({
      summary: summaryData,
      folder: folderData
    });

  } catch (error: unknown) {
    console.error('Error fetching summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/files/[fileId] - Create new summary with basic metadata
export async function POST(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const {
      folderId,
      videoId,
      title,
      transcript,
      description,
      locale,
      contentLanguage,
      layout
    } = await req.json();

    if (!folderId || !videoId || !title) {
      return NextResponse.json({ error: 'Missing required fields: folderId, videoId, title' }, { status: 400 });
    }

    const input_token_count = transcript ? calculateTokenCount(transcript) : 0;

    const supabase = await getSupabase();
    const insertData = {
      id: fileId,
      folder_id: folderId,
      user_id: user.id,
      video_id: videoId,
      name: title,
      transcript: transcript,
      description: description,
      locale: locale,
      content_language: contentLanguage,
      input_token_count: input_token_count,
      layout: layout || null,
    };

    const { data: summaryData, error: summaryError } = await supabase
      .from('files')
      .insert(insertData)
      .select()
      .single();

    if (summaryError) {
      console.error('Summary creation error:', summaryError.message, summaryError.details);
      return NextResponse.json({ error: `Failed to create summary: ${summaryError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Summary created successfully',
      ...summaryData
    });

  } catch (error: unknown) {
    console.error('Error creating summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error while creating summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/files/[fileId] - Update summary metadata
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const updateData = await req.json();

    // Remove any fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.user_id;
    delete updateData.created_at;
    if (typeof updateData.layout !== 'undefined') {
      delete updateData.layout;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('files')
      .update(updateData)
      .eq('id', fileId)
      .select('id, video_id, name')
      .single();

    if (error) {
      console.error('Supabase error updating summary:', error);
      return NextResponse.json({ error: error.message || 'Failed to update summary' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Summary not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Summary updated successfully',
      ...data
    });

  } catch (error: unknown) {
    console.error('Error updating summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error while updating summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/files/[fileId]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const supabase = await getSupabase();

    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error('Supabase error deleting summary:', error);
      return NextResponse.json({ error: error.message || 'Failed to delete summary' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Summary deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error while deleting summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
