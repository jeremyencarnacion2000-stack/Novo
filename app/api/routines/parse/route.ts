import { NextRequest, NextResponse } from 'next/server';
import { groqAPI } from '@/lib/groq';
import { openRouterAPI } from '@/lib/openrouter';
import { chutesAPI } from '@/lib/chutes';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const systemPrompt = `
      You are an expert productivity and fitness assistant. Your task is to extract a structured plan from the provided text, which may include daily schedules, multiple routines, and checklists.
      
      Return ONLY a valid JSON object with the following structure:
      {
        "planning": {
          "title": "Main title of the plan",
          "schedule": [
            { 
              "time": "e.g. 7:00 – 7:15", 
              "activity": "Activity name", 
              "notes": "Any specific instructions or sub-tasks for this time slot" 
            }
          ]
        },
        "routines": [
          {
            "name": "Specific Routine Name (e.g. Rutina de Voz Grave)",
            "description": "Detailed instructions or purpose",
            "type": "fitness | stretching | voice | mental | other",
            "frequency": "e.g. Daily",
            "duration": 15, // estimated minutes
            "exercises": [
              {
                "name": "Exercise/Step Name",
                "sets": 3,
                "reps": "10-12",
                "notes": "Specific instructions"
              }
            ],
            "days": [ // Only if it's a multi-day routine like a gym plan
              {
                "name": "Monday",
                "exercises": [...]
              }
            ]
          }
        ],
        "trackers": [
          { "name": "Habit name to track", "type": "habit | metric", "goal": "e.g. 100 reps" }
        ],
        "checklists": [
          { "text": "Task description", "category": "e.g. Misión Diaria" }
        ]
      }

      CRITICAL RULES:
      1. **SPLIT ROUTINES**: If you see "RUTINA DE ESTIRAMIENTOS", "RUTINA DE GYM", and "RUTINA DE VOZ GRAVE", you MUST create THREE separate objects in the "routines" array. Do NOT merge them.
      2. **GYM ROUTINES**: For routines with specific days (Lunes, Martes, etc.), use the "days" array inside that routine object.
      3. **PLANNING**: Extract the "PLAN ELITE" or "HORARIO" sections into the "planning" object.
      4. **LANGUAGE**: Keep all names and descriptions in Spanish as found in the text.
      5. **FORMAT**: Return ONLY raw JSON. No markdown tags.
    `;

    let result;
    let usedProvider = 'groq';

    try {
      console.log('Attempting parsing with Groq...');
      result = await groqAPI.generateResponse(
        `Parse this document:\n\n${text}`,
        '',
        [],
        systemPrompt,
        'openai/gpt-oss-120b'
      );
    } catch (groqError) {
      console.error('Groq API failed, trying OpenRouter:', groqError);
      usedProvider = 'openrouter';
      try {
        result = await openRouterAPI.generateResponse(
          `Parse this document:\n\n${text}`,
          '',
          [],
          systemPrompt,
          'openai/gpt-oss-20b:free'
        );
      } catch (orError) {
        console.error('OpenRouter API failed, trying Chutes:', orError);
        usedProvider = 'chutes';
        result = await chutesAPI.generateResponse(
          `Parse this document:\n\n${text}`,
          '',
          [],
          systemPrompt,
          'openai/gpt-oss-20b'
        );
      }
    }

    // Clean up the response if it contains <think> tags or markdown
    let cleanedResult = (result.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    cleanedResult = cleanedResult.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsedData = JSON.parse(cleanedResult);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', cleanedResult);
      // Fallback to a basic regex parser if LLM fails
      return NextResponse.json(parseWithRegex(text));
    }

  } catch (error) {
    console.error('Error in routine parse route:', error);
    return NextResponse.json({ error: 'Failed to parse routine' }, { status: 500 });
  }
}

function parseWithRegex(text: string) {
  // Basic fallback parser
  const lines = text.split('\n');
  const name = lines[0]?.trim() || 'Imported Routine';
  const description = lines.slice(1, 5).join(' ').trim();

  const tasks = lines
    .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
    .map(line => ({ text: line.replace(/^[•-]\s*/, '').trim(), category: 'Misión' }));

  return {
    planning: {
      title: name,
      schedule: []
    },
    routines: [
      {
        name,
        description: description || 'Imported via Fallback Parser',
        type: 'fitness',
        frequency: 'Daily',
        duration: 60,
        exercises: []
      }
    ],
    trackers: [],
    checklists: tasks
  };
}
