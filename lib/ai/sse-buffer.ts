// SSE frames don't align with network chunk boundaries — a single
// `data: {...}\n\n` can be split across two reader.read() results. Splitting
// each raw chunk on '\n' with no carry-over buffer silently drops any frame
// that straddles a boundary. On Vercel's chunked streaming that dropped
// most/all content frames from the chatbot's response, so the UI showed
// nothing even though the API streamed correctly (production bug, found by
// /qa on 2026-07-19). This is the shared fix: accumulate the new chunk onto
// whatever was left over, split on '\n', and hand back the trailing partial
// line as the next buffer instead of processing it as if it were complete.
export function splitSseLines(chunk: string, buffer: string): { lines: string[]; buffer: string } {
    const combined = buffer + chunk
    const lines = combined.split('\n')
    const trailing = lines.pop() || ''
    return { lines, buffer: trailing }
}

// A stream can end with a final frame that has no trailing '\n' at all (the
// connection just closes) — that frame is sitting in the leftover buffer and
// would otherwise be silently dropped. Call this once after the read loop
// ends, on whatever splitSseLines last returned as `buffer`.
export function parseFinalSseLine(buffer: string): { content?: string } | null {
    if (!buffer.startsWith('data: ')) return null
    const data = buffer.slice(6)
    if (data === '[DONE]') return null
    try {
        return JSON.parse(data)
    } catch {
        return null
    }
}
