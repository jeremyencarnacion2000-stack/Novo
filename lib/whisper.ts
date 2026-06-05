const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const whisperAPI = {
    transcribeAudio: async (audioBlob: Blob): Promise<string> => {
        let whisperApiKey = '';
        if (typeof window !== 'undefined') {
            whisperApiKey = localStorage.getItem('novo_whisper_api_key') || localStorage.getItem('novo_openai_api_key') || '';
        }
        if (!whisperApiKey) {
            whisperApiKey = process.env.NEXT_PUBLIC_WHISPER_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.WHISPER_API_KEY || '';
        }
        if (!whisperApiKey) {
            // Check gemini key fallback if none other is configured, just in case
            if (typeof window !== 'undefined') {
                whisperApiKey = localStorage.getItem('novo_gemini_api_key') || '';
            }
            if (!whisperApiKey) {
                whisperApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
            }
        }

        if (!whisperApiKey) {
            console.error('Whisper API Key is not configured');
            throw new Error('Por favor, configura tu API Key de Whisper en los ajustes del Copiloto.');
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
                    'Authorization': `Bearer ${whisperApiKey}`,
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
