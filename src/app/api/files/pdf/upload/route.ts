import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop() || 'pdf';
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from('pdfs')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError.message);
      return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
    }

    const { data: urlData } = supabase
      .storage
      .from('pdfs')
      .getPublicUrl(fileName);

    return NextResponse.json({ pdfUrl: urlData.publicUrl }, { status: 200 });
  } catch (error: any) {
    console.error('[API /files/pdf/upload] Error:', error.message);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
