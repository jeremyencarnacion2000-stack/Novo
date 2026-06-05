/**
 * lib/music-algorithm.ts
 * Advanced Music Similarity & Selection Logic
 */

export interface TrackMetadata {
    id: string;
    name: string;
    bpm: number;
    energy: number;   // 0.0 - 1.0
    valence: number;  // 0.0 - 1.0
}

export class MusicAlgorithm {
    /**
     * Calculates Cosine Similarity between two tracks
     */
    static calculateSimilarity(a: TrackMetadata, b: TrackMetadata): number {
        // Normalize BPM (60-200 range)
        const normA = (a.bpm - 60) / 140;
        const normB = (b.bpm - 60) / 140;

        const vecA = [normA, a.energy, a.valence];
        const vecB = [normB, b.energy, b.valence];

        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < 3; i++) {
            dot += vecA[i] * vecB[i];
            magA += vecA[i] ** 2;
            magB += vecB[i] ** 2;
        }

        magA = Math.sqrt(magA);
        magB = Math.sqrt(magB);

        if (magA === 0 || magB === 0) return 0;
        return dot / (magA * magB);
    }

    /**
     * Generates "Technical Metadata" for tracks that don't have it (Mock/Fallback)
     * This mimics Spotify's Audio Features API
     */
    static getOrGenerateMetadata(track: any): TrackMetadata {
        // Deterministic generation based on ID for consistent demo behavior
        const hash = (str: string) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
            return Math.abs(h);
        };

        const h = hash(track.id || track.name);

        return {
            id: track.id,
            name: track.name,
            bpm: 80 + (h % 100),       // 80 - 180 BPM
            energy: (h % 100) / 100,    // 0.0 - 1.0
            valence: ((h / 100) % 100) / 100 // 0.0 - 1.0
        };
    }

    /**
     * Finds the best next track excluding recent history
     */
    static findBestNext(current: any, candidates: any[], historyIds: string[]): any {
        if (candidates.length === 0) return null;

        const currentMeta = this.getOrGenerateMetadata(current);

        // Filter out current and history
        const filtered = candidates.filter(c => c.id !== current.id && !historyIds.includes(c.id));

        if (filtered.length === 0) return candidates[0]; // Fallback if all matches played

        const scored = filtered.map(c => ({
            track: c,
            score: this.calculateSimilarity(currentMeta, this.getOrGenerateMetadata(c))
        }));

        scored.sort((a, b) => b.score - a.score);

        console.log(`[MusicAlgo] Best match: ${scored[0].track.name} (Score: ${scored[0].score.toFixed(4)})`);
        return scored[0].track;
    }
}
