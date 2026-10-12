import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

// Parsing is CPU/memory intensive (especially for PDFs), so keep this
// authenticated and bounded before the buffer reaches a parser.
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 10_000;

// Dynamic imports to avoid issues during build
async function parsePDF(buffer: Buffer): Promise<string> {
    const pdf = await import('pdf-parse');
    // Handle both default and direct function call for CJS compatibility
    const pdfParse = (pdf as any).default || pdf;
    const data = await pdfParse(buffer);
    return data.text;
}

async function parseDOCX(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | string | null;

        if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function' || typeof file.size !== 'number' || typeof file.name !== 'string') {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_DOCUMENT_BYTES) {
            return NextResponse.json({ error: 'Document is too large. Maximum size is 10 MB.' }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toLowerCase();
        let text = '';

        if (fileName.endsWith('.pdf')) {
            text = await parsePDF(buffer);
        } else if (fileName.endsWith('.docx')) {
            text = await parseDOCX(buffer);
        } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            text = buffer.toString('utf-8');
        } else {
            return NextResponse.json({
                error: 'Unsupported file type. Supported: PDF, DOCX, TXT, MD'
            }, { status: 400 });
        }

        // Truncate if too long (max 10000 characters for context)
        const truncated = text.length > MAX_TEXT_LENGTH;
        const content = truncated ? text.substring(0, MAX_TEXT_LENGTH) + '\n\n[... documento truncado ...]' : text;

        return NextResponse.json({
            success: true,
            content,
            fileName: file.name,
            fileSize: file.size,
            truncated,
            originalLength: text.length
        });

    } catch {
        console.error('[Document Parse] Error.');
        return NextResponse.json({ error: 'Unable to parse this document right now' }, { status: 500 });
    }
}
