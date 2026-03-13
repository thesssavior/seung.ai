import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getUser, getUserWithProfile } from '@/lib/supabase/auth';
import { FREE_TOKEN_LIMIT } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { getPostHogClient } from '@/lib/posthog-server';

const model = 'gemini-2.5-flash';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, contentLanguage, sourceType, tokenCount } = await req.json();
    console.log('[Quiz API POST] Received:', { title, contentLanguage, sourceType, transcriptLength: transcript?.length });

    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.profile?.plan !== 'premium' && tokenCount > FREE_TOKEN_LIMIT) {
      return NextResponse.json({ error: 'token_limit_exceeded' }, { status: 403 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Track quiz generation event in PostHog
    console.log('[Quiz API POST] User:', user?.id);
    if (user?.id) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: 'quiz_generated',
        properties: {
          content_language: contentLanguage,
        },
      });
    }

    const referenceInstruction = sourceType === 'pdf'
      ? `\n- page: For each question, identify which page in the transcript (marked with [Page N]) is most relevant. Set the "page" field to that page number (integer).`
      : sourceType === 'youtube' || sourceType === 'audio'
      ? `\n- timestamp: For each question, identify the most relevant timestamp from the transcript. Set the "timestamp" field to that time in MM:SS or H:MM:SS format.`
      : '';

    const systemInstruction = `You are an AI assistant that generates quizzes from transcripts.
Create exactly 5 questions that test understanding of the core ideas.

Question type mix:
- About 3 multiple-choice questions (type: "mcq") with exactly 4 options
- About 1 true/false question (type: "true_false") with options ["True", "False"]
- About 1 free-response question (type: "free_response") with no options

Rules:
- For mcq: provide exactly 4 plausible options. Set correctAnswerIndex to the 0-based index of the correct option (0-3).
- For true_false: options must be ["True", "False"]. Set correctAnswerIndex to 0 for True, 1 for False.
- For free_response: do not include options. correctAnswer is a concise model answer (correctAnswerIndex is ignored).
- tag: a short topic/category label for the question (2-4 words).
- explanation: 1-2 sentence explanation of why the correct answer is correct.${referenceInstruction}
- Questions should be thought-provoking and varied.`;

    const prompt = `Important: Respond in ${contentLanguage || 'ko'} language.

Video Title: ${title || 'Unknown'}

Transcript:
${transcript}`;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: systemInstruction + '\n\n' + prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['mcq', 'true_false', 'free_response'] },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  correctAnswerIndex: { type: Type.INTEGER },
                  tag: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  ...(sourceType === 'pdf' ? { page: { type: Type.INTEGER } } : {}),
                  ...((sourceType === 'youtube' || sourceType === 'audio') ? { timestamp: { type: Type.STRING } } : {}),
                },
                required: ['question', 'type', 'correctAnswer', 'tag', 'explanation'],
              },
            },
          },
          required: ['quiz'],
        },
      },
    });

    const resultJsonString = response.text || '';

    if (!resultJsonString) {
      return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
    }

    const parsedResult = JSON.parse(resultJsonString);

    // Post-process: resolve correctAnswer from correctAnswerIndex for MCQ/TF
    if (parsedResult.quiz && Array.isArray(parsedResult.quiz)) {
      for (const item of parsedResult.quiz) {
        if (item.options && item.options.length > 0 && item.correctAnswerIndex != null) {
          const idx = item.correctAnswerIndex;
          if (idx >= 0 && idx < item.options.length) {
            item.correctAnswer = item.options[idx];
          }
        }
        delete item.correctAnswerIndex;
      }
    }

    console.log('[Quiz API POST] Generated quiz:', { count: parsedResult.quiz?.length, firstQuestion: parsedResult.quiz?.[0]?.question?.slice(0, 50) });
    return NextResponse.json({ quiz: parsedResult.quiz }, { status: 200 });

  } catch (error: any) {
    console.error('Error generating quiz:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, quiz, quizResults } = await req.json();
    console.log('[Quiz API PATCH] Received:', { fileId, userId: user.id, quizLength: quiz?.length, hasResults: !!quizResults });

    if (!fileId) {
      console.log('[Quiz API PATCH] Missing fileId');
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    if (!quiz && !quizResults) {
      console.log('[Quiz API PATCH] Missing quiz data and quiz results');
      return NextResponse.json({ error: 'Quiz data or quiz results required' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (quiz && Array.isArray(quiz)) {
      updatePayload.quiz = quiz;
    }
    if (quizResults) {
      updatePayload.quiz_results = quizResults;
    }

    const { data, error } = await supabase
      .from('files')
      .update(updatePayload)
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select('id, video_id')
      .single();

    console.log('[Quiz API PATCH] Supabase result:', { data, error: error?.message });

    if (error) {
      console.error('[Quiz API PATCH] Supabase error saving quiz:', error);
      return NextResponse.json({ error: error.message || 'Failed to save quiz' }, { status: 500 });
    }

    if (!data) {
      console.log('[Quiz API PATCH] No data returned - not found or unauthorized');
      return NextResponse.json({ error: 'Summary not found or unauthorized' }, { status: 404 });
    }

    console.log('[Quiz API PATCH] Quiz saved successfully for file:', data.id);
    return NextResponse.json({ message: 'Quiz saved', fileId: data.id }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving quiz:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
