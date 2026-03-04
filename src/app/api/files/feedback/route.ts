import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getUser } from '@/lib/supabase/auth';

const VALID_RATINGS = ['good', 'bad'] as const;
const VALID_REASONS = [
  'incorrect',
  'notAsked',
  'slow',
  'style',
  'safety',
  'other',
] as const;

export async function POST(req: Request) {
  try {
    const user = await getUser();
    const userId = user?.id || null;

    const body = await req.json();
    const { fileId, rating, reason, detail } = body;

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    if (!rating || !VALID_RATINGS.includes(rating)) {
      return NextResponse.json({ error: 'rating must be "good" or "bad".' }, { status: 400 });
    }

    if (reason && !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason.' }, { status: 400 });
    }

    const feedbackData: {
      file_id: string;
      user_id: string | null;
      rating: string;
      reason?: string;
      detail?: string;
    } = {
      file_id: fileId,
      user_id: userId,
      rating,
    };

    if (reason) feedbackData.reason = reason;
    if (detail && typeof detail === 'string') feedbackData.detail = detail.trim();

    const { data, error } = await supabase
      .from('summary_feedback')
      .insert([feedbackData])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: data?.[0] }, { status: 201 });
  } catch (error: any) {
    console.error('API Route error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
