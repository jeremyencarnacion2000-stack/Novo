import { NextRequest, NextResponse } from 'next/server';
import { grokAPI } from '@/lib/grok';
import { chutesAPI } from '@/lib/chutes';

export async function POST(request: NextRequest) {
  try {
    const { message, history, systemPrompt, tools, model = 'grok-beta' } = await request.json();

    console.log('Ruta generate: Solicitud recibida', {
      mensaje: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      longitudHistorial: history.length,
      longitudPromptSistema: systemPrompt?.length || 0,
      cantidadHerramientas: tools?.length || 0,
      modeloSeleccionado: model
    });

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let result;

    // Determine which API to use based on model
    if (model.startsWith('chutes/')) {
      // Use Chutes API
      const chutesModel = model.replace('chutes/', ''); // e.g., "openai/gpt-oss-20b"

      if (!process.env.CHUTES_API_TOKEN) {
        return NextResponse.json(
          { error: 'CHUTES_API_TOKEN no está configurada' },
          { status: 500 }
        );
      }

      try {
        result = await chutesAPI.generateResponse(message, '', history, systemPrompt, chutesModel);
      } catch (error) {
        console.error('Error durante la llamada a chutesAPI.generateResponse():', error);
        return NextResponse.json(
          { error: `Error al generar respuesta de Chutes AI: ${error instanceof Error ? error.message : 'Error desconocido'}` },
          { status: 500 }
        );
      }
    } else {
      // Use Grok API (default)
      if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
        return NextResponse.json(
          { error: 'API key no está configurada. Configure GROK_API_KEY o XAI_API_KEY.' },
          { status: 500 }
        );
      }

      try {
        result = await grokAPI.generateResponse(message, '', history, systemPrompt, tools);
      } catch (error) {
        console.error('Error durante la llamada a grokAPI.generateResponse():', error);
        return NextResponse.json(
          { error: `Error al generar respuesta de IA: ${error instanceof Error ? error.message : 'Error desconocido'}` },
          { status: 500 }
        );
      }
    }

    console.log('Ruta generate: Resultado', {
      longitudContenido: result.content.length,
      cantidadLlamadasFuncion: result.functionCalls.length
    });

    return NextResponse.json({ content: result.content });
  } catch (error) {
    console.error('Error generating response:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}