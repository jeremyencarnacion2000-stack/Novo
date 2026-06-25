import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { language, code, input = '' } = await request.json();

    if (!language || !code) {
      return NextResponse.json({ error: 'Language and code are required' }, { status: 400 });
    }

    // Call Piston API
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        version: '*', // Use latest version
        files: [{
          content: code
        }],
        stdin: input
      })
    });

    if (!response.ok) {
      throw new Error(`Piston API request failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      language,
      code,
      output: data.run?.output || '',
      stderr: data.run?.stderr || '',
      exit_code: data.run?.code || 0,
      execution_time: data.run?.signal || null
    });

  } catch (error) {
    console.error('Code execution error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
