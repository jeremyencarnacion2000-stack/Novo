/**
 * MusicEngine.js
 * Senior Engineer Implementation: Vector-based Music Recommendation & Autoplay
 */

class MusicEngine {
    constructor(tracks) {
        this.database = tracks;
        this.history = []; // Stores IDs of last played tracks
        this.HISTORY_LIMIT = 3;
    }

    /**
     * Cosine Similarity: Measures the similarity between two tracks based on their
     * technical vector (BPM, Energy, Valence).
     * @param {Object} songA 
     * @param {Object} songB 
     * @returns {number} 0.0 to 1.0 (Similarity score)
     */
    calculateCosineSimilarity(songA, songB) {
        // We normalize BPM to a 0.0-1.0 scale (assuming a range of 60-200 BPM)
        const normalizeBPM = (bpm) => (bpm - 60) / (200 - 60);

        const vecA = [normalizeBPM(songA.bpm), songA.energy, songA.valence];
        const vecB = [normalizeBPM(songB.bpm), songB.energy, songB.valence];

        let dotProduct = 0;
        let magA = 0;
        let magB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magA += vecA[i] * vecA[i];
            magB += vecB[i] * vecB[i];
        }

        magA = Math.sqrt(magA);
        magB = Math.sqrt(magB);

        if (magA === 0 || magB === 0) return 0;
        return dotProduct / (magA * magB);
    }

    /**
     * Recommends the next track based on technical similarity and mood.
     * @param {Object} currentTrack 
     * @returns {Object} The recommended track
     */
    getRecommendation(currentTrack) {
        // Filter out current track and last 3 tracks
        const candidates = this.database.filter(track =>
            track.id !== currentTrack.id &&
            !this.history.includes(track.id)
        );

        if (candidates.length === 0) {
            console.warn("Algorithm Warning: Exhausted new recommendations. Clearing history.");
            this.history = [];
            return this.getRecommendation(currentTrack);
        }

        // Map similarity scores
        const scoredCandidates = candidates.map(track => ({
            track,
            score: this.calculateCosineSimilarity(currentTrack, track)
        }));

        // Sort by highest similarity
        scoredCandidates.sort((a, b) => b.score - a.score);

        const bestMatch = scoredCandidates[0].track;

        // Update History
        this.updateHistory(bestMatch.id);

        console.log(`[Algorithm] Recommended "${bestMatch.title}" with similarity: ${scoredCandidates[0].score.toFixed(4)}`);
        return bestMatch;
    }

    updateHistory(trackId) {
        this.history.push(trackId);
        if (this.history.length > this.HISTORY_LIMIT) {
            this.history.shift();
        }
    }
}

/**
 * AudioController.js
 * Manages playback, events, and crossfading
 */
class AudioController {
    constructor(engine) {
        this.engine = engine;
        this.audio = new Audio();
        this.isCrossfading = false;

        // Initialize listener
        this.audio.addEventListener('ended', () => this.handleTrackEnd());
    }

    playTrack(track) {
        this.currentTrack = track;
        this.audio.src = track.url;
        this.audio.volume = 1;
        this.audio.play().catch(e => console.error("Playback failed:", e));
        console.log(`[Playback] Now playing: ${track.title}`);
    }

    async handleTrackEnd() {
        console.log("[Event] Track ended. Fetching recommendation...");
        const nextTrack = this.engine.getRecommendation(this.currentTrack);

        // Standard Autoplay: simple sequence
        // For Crossfade, we need two audio elements. 
        // Here we implement a volume-ramp based Crossfade simulation
        this.playWithCrossfade(nextTrack);
    }

    /**
     * Performs a 2-second crossfade transition
     */
    async playWithCrossfade(nextTrack) {
        if (this.isCrossfading) return;
        this.isCrossfading = true;

        const nextAudio = new Audio(nextTrack.url);
        nextAudio.volume = 0;

        await nextAudio.play();

        const duration = 2000; // 2 seconds
        const steps = 20;
        const interval = duration / steps;

        let currentStep = 0;

        const fade = setInterval(() => {
            currentStep++;
            const ratio = currentStep / steps;

            // Logarithmic volume curve (more natural)
            this.audio.volume = Math.max(0, 1 - ratio);
            nextAudio.volume = ratio;

            if (currentStep >= steps) {
                clearInterval(fade);
                this.audio.pause();
                this.audio = nextAudio; // Swap primary audio
                this.currentTrack = nextTrack;
                this.isCrossfading = false;
                console.log("[Crossfade] Transition complete.");
            }
        }, interval);
    }
}

// EXAMPLE DATA & INTEGRATION
const sampleDatabase = [
    { id: 1, title: "Lofi Beats", genre: "Lofi", subgenre: "Chill", bpm: 85, energy: 0.3, valence: 0.6, url: "track1.mp3" },
    { id: 2, title: "Urban Night", genre: "Hip-Hop", subgenre: "Jazz", bpm: 92, energy: 0.4, valence: 0.5, url: "track2.mp3" },
    { id: 3, title: "Summer House", genre: "Electronic", subgenre: "House", bpm: 124, energy: 0.8, valence: 0.9, url: "track3.mp3" },
    { id: 4, title: "Neon Drive", genre: "Synthwave", subgenre: "Retro", bpm: 110, energy: 0.7, valence: 0.7, url: "track4.mp3" },
    { id: 5, title: "Deep Forest", genre: "Ambient", subgenre: "Nature", bpm: 70, energy: 0.2, valence: 0.3, url: "track5.mp3" },
    // ... imagine 15 more tracks here with varying metadata
];

// Initialize System
const engine = new MusicEngine(sampleDatabase);
const controller = new AudioController(engine);

// Start the first song
// controller.playTrack(sampleDatabase[0]);

console.log("Music Autoplay System Initialized.");
