import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';
import { getPostHogClient } from '@/lib/posthog-server';

const model = 'gemini-2.5-flash';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, contentLanguage } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Track mindmap generation event in PostHog
    const user = await getUser();
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

    const systemInstruction = `You generate React-Flow mind-map JSON for learners to comprehend main points at a glance.
Rules:
- Use emojis and concise labels (max 4 words per node)
- Maximum 16 total nodes (including root)
- Left-to-right layout: root node at the left, children to the right
- Leaf depth limit of 3 per branch
- Root node type must be "input"`;

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
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      data: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                        },
                        required: ['label'],
                      },
                      position: {
                        type: Type.OBJECT,
                        properties: {
                          x: { type: Type.NUMBER },
                          y: { type: Type.NUMBER },
                        },
                        required: ['x', 'y'],
                      },
                      type: { type: Type.STRING },
                    },
                    required: ['id', 'data', 'position'],
                  },
                },
                edges: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      source: { type: Type.STRING },
                      target: { type: Type.STRING },
                    },
                    required: ['id', 'source', 'target'],
                  },
                },
              },
              required: ['nodes', 'edges'],
            },
          },
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
        'Content-Type': 'application/json; charset=utf-8',
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
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    if (!mindmap || !mindmap.nodes || !mindmap.edges) {
      return NextResponse.json({ error: 'Mindmap data (nodes and edges) is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('files')
      .update({ mindmap: mindmap })
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select('id, video_id')
      .single();

    if (error) {
      console.error('Supabase error saving mindmap:', error);
      return NextResponse.json({ error: error.message || 'Failed to save mindmap' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Summary not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mindmap saved', fileId: data.id }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving mindmap:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
