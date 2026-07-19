import { splitSseLines, parseFinalSseLine } from '../sse-buffer';

// Regression: ISSUE — the chatbot never rendered AI responses ("nunca
// responde") even though curl against /api/ai/stream worked. Root cause:
// the client split each raw network chunk on '\n' with no carry-over
// buffer, so any `data: {...}` frame straddling a chunk boundary was
// silently dropped. Found by /qa on 2026-07-19.
describe('splitSseLines', () => {
    it('parses a frame that arrives whole in one chunk', () => {
        const { lines, buffer } = splitSseLines('data: {"content":"hola"}\n\n', '');
        expect(lines).toEqual(['data: {"content":"hola"}', '']);
        expect(buffer).toBe('');
    });

    it('reproduces the production bug: a frame split mid-JSON across two chunks', () => {
        // The exact failure mode — 'data: {"content":"hol' arrives in one
        // network chunk, 'a"}\n\n' in the next. The old code (no carry-over
        // buffer) would try to JSON.parse '{"content":"hol' on its own,
        // fail silently in an empty catch, and drop the frame entirely.
        const chunk1 = 'data: {"content":"hol';
        const chunk2 = 'a"}\n\n';

        const first = splitSseLines(chunk1, '');
        // Nothing is a complete line yet — the whole thing is carried forward.
        expect(first.lines).toEqual([]);
        expect(first.buffer).toBe(chunk1);

        const second = splitSseLines(chunk2, first.buffer);
        // The carried-over partial line + the rest of chunk2 reassembles the
        // full frame as a complete line.
        expect(second.lines).toEqual(['data: {"content":"hola"}', '']);
        expect(JSON.parse(second.lines[0].slice(6))).toEqual({ content: 'hola' });
    });

    it('carries a split frame across three chunks, not just two', () => {
        let buffer = ''
        const chunks = ['data: {"con', 'tent":"a', 'bc"}\n\n']
        let allLines: string[] = []
        for (const chunk of chunks) {
            const result = splitSseLines(chunk, buffer)
            buffer = result.buffer
            allLines = allLines.concat(result.lines)
        }
        const dataLine = allLines.find(l => l.startsWith('data: '))
        expect(dataLine).toBeDefined()
        expect(JSON.parse(dataLine!.slice(6))).toEqual({ content: 'abc' })
    })

    it('handles multiple complete frames in a single chunk', () => {
        const { lines, buffer } = splitSseLines('data: {"content":"a"}\n\ndata: {"content":"b"}\n\n', '');
        const dataLines = lines.filter(l => l.startsWith('data: '));
        expect(dataLines).toHaveLength(2);
        expect(buffer).toBe('');
    });
});

describe('parseFinalSseLine', () => {
    it('parses a final frame that never got a trailing newline (stream just closed)', () => {
        const result = parseFinalSseLine('data: {"content":"final"}');
        expect(result).toEqual({ content: 'final' });
    });

    it('returns null for [DONE]', () => {
        expect(parseFinalSseLine('data: [DONE]')).toBeNull();
    });

    it('returns null for an empty or non-data buffer', () => {
        expect(parseFinalSseLine('')).toBeNull();
        expect(parseFinalSseLine('not a data line')).toBeNull();
    });

    it('returns null instead of throwing on malformed JSON', () => {
        expect(parseFinalSseLine('data: {not valid json')).toBeNull();
    });
});
