import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileName } = await req.json();
    const ext = (fileName || 'file.pdf').split('.').pop() || 'pdf';
    const storagePath = `${user.id}/${Date.now()}.${ext}`;

    // Create a signed URL so the client can upload directly to Supabase Storage
    const { data, error: signError } = await supabase
      .storage
      .from('pdfs')
      .createSignedUploadUrl(storagePath);

    if (signError || !data) {
      console.error('Signed URL error:', signError?.message);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    const { data: urlData } = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
      pdfUrl: urlData.publicUrl,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[API /files/pdf/upload] Error:', error.message);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
