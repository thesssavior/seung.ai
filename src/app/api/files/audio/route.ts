import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { calculateTokenCount } from '@/lib/utils';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const locale = (formData.get('locale') as string) || 'en';
    const contentLanguage = (formData.get('contentLanguage') as string) || locale;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/webm',
      'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/m4a',
      'video/webm', // MediaRecorder often outputs video/webm with audio
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported audio format: ${file.type}` }, { status: 400 });
    }

    // Transcribe with OpenAI Whisper (verbose_json for segment timestamps)
    const langMap: Record<string, string> = { ko: 'ko', es: 'es', ja: 'ja', zh: 'zh', fr: 'fr', de: 'de' };
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: langMap[contentLanguage] || undefined,
    });

    // Format transcript with [MM:SS] timestamps, merging every 4 segments into one chunk
    const segments = (transcription as any).segments;
    let transcriptText: string;
    if (segments && Array.isArray(segments) && segments.length > 0) {
      const merged: { start: number; text: string }[] = [];
      for (let i = 0; i < segments.length; i++) {
        if (i % 4 === 0) {
          merged.push({ start: Math.floor(segments[i].start), text: (segments[i].text || '').trim() });
        } else {
          merged[merged.length - 1].text += ' ' + (segments[i].text || '').trim();
        }
      }
      transcriptText = merged.map((chunk) => {
        const hours = Math.floor(chunk.start / 3600);
        const minutes = Math.floor((chunk.start % 3600) / 60);
        const seconds = chunk.start % 60;
        const timestamp = hours > 0
          ? `[${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`
          : `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
        return `${timestamp} ${chunk.text}`;
      }).join('\n');
    } else {
      transcriptText = (transcription as any).text || '';
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json({ error: 'No speech detected in the audio' }, { status: 400 });
    }

    const title = file.name.replace(/\.[^.]+$/, '') || 'Audio Recording';
    const tokenCount = calculateTokenCount(transcriptText);

    // Upload audio to Supabase Storage
    let audioUrl: string | null = null;
    if (user?.id) {
      const fileBuffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop() || 'webm';
      const fileName = `${user.id}/${Date.now()}_recording.${ext}`;

      const { error: uploadError } = await supabase
        .storage
        .from('audios')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Audio upload error:', uploadError.message);
      } else {
        const { data: urlData } = supabase
          .storage
          .from('audios')
          .getPublicUrl(fileName);
        audioUrl = urlData.publicUrl;
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
        transcript: transcriptText,
        description: audioUrl || '',
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
      transcript: transcriptText,
      title,
      description: '',
      tokenCount,
      fetcher: 'audio',
      fileId,
      audioUrl,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /files/audio] Error:', error.message);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
