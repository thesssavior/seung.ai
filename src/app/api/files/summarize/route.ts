import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
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
      sourceType,
    } = await req.json();

    const videoTitle = title || '';
    const isPdf = sourceType === 'pdf';
    const isAudio = sourceType === 'audio';

    if (!transcriptText) {
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
          video_id: videoId || null,
          content_language: contentLanguage,
          token_count: tokenCount,
          source_type: sourceType || 'youtube',
        },
      });
    }

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const encoder = new TextEncoder();

    const audioSystemPrompt = `You are an audio content summarizer. Summarize the audio transcript in logical order with clear, accurate, and detailed explanations. For each section, use markdown formatting: **bold** for key terms, _italics_ for emphasis, \`code\` for technical terms, and bullet or numbered lists for structured information. Be thorough but concise. No greetings or filler.`;
    const pdfSystemPrompt = `You are a document summarizer. Summarize the document content in logical order with clear, accurate, and detailed explanations. For each section, use markdown formatting: **bold** for key terms, _italics_ for emphasis, \`code\` for technical terms, and bullet or numbered lists for structured information. Be thorough but concise. No greetings or filler.`;

    const systemPrompt = isPdf ? pdfSystemPrompt : isAudio ? audioSystemPrompt : messages.systemPrompts;
    const userPrompt = isPdf ? `Please summarize this document:` : isAudio ? `Please summarize this audio recording:` : messages.userPrompts;
    const contentLabel = isPdf ? 'Document Title' : isAudio ? 'Audio Title' : 'Video Title';
    const descriptionSection = isPdf || isAudio ? '' : `\n\nVideo Description: ${videoDescription}`;
    const textLabel = isPdf ? 'Document Text' : 'Transcript';

    const stream = new ReadableStream({
      async start(controller) {
        const response = await client.models.generateContentStream({
          model: model,
          contents: `Important: Respond in ${contentLanguage} language. ${systemPrompt}\n\n${userPrompt}\n\n${contentLabel}: ${videoTitle}${descriptionSection}\n\n${textLabel}:\n${transcriptText}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: isPdf
              ? {
                  type: Type.OBJECT,
                  properties: {
                    intro: {
                      type: Type.STRING,
                      description: 'Brief 2-3 sentence overview of the document content',
                    },
                    body: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          emoji: {
                            type: Type.STRING,
                            description: 'A single relevant emoji for this section',
                          },
                          heading: {
                            type: Type.STRING,
                            description: 'Concise subheading for this section',
                          },
                          content: {
                            type: Type.STRING,
                            description: 'Detailed summary using markdown: bullet points, numbered lists, **bold**, _italics_, `code` where appropriate',
                          },
                        },
                        required: ['emoji', 'heading', 'content'],
                      },
                    },
                    outro: {
                      type: Type.STRING,
                      description: 'Concluding paragraph summarizing key takeaways',
                    },
                  },
                  required: ['intro', 'body', 'outro'],
                }
              : {
                  type: Type.OBJECT,
                  properties: {
                    intro: {
                      type: Type.STRING,
                      description: 'Brief 2-3 sentence overview of the video content',
                    },
                    body: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          emoji: {
                            type: Type.STRING,
                            description: 'A single relevant emoji for this section',
                          },
                          heading: {
                            type: Type.STRING,
                            description: 'Concise subheading for this section',
                          },
                          timestamp: {
                            type: Type.STRING,
                            description: 'Timestamp from the transcript in MM:SS format, or H:MM:SS if the video is over an hour',
                          },
                          content: {
                            type: Type.STRING,
                            description: 'Detailed summary using markdown: bullet points, numbered lists, **bold**, _italics_, `code` where appropriate',
                          },
                        },
                        required: ['emoji', 'heading', 'timestamp', 'content'],
                      },
                    },
                    outro: {
                      type: Type.STRING,
                      description: 'Concluding paragraph summarizing key takeaways',
                    },
                  },
                  required: ['intro', 'body', 'outro'],
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
        'input_token_count': `${tokenCount}`,
        'video_title': encodeURIComponent(`${videoTitle}`),
      }
    });
  } catch (error: any) {
    console.error("Gemini API error:", error.message);
    return NextResponse.json({ error: `${error.message}` }, { status: 500 });
  }
}
