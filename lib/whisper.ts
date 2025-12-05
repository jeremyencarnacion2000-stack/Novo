```
// Whisper API Integration for Speech-to-Text
// Supports OpenAI Whisper API

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const whisperAPI = {
  transcribeAudio: async (audioBlob: Blob): Promise<string> => {
    const WHISPER_API_KEY = process.env.WHISPER_API_KEY;

    if (!WHISPER_API_KEY) {
      console.error('WHISPER_API_KEY is not configured');
      throw new Error('WHISPER_API_KEY environment variable is not set. Please add it in Vercel dashboard.');
    }

    try {
      // Create FormData for audio upload
      const formData = new FormData();
      
      // Convert blob to file with proper extension
      // OpenAI Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, or webm
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'es'); // Spanish by default
      formData.append('response_format', 'json');

      console.log('Whisper API: Sending audio for transcription', {
        audioSize: audioBlob.size,
        audioType: audioBlob.type,
        fileName: 'recording.webm'
      });

      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ WHISPER_API_KEY } `,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        if (response.status === 401) {
          throw new Error('API key inválida. Verifica WHISPER_API_KEY en Vercel.');
        } else if (response.status === 400) {
          throw new Error('Formato de audio no soportado o archivo corrupto.');
        }
        
        throw new Error(`Whisper API error: ${ response.status } ${ response.statusText } `);
      }

      const data = await response.json();
      
      console.log('Whisper API: Transcription received', {
        textLength: data.text?.length || 0,
        text: data.text
      });

      return data.text || '';
    } catch (error) {
      console.error('Error calling Whisper API:', error);
      throw error;
    }
  }
};
```
