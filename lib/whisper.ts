// Whisper API Integration for Speech-to-Text
// Supports both OpenAI Whisper and Replicate Whisper

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const whisperAPI = {
    transcribeAudio: async (audioBlob: Blob): Promise<string> => {
        const WHISPER_API_KEY = process.env.WHISPER_API_KEY;

        if (!WHISPER_API_KEY) {
            throw new Error('WHISPER_API_KEY environment variable is not set');
        }

        try {
            // Create FormData for audio upload
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-1');
            formData.append('language', 'es'); // Spanish by default

            console.log('Whisper API: Sending audio for transcription', {
                audioSize: audioBlob.size,
                audioType: audioBlob.type
            });

            const response = await fetch(WHISPER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHISPER_API_KEY}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Whisper API error:', errorText);
                throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            console.log('Whisper API: Transcription received', {
                textLength: data.text?.length || 0
            });

            return data.text || '';
        } catch (error) {
            console.error('Error calling Whisper API:', error);
            throw error;
        }
    }
};
