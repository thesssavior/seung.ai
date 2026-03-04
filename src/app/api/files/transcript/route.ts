import { NextResponse } from 'next/server';
import { Supadata, type Transcript } from '@supadata/js'
import {
  formatTranscript,
  fetchYoutubeInfo
} from '@/lib/youtube-utils';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import esMessages from '@/messages/es.json';
import { calculateTokenCount } from '@/lib/utils';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { videoId, locale = 'ko', contentLanguage, folderId, fileId: clientFileId } = await req.json();
    const messages = locale === 'ko' ? koMessages : locale === 'es' ? esMessages : enMessages;

    if (!videoId) {
      return NextResponse.json({ error: messages.error }, { status: 400 });
    }

    let title = '';
    let description = '';
    let formattedTranscriptText = '';
    let fetcherUsed = 'unknown';

    const supadata = new Supadata({
      apiKey: process.env.SUPADATA_API_KEY || '',
    });

    // Language priority: 1. contentLanguage, 2. locale (system lang), 3. English fallback
    const langsToTry = [...new Set(
      [contentLanguage, locale, 'en'].filter((l): l is string => !!l && l.trim() !== '')
    )];

    try {
      let transcriptFetched = false;

      // Try each language in priority order
      for (const lang of langsToTry) {
        try {
          const transcript = await supadata.youtube.transcript({
            videoId,
            lang,
          });
          const standardTranscript = Array.isArray(transcript.content) ? transcript.content : [];
          if (standardTranscript.length === 0) {
            throw new Error(`Empty transcript for lang=${lang}`);
          }
          formattedTranscriptText = formatTranscript(standardTranscript, 'offset');
          fetcherUsed = "supadata";
          transcriptFetched = true;
          break;
        } catch (langError: any) {
          console.warn(`Supadata transcript for ${videoId} with lang=${lang} failed: ${langError.message}`);
        }
      }

      // Last resort: fetch without lang parameter (auto-select)
      if (!transcriptFetched) {
        console.warn(`All preferred languages failed for ${videoId}, fetching without lang parameter.`);
        const transcript = await supadata.youtube.transcript({ videoId });
        const standardTranscript = Array.isArray(transcript.content) ? transcript.content : [];
        if (standardTranscript.length === 0) {
          throw new Error('Supadata returned empty transcript content');
        }
        formattedTranscriptText = formatTranscript(standardTranscript, 'offset');
        fetcherUsed = "supadata";
      }
    } catch (supadataError: any) {
      console.warn(
        `Supadata transcript fetch for ${videoId} failed: ${supadataError.message}.`
      );
    }

    try {
        const videoInfo = await fetchYoutubeInfo(videoId);
        if (videoInfo) {
          title = videoInfo.title;
          description = videoInfo.description;
        }
    } catch (e: any) {
    console.warn(`Failed to fetch video info for ${videoId}: ${e.message}. Proceeding without it.`);
    }


    // Check if transcript is empty (considering different fetcher formats)
    const transcriptEmpty = fetcherUsed === "supadata"
      ? !formattedTranscriptText || formattedTranscriptText.trim().length === 0
      : true;

    if (transcriptEmpty) {
      console.warn(`Transcript for ${videoId} resulted in empty items, possibly disabled.`);
      return NextResponse.json({ error: messages.transcriptDisabled }, { status: 400 });
    }

    const tokenCount = calculateTokenCount(formattedTranscriptText);

    // If folderId is provided, create a DB row with empty summary
    let fileId = null;
    if (folderId) {
      const user = await getUser();
      if (user?.id) {
        const insertData = {
          ...(clientFileId ? { id: clientFileId } : {}),
          folder_id: folderId,
          user_id: user.id,
          video_id: videoId,
          summary: '', // Empty - will be filled by streaming
          name: title || 'Untitled',
          input_token_count: tokenCount,
          output_token_count: 0,
          transcript: formattedTranscriptText,
          description: description,
          locale: locale,
          content_language: contentLanguage || locale,
          layout: 'default',
        };

        const { data: summaryData, error: summaryError } = await supabase
          .from('files')
          .insert(insertData)
          .select('id')
          .single();

        if (summaryError) {
          console.error('Summary creation error:', summaryError.message);
          // Don't fail the request, just don't return fileId
        } else {
          fileId = summaryData.id;
        }
      }
    }

    return NextResponse.json({
      transcript: formattedTranscriptText,
      title: title,
      description: description,
      tokenCount: tokenCount,
      fetcher: fetcherUsed,
      fileId: fileId, // Will be null for guests or if no folderId
    }, { status: 200 });

  } catch (error: any) {
    console.error("[API /summaries/transcript] General error:", error.message);
    const messagesForError = error.locale === 'ko' ? koMessages : error.locale === 'es' ? esMessages : enMessages;
    return NextResponse.json({ error: messagesForError.error || 'An unexpected error occurred.' }, { status: 500 });
  }
}
