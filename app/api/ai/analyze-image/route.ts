import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const MAX_IMAGE_BODY_BYTES = 8_000_000;
const MAX_IMAGE_URL_LENGTH = 2_048;
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;

const imageAnalysisRequestSchema = z.object({
  imageUrl: z.string().trim().max(MAX_IMAGE_URL_LENGTH).optional(),
  imageBase64: z.string().max(MAX_IMAGE_BASE64_LENGTH).optional(),
}).strict().superRefine((value, context) => {
  if (!value.imageUrl && !value.imageBase64) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'image_required' });
  }

  if (value.imageUrl && value.imageBase64) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'single_image_source', path: ['imageUrl'] });
  }

  if (value.imageUrl) {
    try {
      const parsed = new URL(value.imageUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'unsupported_image_url', path: ['imageUrl'] });
      }
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_image_url', path: ['imageUrl'] });
    }
  }
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`ai:analyze:${session.user.id}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BODY_BYTES) {
      return NextResponse.json({ error: 'Image payload is too large' }, { status: 413 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsedRequest = imageAnalysisRequestSchema.safeParse(rawBody);
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Invalid image request' }, { status: 400 });
    }
    const { imageUrl, imageBase64 } = parsedRequest.data;

    // Inicializar cliente de Google Vision AI
    const client = new ImageAnnotatorClient();

    let image;
    if (imageBase64) {
      // Si es base64, decodificar
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      image = { content: base64Data };
    } else {
      // Si es URL, usar source
      image = { source: { imageUri: imageUrl } };
    }

    // Realizar análisis de imagen
    const [result] = await client.annotateImage({
      image,
      features: [
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
        { type: 'TEXT_DETECTION' },
        { type: 'IMAGE_PROPERTIES' },
        { type: 'SAFE_SEARCH_DETECTION' }
      ],
    });

    // Extraer resultados
    const labels = result.labelAnnotations?.map(label => ({
      description: label.description,
      score: label.score
    })) || [];

    const objects = result.localizedObjectAnnotations?.map(obj => ({
      name: obj.name,
      score: obj.score,
      boundingPoly: obj.boundingPoly
    })) || [];

    const text = result.textAnnotations?.[0]?.description || '';

    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors?.slice(0, 5).map(color => ({
      color: color.color,
      score: color.score
    })) || [];

    const safeSearch = result.safeSearchAnnotation ? {
      adult: result.safeSearchAnnotation.adult,
      spoof: result.safeSearchAnnotation.spoof,
      medical: result.safeSearchAnnotation.medical,
      violence: result.safeSearchAnnotation.violence,
      racy: result.safeSearchAnnotation.racy
    } : null;

    // Generar descripción general
    const description = labels.length > 0
      ? `Esta imagen contiene: ${labels.slice(0, 3).map(l => l.description).join(', ')}`
      : 'No se pudieron detectar etiquetas en la imagen';

    return NextResponse.json({
      description,
      labels,
      objects,
      text,
      colors,
      safeSearch
    });

  } catch {
    console.error('Error analizando imagen.');
    return NextResponse.json(
      { error: 'Unable to analyze this image right now' },
      { status: 500 }
    );
  }
}
