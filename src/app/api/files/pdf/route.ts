import { NextResponse } from 'next/server';
import { calculateTokenCount } from '@/lib/utils';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const locale = (formData.get('locale') as string) || 'en';
    const contentLanguage = (formData.get('contentLanguage') as string) || locale;
    const folderId = formData.get('folderId') as string | null;
    const extractedText = formData.get('extractedText') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: 'No text could be extracted from the PDF' }, { status: 400 });
    }

    const title = file.name.replace(/\.pdf$/i, '') || 'Untitled PDF';
    const tokenCount = calculateTokenCount(extractedText);

    const user = await getUser();

    // Upload PDF to Supabase Storage
    let pdfUrl: string | null = null;
    if (user?.id) {
      const fileBuffer = await file.arrayBuffer();
      const fileName = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase
        .storage
        .from('pdfs')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        console.error('PDF upload error:', uploadError.message);
      } else {
        const { data: urlData } = supabase
          .storage
          .from('pdfs')
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }
    }

    // Create DB record if user is logged in with a folder
    let fileId = null;
    if (folderId && user?.id) {
      const insertData = {
        folder_id: folderId,
        user_id: user.id,
        video_id: null,
        summary: '',
        name: title,
        input_token_count: tokenCount,
        output_token_count: 0,
        transcript: extractedText,
        description: pdfUrl || '',
        locale: locale,
        content_language: contentLanguage || locale,
        layout: 'default',
      };

      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .insert(insertData)
        .select('id')
        .single();

      if (fileError) {
        console.error('File creation error:', fileError.message);
      } else {
        fileId = fileData.id;
      }
    }

    return NextResponse.json({
      transcript: extractedText,
      title,
      description: '',
      tokenCount,
      fetcher: 'pdf',
      fileId,
      pdfUrl,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /files/pdf] Error:', error.message);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
