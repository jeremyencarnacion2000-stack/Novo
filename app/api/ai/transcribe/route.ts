import { NextRequest, NextResponse } from 'next/server';
import { whisperAPI } from '@/lib/whisper';

export async function POST(request: NextRequest) {
    try {
        console.log('Transcription API: Request received');

        const formData = await request.formData();
        const audioFile = formData.get('audio') as Blob;

        if (!audioFile) {
            console.error('Transcription API: No audio file in request');
            return NextResponse.json({
                error: 'No audio file provided',
                success: false
            }, { status: 400 });
        }

        console.log('Transcription API: Processing audio file', {
            size: audioFile.size,
            type: audioFile.type
        });

        const transcription = await whisperAPI.transcribeAudio(audioFile);

        console.log('Transcription API: Success', {
            transcriptionLength: transcription.length
        });

        return NextResponse.json({
            text: transcription,
            success: true
        });
    } catch (error) {
        console.error('Transcription API: Error occurred', error);

        const errorMessage = error instanceof Error ? error.message : 'Internal server error';

        return NextResponse.json(
            {
                error: errorMessage,
                success: false,
                hint: 'Verifica que WHISPER_API_KEY esté configurada en Vercel'
            },
            { status: 500 }
        );
    }
}
