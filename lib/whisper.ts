const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const whisperAPI = {
    transcribeAudio: async (audioBlob: Blob): Promise<string> => {
        const WHISPER_API_KEY = process.env.WHISPER_API_KEY;

        if (!WHISPER_API_KEY) {
            console.error('WHISPER_API_KEY is not configured');
            throw new Error('WHISPER_API_KEY environment variable is not set');
        }

        try {
            const formData = new FormData();
            const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

            formData.append('file', audioFile);
            formData.append('model', 'whisper-1');
            formData.append('language', 'es');

            console.log('Whisper API: Sending audio', {
                size: audioBlob.size,
                type: audioBlob.type
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
                console.error('Whisper API error:', {
                    status: response.status,
                    error: errorText
                });

                if (response.status === 401) {
                    throw new Error('API key inválida');
                } else if (response.status === 400) {
                    throw new Error('Formato de audio no soportado');
                }

                throw new Error(`Whisper API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Whisper API: Success', { length: data.text?.length || 0 });

            return data.text || '';
        } catch (error) {
            console.error('Whisper API error:', error);
            throw error;
        }
    }
};
