import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioServer } from '@/lib/whisper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rl = rateLimit(`ai:transcribe:${session.user.id}`, 10, 60_000);
        if (!rl.allowed) return rateLimitResponse(rl);

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

        const transcription = await transcribeAudioServer(audioFile);

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
