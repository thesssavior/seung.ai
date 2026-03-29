import { NextResponse } from 'next/server';
import { calculateTokenCount } from '@/lib/utils';
import { getUserWithProfile } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';
import { checkTrialLimit, incrementTrialUsage } from '@/lib/trial';

export async function POST(req: Request) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trial = await checkTrialLimit(user.id, user.profile?.plan);
    if (!trial.allowed) {
      return NextResponse.json({ error: 'trial_limit_exceeded' }, { status: 403 });
    }

    const { extractedText, fileName, locale = 'en', contentLanguage, folderId, pdfUrl } = await req.json();

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: 'No text could be extracted from the PDF' }, { status: 400 });
    }

    const title = (fileName || 'Untitled.pdf').replace(/\.pdf$/i, '') || 'Untitled PDF';
    const tokenCount = calculateTokenCount(extractedText);

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

    await incrementTrialUsage(user.id, user.profile?.plan);

    return NextResponse.json({
      transcript: extractedText,
      title,
      description: '',
      tokenCount,
      fetcher: 'pdf',
      fileId,
      pdfUrl: pdfUrl || null,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /files/pdf] Error:', error.message);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
