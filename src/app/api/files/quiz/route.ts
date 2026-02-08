import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getUser } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabaseClient';
import { getPostHogClient } from '@/lib/posthog-server';

const model = 'gemini-2.5-flash';

interface QuizItem {
  question: string;
  answer: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, contentLanguage } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Track quiz generation event in PostHog
    const user = await getUser();
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

    const systemInstruction = `
You are an AI assistant that generates quizzes from video transcripts.
Create 5 distinct question and answer pairs that test understanding of the core ideas.

CRITICAL: Return ONLY valid JSON with a "quiz" property containing an array of 5 objects.
Each object must have exactly: "question" (string) and "answer" (string).

Expected format:
{
  "quiz": [
    {"question": "Question 1?", "answer": "Answer 1"},
    {"question": "Question 2?", "answer": "Answer 2"},
    {"question": "Question 3?", "answer": "Answer 3"},
    {"question": "Question 4?", "answer": "Answer 4"},
    {"question": "Question 5?", "answer": "Answer 5"}
  ]
}

Questions should be thought-provoking and answers concise.
Generate in ${contentLanguage || 'en'} language.
`;

    const prompt = `
Video Title: ${title || 'Unknown'}

Transcript:
---
${transcript}
---

JSON Output:
`;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: systemInstruction + '\n\n' + prompt,
    });

    const resultJsonString = response.text || '';

    if (!resultJsonString) {
      return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
    }

    try {
      let cleanedResponse = resultJsonString.trim();
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsedResult = JSON.parse(cleanedResponse);

      let quizData: QuizItem[];

      if (Array.isArray(parsedResult)) {
        quizData = parsedResult;
      } else if (parsedResult.quiz && Array.isArray(parsedResult.quiz)) {
        quizData = parsedResult.quiz;
      } else if (parsedResult.questions && Array.isArray(parsedResult.questions)) {
        quizData = parsedResult.questions;
      } else {
        return NextResponse.json({ error: 'Invalid quiz structure' }, { status: 500 });
      }

      if (!quizData.every(item => typeof item.question === 'string' && typeof item.answer === 'string')) {
        return NextResponse.json({ error: 'Invalid quiz item structure' }, { status: 500 });
      }

      return NextResponse.json({ quiz: quizData }, { status: 200 });
    } catch (parseError) {
      console.error("Failed to parse quiz response:", parseError);
      return NextResponse.json({ error: 'Failed to parse quiz data' }, { status: 500 });
    }

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

    const { fileId, quiz } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    if (!quiz || !Array.isArray(quiz)) {
      return NextResponse.json({ error: 'Quiz data is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('files')
      .update({ quiz: quiz })
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select('id, video_id')
      .single();

    if (error) {
      console.error('Supabase error saving quiz:', error);
      return NextResponse.json({ error: error.message || 'Failed to save quiz' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Summary not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Quiz saved', fileId: data.id }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving quiz:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
