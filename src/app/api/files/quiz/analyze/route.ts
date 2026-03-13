import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const model = 'gemini-2.5-flash';

export async function POST(req: NextRequest) {
  try {
    const { quizItems, answers, title, contentLanguage } = await req.json();

    if (!quizItems || !answers) {
      return NextResponse.json({ error: 'quizItems and answers are required' }, { status: 400 });
    }

    // Build the prompt with quiz data
    const freeResponseQuestions = quizItems
      .map((item: any, index: number) => ({ item, index }))
      .filter(({ item }: any) => item.type === 'free_response');

    const allQuestions = quizItems.map((item: any, index: number) => {
      const userAnswer = answers[index] || '(no answer)';
      let isCorrect: string;
      if (item.type === 'free_response') {
        isCorrect = 'needs grading';
      } else {
        isCorrect = userAnswer === item.correctAnswer ? 'correct' : 'incorrect';
      }
      return `Q${index + 1} [${item.type}] (tag: ${item.tag || 'none'}): ${item.question}\nCorrect answer: ${item.correctAnswer}\nUser answer: ${userAnswer}\nStatus: ${isCorrect}`;
    }).join('\n\n');

    const lang = contentLanguage || 'ko';

    const systemInstruction = `You are an AI tutor analyzing quiz results. You will:
1. Grade each free-response question by comparing the user's answer to the correct answer. Be lenient — if the user demonstrates understanding of the core concept, mark it correct even if wording differs.
2. Write "highlights" as a JSON array of short bullet strings (2-4 bullets, each under 15 words) about what the user understood well.
3. Write "focusAreas" as a JSON array of short bullet strings (2-4 bullets, each under 15 words) about what needs review.

Keep bullets concise — core info only, no filler. Write in ${lang} language.`;

    const prompt = `Video title: ${title || 'Unknown'}

Quiz results:
${allQuestions}

Grade the free-response questions and provide analysis.`;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: systemInstruction + '\n\n' + prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            freeResponseGrades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.NUMBER },
                  correct: { type: Type.BOOLEAN },
                },
                required: ['index', 'correct'],
              },
            },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['freeResponseGrades', 'highlights', 'focusAreas'],
        },
      },
    });

    const resultJsonString = response.text || '';
    if (!resultJsonString) {
      return NextResponse.json({ error: 'Failed to analyze quiz' }, { status: 500 });
    }

    const parsed = JSON.parse(resultJsonString);
    return NextResponse.json(parsed, { status: 200 });
  } catch (error: any) {
    console.error('Error analyzing quiz:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
