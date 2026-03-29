import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getUser, getUserWithProfile } from '@/lib/supabase/auth';
import { FREE_TOKEN_LIMIT } from '@/lib/utils';
import { checkTrialLimit } from '@/lib/trial';
import { supabase } from '@/lib/supabaseClient';
import { getPostHogClient } from '@/lib/posthog-server';

const model = 'gemini-2.5-flash';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, contentLanguage, sourceType, tokenCount } = await req.json();

    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trial = await checkTrialLimit(user.id, user.profile?.plan);
    if (!trial.allowed) {
      return NextResponse.json({ error: 'trial_limit_exceeded' }, { status: 403 });
    }

    if (user.profile?.plan !== 'premium' && tokenCount > FREE_TOKEN_LIMIT) {
      return NextResponse.json({ error: 'token_limit_exceeded' }, { status: 403 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Track mindmap generation event in PostHog
    if (user?.id) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: 'mindmap_generated',
        properties: {
          content_language: contentLanguage,
        },
      });
    }

    const referenceRule = sourceType === 'pdf'
      ? `\n- For every heading EXCEPT the root (#), append the most relevant page reference at the end in the format [p.N] (e.g. "## 📌 Key Concept [p.3]"). Extract page numbers from [Page N] markers in the transcript.`
      : (sourceType === 'youtube' || sourceType === 'audio')
      ? `\n- For every heading EXCEPT the root (#), append the most relevant timestamp at the end in the format [MM:SS] or [H:MM:SS] (e.g. "## 📌 Key Concept [2:35]"). Extract timestamps from the transcript.`
      : '';

    const systemInstruction = `You generate a markdown-formatted mind map outline for learners to comprehend main points at a glance.

Rules:
- Output ONLY a markdown heading hierarchy (# ## ### ####). No other text, no code fences, no explanation.
- Every heading must start with one relevant emoji.
- Concise labels (max 4 words per heading)
- The top-level heading (#) is the root topic
- Maximum depth: 4 levels (# to ####)
- Maximum 16 total headings (including root)
- Cover the key concepts from the content${referenceRule}`;

    const prompt = `IMPORTANT: Provide the mindmap in ${contentLanguage || 'en'} language

Video Title: ${title || 'Unknown'}

Transcript:
${transcript}`;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const response = await client.models.generateContentStream({
          model,
          contents: systemInstruction + '\n\n' + prompt,
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
      },
    });

  } catch (error: any) {
    console.error('Error generating mindmap:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, mindmap } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    if (!mindmap || !mindmap.markdown) {
      return NextResponse.json({ error: 'Mindmap markdown is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('files')
      .update({ mindmap })
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select('id, video_id')
      .single();

    if (error) {
      console.error('Supabase error saving mindmap:', error);
      return NextResponse.json({ error: error.message || 'Failed to save mindmap' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mindmap saved', fileId: data.id }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving mindmap:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
