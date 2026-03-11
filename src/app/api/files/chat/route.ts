import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getPostHogClient } from '@/lib/posthog-server';
import { getUser } from '@/lib/supabase/auth';

const model = 'gemini-2.5-flash';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      videoTitle,
      summary,
      transcript,
      contentLanguage,
      conversationHistory,
      sourceType,
    } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Track chat message event in PostHog
    const user = await getUser();
    if (user?.id) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: 'chat_message_sent',
        properties: {
          content_language: contentLanguage,
          has_conversation_history: !!(conversationHistory && conversationHistory.length > 0),
        },
      });
    }

    // Build context from available data
    const isPdf = sourceType === 'pdf';
    let contentContext = '';

    if (videoTitle) {
      contentContext += `${isPdf ? 'Document' : 'Video'} Title: "${videoTitle}"\n\n`;
    }

    if (summary) {
      contentContext += `${isPdf ? 'Document' : 'Video'} Summary:\n${summary}\n\n`;
    }

    if (transcript) {
      contentContext += `Full ${isPdf ? 'Text' : 'Transcript'}:\n${transcript}\n\n`;
    }

    const systemInstruction = isPdf
      ? `
You are an AI assistant specialized in helping users understand and discuss document content. You have access to the document's title, summary, and full text.

Your role is to:
1. Answer questions about the document content accurately and helpfully
2. Provide insights and explanations based on the text
3. Help users understand key concepts, themes, and takeaways
4. Reference specific parts of the document when relevant
5. Encourage deeper thinking and learning about the content

Guidelines:
- Be conversational and engaging
- Use the document context to provide specific, relevant answers
- If you don't have enough information, be honest about limitations
- Respond in ${contentLanguage || 'en'} language
- Keep responses focused (2-4 paragraphs typically)

Document Context:
${contentContext}
`
      : `
You are an AI assistant specialized in helping users understand and discuss video content. You have access to the video's title, summary, and full transcript.

Your role is to:
1. Answer questions about the video content accurately and helpfully
2. Provide insights and explanations based on the transcript
3. Help users understand key concepts, themes, and takeaways
4. Reference specific parts of the video when relevant
5. Encourage deeper thinking and learning about the content

Guidelines:
- Be conversational and engaging
- Use the video context to provide specific, relevant answers
- If you don't have enough information, be honest about limitations
- Respond in ${contentLanguage || 'en'} language
- Keep responses focused (2-4 paragraphs typically)

Video Context:
${contentContext}
`;

    // Build conversation for Gemini
    let conversationContent = systemInstruction + '\n\n';

    // Add recent conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-6);
      recentHistory.forEach((msg: ChatMessage) => {
        if (msg.role === 'user') {
          conversationContent += `User: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
          conversationContent += `Assistant: ${msg.content}\n\n`;
        }
      });
    }

    // Add current user message
    conversationContent += `User: ${message}\n\nAssistant:`;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.models.generateContentStream({
            model,
            contents: conversationContent,
          });

          for await (const chunk of response) {
            const content = chunk.text;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
