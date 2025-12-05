import { NextRequest, NextResponse } from 'next/server';
import { whisperAPI } from '@/lib/whisper';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as Blob;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        console.log('Transcription API: Received audio file', {
            size: audioFile.size,
            type: audioFile.type
        });

        const transcription = await whisperAPI.transcribeAudio(audioFile);

        return NextResponse.json({
            text: transcription,
            success: true
        });
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Internal server error',
                success: false
            },
            { status: 500 }
        );
    }
}
