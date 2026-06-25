import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface Artifact {
  id: string;
  type: 'code' | 'file' | 'image';
  title: string;
  content: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, content, title, language } = await request.json();

    if (!type || !content) {
      return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });
    }

    // Generate artifact based on type
    let artifact: Artifact;

    switch (type) {
      case 'code':
        artifact = {
          id: `code_${Date.now()}`,
          type: 'code',
          title: title || 'Generated Code',
          content: content,
          language: language || 'javascript'
        };
        break;

      case 'file':
        artifact = {
          id: `file_${Date.now()}`,
          type: 'file',
          title: title || 'Generated File',
          content: content
        };
        break;

      case 'image':
        // For images, content could be a description or base64
        artifact = {
          id: `image_${Date.now()}`,
          type: 'image',
          title: title || 'Generated Image',
          content: content // Could be base64 or description
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid artifact type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      artifact
    });

  } catch (error) {
    console.error('Artifact generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
