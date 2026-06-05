import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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
        const maxLength = 10000;
        const truncated = text.length > maxLength;
        const content = truncated ? text.substring(0, maxLength) + '\n\n[... documento truncado ...]' : text;

        return NextResponse.json({
            success: true,
            content,
            fileName: file.name,
            fileSize: file.size,
            truncated,
            originalLength: text.length
        });

    } catch (error) {
        console.error('[Document Parse] Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to parse document'
        }, { status: 500 });
    }
}
