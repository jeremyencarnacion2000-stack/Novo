import { NextRequest, NextResponse } from 'next/server';
import { grokAPI } from '@/lib/grok';

export async function POST(request: NextRequest) {
  try {
    const { message, history, systemPrompt, tools } = await request.json();

    console.log('Ruta generate: Solicitud recibida', {
      mensaje: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      longitudHistorial: history.length,
      longitudPromptSistema: systemPrompt?.length || 0,
      cantidadHerramientas: tools?.length || 0
    });

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await grokAPI.generateResponse(message, '', history, systemPrompt, tools);

    console.log('Ruta generate: Resultado de Grok', {
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