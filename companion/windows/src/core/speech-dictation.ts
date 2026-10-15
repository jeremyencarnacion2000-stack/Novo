export type DictationError = "unavailable" | "permission" | "no-speech" | "failed";

interface RecognitionAlternativeLike { transcript: string }
interface RecognitionResultLike { 0?: RecognitionAlternativeLike }
interface RecognitionResultsLike { length: number; [index: number]: RecognitionResultLike }

interface RecognitionErrorLike { error?: string }
interface RecognitionResultEventLike { results: RecognitionResultsLike }

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function browserSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const browser = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

function speechLocale(locale: string): string {
  return locale === "zh-Hans" ? "zh-CN" : locale;
}

function friendlyError(code: string | undefined): DictationError {
  if (code === "not-allowed" || code === "service-not-allowed") return "permission";
  if (code === "no-speech") return "no-speech";
  if (code === "aborted") return "failed";
  return "failed";
}

export class SpeechDictation {
  private readonly callbacks: {
    transcript(text: string): void;
    listening(active: boolean): void;
    error(error: DictationError): void;
  };
  private readonly Recognition: SpeechRecognitionConstructor | null;
  private readonly locale: string;
  private recognition: SpeechRecognitionLike | null = null;
  private generation = 0;
  private baseText = "";
  private hasTranscript = false;
  private reportedError = false;
  private listening = false;

  constructor(
    callbacks: {
      transcript(text: string): void;
      listening(active: boolean): void;
      error(error: DictationError): void;
    },
    Recognition: SpeechRecognitionConstructor | null = browserSpeechRecognition(),
    locale = typeof navigator === "undefined" ? "en" : navigator.language || "en",
  ) {
    this.callbacks = callbacks;
    this.Recognition = Recognition;
    this.locale = locale;
  }

  get supported(): boolean { return this.Recognition !== null; }
  get isListening(): boolean { return this.listening; }

  start(draft: string): boolean {
    if (!this.Recognition) {
      this.callbacks.error("unavailable");
      return false;
    }
    if (this.listening || this.recognition) return false;

    const generation = ++this.generation;
    const recognition = new this.Recognition();
    this.recognition = recognition;
    this.baseText = draft;
    this.hasTranscript = false;
    this.reportedError = false;
    recognition.lang = speechLocale(this.locale);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = null;
    recognition.onresult = (event) => {
      if (generation !== this.generation) return;
      let spoken = "";
      for (let i = 0; i < event.results.length; i++) spoken += event.results[i]?.[0]?.transcript ?? "";
      if (!spoken.trim()) return;
      this.hasTranscript = true;
      const separator = this.baseText && !/\s$/.test(this.baseText) ? " " : "";
      this.callbacks.transcript(`${this.baseText}${separator}${spoken.trimStart()}`);
    };
    recognition.onerror = (event) => {
      if (generation !== this.generation || event.error === "aborted") return;
      this.reportedError = true;
      this.callbacks.error(friendlyError(event.error));
    };
    recognition.onend = () => {
      if (generation !== this.generation) return;
      this.recognition = null;
      this.listening = false;
      this.callbacks.listening(false);
      if (!this.hasTranscript && !this.reportedError) this.callbacks.error("no-speech");
    };

    this.listening = true;
    this.callbacks.listening(true);
    try {
      recognition.start();
      return true;
    } catch (error) {
      if (generation === this.generation) {
        this.recognition = null;
        this.listening = false;
        this.callbacks.listening(false);
        this.callbacks.error((error as { name?: string })?.name === "NotAllowedError" ? "permission" : "failed");
      }
      return false;
    }
  }

  stop(): void {
    if (!this.listening || !this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      this.cancel();
    }
  }

  cancel(): void {
    const recognition = this.recognition;
    const wasListening = this.listening;
    if (!recognition && !wasListening) return;
    ++this.generation;
    this.recognition = null;
    this.listening = false;
    try { recognition?.abort(); } catch { /* the browser may already have closed the mic */ }
    this.callbacks.transcript(this.baseText);
    if (wasListening) this.callbacks.listening(false);
  }

  dispose(): void {
    ++this.generation;
    const recognition = this.recognition;
    this.recognition = null;
    this.listening = false;
    try { recognition?.abort(); } catch { /* the browser may already have closed the mic */ }
  }
}
