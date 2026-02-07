import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import messages from '@/messages/en.json';
import { getPostHogClient } from '@/lib/posthog-server';
import { getUser } from '@/lib/supabase/auth';

const model = 'gemini-2.5-flash';

export async function POST(req: Request) {
  try {
    const {
      videoId,
      contentLanguage = 'ko',
      transcriptText,
      title,
      videoDescription,
      tokenCount,
    } = await req.json();

    const videoTitle = title || '';

    if (!videoId || !transcriptText) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Track summary generation event in PostHog
    const user = await getUser();
    if (user?.id) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: 'summary_generated',
        properties: {
          video_id: videoId,
          content_language: contentLanguage,
          token_count: tokenCount,
        },
      });
    }

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const response = await client.models.generateContentStream({
          model: model,
          contents: `Important: Respond in ${contentLanguage} language. ${messages.systemPrompts}\n\n${messages.userPrompts}\n\nVideo Title: ${videoTitle}\n\nVideo Description: ${videoDescription}\n\nTranscript:\n${transcriptText}`,
        });

        for await (const chunk of response) {
          const content = chunk.text;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'input_token_count': `${tokenCount}`,
        'video_title': encodeURIComponent(`${videoTitle}`),
      }
    });
  } catch (error: any) {
    console.error("Gemini API error:", error.message);
    return NextResponse.json({ error: `${error.message}` }, { status: 500 });
  }
}
