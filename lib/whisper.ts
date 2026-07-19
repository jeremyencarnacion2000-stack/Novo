// Client-side transcription helper. Deliberately does NOT call OpenAI
// directly — it POSTs the audio to our own /api/ai/transcribe route, which
// holds the Whisper key server-side (process.env.WHISPER_API_KEY). This is
// why the mic no longer asks the user to paste an API key: the key lives on
// the server, the browser only ships the audio blob.
export const whisperAPI = {
    transcribeAudio: async (audioBlob: Blob): Promise<string> => {
        const formData = new FormData();
        const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' });
        formData.append('audio', audioFile);

        const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            let msg = `Transcription failed (${response.status})`;
            try {
                const data = await response.json();
                if (data?.error) msg = data.error;
            } catch { /* non-JSON error body */ }
            throw new Error(msg);
        }

        const data = await response.json();
        return data.text || '';
    }
};

// Server-only Whisper call. Used by /api/ai/transcribe — kept out of the
// client helper above so the browser never sees the key and there's no
// client→route→client recursion.
export async function transcribeAudioServer(audioBlob: Blob): Promise<string> {
    const key = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!key) {
        throw new Error('WHISPER_API_KEY no está configurada en el servidor.');
    }

    const formData = new FormData();
    const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' });
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}` },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) throw new Error('API key de Whisper inválida (servidor)');
        if (response.status === 400) throw new Error('Formato de audio no soportado');
        throw new Error(`Whisper API error: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.text || '';
}
