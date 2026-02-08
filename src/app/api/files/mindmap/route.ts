import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
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

    const systemInstruction = `
    You are an API that returns **only** valid JSON for a React-Flow mind-map.
    Goal → Give learners a concise, birds-eye structure of the content so they can comprehend the main points at a glance.

    Return only valid JSON (no markdown, no code blocks).
    Schema: {
      "nodes": RFNode[],
      "edges": RFEdge[]
    }

    Each RFNode must have unique "id" and a "position".
    Each RFEdge must reference existing node ids.
    The deepest level of nodes (leaf nodes) for any branch should be limited to 3 items.
    Use emojis and concise labels (max 4 words)
    Maximum 16 total nodes (including root)
    Left to right layout: root node at the left, children to the right
    Example:
    {"nodes":[{"id":"root","data":{"label":"📚 Central"},"position":{"x":0,"y":0},"type":"input"}],"edges":[]}
    `;

    const prompt = `
      IMPORTANT: Provide the mindmap in ${contentLanguage || 'en'} language

      Video Title: ${title || 'Unknown'}

      Transcript:
      --- --- --- --- ---
      ${transcript}
      --- --- --- --- ---

      JSON Output:
    `;

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: systemInstruction + '\n\n' + prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const resultJsonString = response.text || '';

    if (!resultJsonString) {
      return NextResponse.json({ error: 'Failed to generate mind map' }, { status: 500 });
    }

    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = resultJsonString.trim();
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const mindmapData = JSON.parse(cleanedResponse);
      if (!mindmapData.nodes || !mindmapData.edges) {
        console.error("Mindmap response missing nodes or edges:", mindmapData);
        return NextResponse.json({ error: 'Invalid mind map structure' }, { status: 500 });
      }
      return NextResponse.json(mindmapData, { status: 200 });
    } catch (parseError) {
      console.error("Failed to parse mind map response:", parseError, "Raw response:", resultJsonString);
      return NextResponse.json({ error: 'Failed to parse mind map data' }, { status: 500 });
    }

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
